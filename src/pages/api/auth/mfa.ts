import type { APIRoute } from 'astro';
import { buildAccessTokenCookie } from '../../../lib/auth/cookies.js';
import { buildRateLimitHeaders, checkRateLimit } from '../../../lib/security/rate-limit.js';
import { getClientIp } from '../../../lib/security/request-guards.js';
import {
  enrollTotpFactor,
  getMfaStatus,
  MfaError,
  MfaRequiredError,
  unenrollMfaFactor,
  verifyTotpFactor
} from '../../../lib/auth/mfa.js';

const MFA_VERIFY_RATE_LIMIT = {
  limit: 10,
  windowMs: 10 * 60 * 1000
};

const json = (payload: unknown, status = 200, extraHeaders?: Record<string, string>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(extraHeaders || {})
    }
  });

const errorCodeFor = (error: MfaError): string => (
  error instanceof MfaRequiredError ? 'mfa_required' : 'mfa_error'
);

const normalizeMfaError = (error: unknown): { message: string; status: number; code: string } | null => {
  if (error instanceof MfaError) {
    return {
      message: error.message,
      status: error.status,
      code: errorCodeFor(error)
    };
  }

  if (error instanceof Error && typeof (error as { status?: unknown }).status === 'number') {
    const status = Number((error as { status: number }).status);
    return {
      message: error.message,
      status,
      code: status === 412 ? 'mfa_required' : 'mfa_error'
    };
  }

  return null;
};

export const GET: APIRoute = async ({ request }) => {
  try {
    const status = await getMfaStatus(request);
    return json(status);
  } catch (error) {
    const normalizedError = normalizeMfaError(error);
    if (normalizedError) {
      return json({ error: normalizedError.message, code: normalizedError.code }, normalizedError.status);
    }
    console.error('MFA status API error:', error);
    return json({ error: 'Failed to load MFA status.' }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.json().catch(() => ({}));
    const action = typeof payload?.action === 'string' ? payload.action.trim().toLowerCase() : '';

    if (action === 'enroll') {
      const enrollment = await enrollTotpFactor(request);
      return json({
        success: true,
        factor: enrollment.factor,
        totp: enrollment.totp
      });
    }

    if (action === 'verify') {
      const factorId = typeof payload?.factorId === 'string' ? payload.factorId : '';
      const code = typeof payload?.code === 'string' ? payload.code : '';
      const ip = getClientIp(request);
      const rateLimit = checkRateLimit({
        key: `auth:mfa:verify:${ip}:${factorId || 'unknown'}`,
        ...MFA_VERIFY_RATE_LIMIT
      });
      const rateLimitHeaders = buildRateLimitHeaders(rateLimit, MFA_VERIFY_RATE_LIMIT);

      if (!rateLimit.allowed) {
        return json({ error: 'Too many MFA attempts. Try again shortly.' }, 429, rateLimitHeaders);
      }

      const verification = await verifyTotpFactor(request, factorId, code);

      return json({
        success: true,
        status: verification.status
      }, 200, {
        'Set-Cookie': buildAccessTokenCookie(verification.accessToken, verification.expiresIn, request.url),
        ...rateLimitHeaders
      });
    }

    return json({ error: 'Unsupported MFA action.' }, 400);
  } catch (error) {
    const normalizedError = normalizeMfaError(error);
    if (normalizedError) {
      return json({ error: normalizedError.message, code: normalizedError.code }, normalizedError.status);
    }
    console.error('MFA API error:', error);
    return json({ error: 'Failed to process MFA request.' }, 500);
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const payload = await request.json().catch(() => ({}));
    const factorId = typeof payload?.factorId === 'string' ? payload.factorId : '';
    const status = await unenrollMfaFactor(request, factorId);
    return json({ success: true, status });
  } catch (error) {
    const normalizedError = normalizeMfaError(error);
    if (normalizedError) {
      return json({ error: normalizedError.message, code: normalizedError.code }, normalizedError.status);
    }
    console.error('MFA factor removal API error:', error);
    return json({ error: 'Failed to remove MFA factor.' }, 500);
  }
};
