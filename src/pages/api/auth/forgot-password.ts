import type { APIRoute } from 'astro';
import { authService } from '../../../lib/auth/auth-helpers.js';
import { checkRateLimit } from '../../../lib/security/rate-limit.js';
import { getClientIp } from '../../../lib/security/request-guards.js';

const GENERIC_RESPONSE = {
  success: true,
  message: 'If an account exists for this email, a password reset link has been sent.'
};

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const resolvePublicSiteUrl = (requestUrl: string): string | undefined => {
  const configuredSiteUrl = (import.meta.env.SITE_URL as string | undefined)?.trim();
  if (configuredSiteUrl) {
    return configuredSiteUrl;
  }

  try {
    return new URL(requestUrl).origin;
  } catch {
    return undefined;
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.json().catch(() => ({}));
    const email = typeof payload?.email === 'string'
      ? payload.email.trim().toLowerCase()
      : '';

    if (!isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: 'Enter a valid email address.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const ip = getClientIp(request);
    const rateLimit = checkRateLimit({
      key: `auth:forgot-password:${ip}:${email}`,
      limit: 5,
      windowMs: 10 * 60 * 1000
    });

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many reset attempts. Try again shortly.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimit.retryAfterSec)
          }
        }
      );
    }

    try {
      await authService.resetPassword(
        { email },
        { siteUrl: resolvePublicSiteUrl(request.url) }
      );
    } catch (error) {
      // Intentionally avoid leaking user-existence information.
      console.warn('Forgot password request warning:', error);
    }

    return new Response(
      JSON.stringify(GENERIC_RESPONSE),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Forgot password API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process password reset request.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
