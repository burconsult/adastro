import type { APIRoute } from 'astro';
import { authService } from '../../../lib/auth/auth-helpers.js';
import { sanitizeRedirectPath } from '../../../lib/auth/redirects.js';
import { buildRateLimitHeaders, checkRateLimit } from '../../../lib/security/rate-limit.js';
import { getClientIp } from '../../../lib/security/request-guards.js';
import { resolveSiteUrl } from '../../../lib/url/site-url.js';

const GENERIC_RESPONSE = {
  success: true,
  message: 'If an account exists for this email, a password reset link has been sent.'
};

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const FORGOT_PASSWORD_IP_RATE_LIMIT = {
  limit: 10,
  windowMs: 10 * 60 * 1000
};
const FORGOT_PASSWORD_EMAIL_RATE_LIMIT = {
  limit: 5,
  windowMs: 10 * 60 * 1000
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.json().catch(() => ({}));
    const email = typeof payload?.email === 'string'
      ? payload.email.trim().toLowerCase()
      : '';
    const redirectPath = sanitizeRedirectPath(payload?.redirectPath, '/auth/reset-password');

    if (!isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: 'Enter a valid email address.' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        }
      );
    }

    const ip = getClientIp(request);
    const ipRateLimit = checkRateLimit({
      key: `auth:forgot-password:ip:${ip}`,
      ...FORGOT_PASSWORD_IP_RATE_LIMIT
    });
    const emailRateLimit = checkRateLimit({
      key: `auth:forgot-password:${ip}:${email}`,
      ...FORGOT_PASSWORD_EMAIL_RATE_LIMIT
    });
    const rateLimit = !ipRateLimit.allowed ? ipRateLimit : emailRateLimit;
    const rateLimitHeaders = buildRateLimitHeaders(
      rateLimit,
      !ipRateLimit.allowed ? FORGOT_PASSWORD_IP_RATE_LIMIT : FORGOT_PASSWORD_EMAIL_RATE_LIMIT
    );

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many reset attempts. Try again shortly.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            ...rateLimitHeaders
          }
        }
      );
    }

    try {
      await authService.resetPassword(
        { email },
        {
          siteUrl: resolveSiteUrl(request, import.meta.env.SITE),
          redirectPath
        }
      );
    } catch (error) {
      // Intentionally avoid leaking user-existence information.
      console.warn('Forgot password request warning:', error);
    }

    return new Response(
      JSON.stringify(GENERIC_RESPONSE),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          ...rateLimitHeaders
        }
      }
    );
  } catch (error) {
    console.error('Forgot password API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process password reset request.' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );
  }
};
