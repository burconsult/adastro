import type { APIRoute } from 'astro';
import { authService } from '../../../lib/auth/auth-helpers.js';
import { resolveRoleSafeRedirect } from '../../../lib/auth/access-policy.js';
import { buildAccessTokenCookie } from '../../../lib/auth/cookies.js';
import { buildRateLimitHeaders, checkRateLimit } from '../../../lib/security/rate-limit.js';
import { getClientIp } from '../../../lib/security/request-guards.js';

const LOGIN_IP_RATE_LIMIT = {
  limit: 20,
  windowMs: 10 * 60 * 1000
};

const LOGIN_CREDENTIAL_RATE_LIMIT = {
  limit: 8,
  windowMs: 10 * 60 * 1000
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email, password, redirect, locale } = await request.json();
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const ip = getClientIp(request);
    const ipRateLimit = checkRateLimit({
      key: `auth:login:ip:${ip}`,
      ...LOGIN_IP_RATE_LIMIT
    });
    const credentialRateLimit = checkRateLimit({
      key: `auth:login:${ip}:${normalizedEmail || 'unknown'}`,
      ...LOGIN_CREDENTIAL_RATE_LIMIT
    });
    const rateLimit = !ipRateLimit.allowed ? ipRateLimit : credentialRateLimit;
    const rateLimitHeaders = buildRateLimitHeaders(
      rateLimit,
      !ipRateLimit.allowed ? LOGIN_IP_RATE_LIMIT : LOGIN_CREDENTIAL_RATE_LIMIT
    );

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many login attempts. Try again shortly.' }),
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

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        }
      );
    }

    const result = await authService.signIn({ email, password });
    const redirectTo = resolveRoleSafeRedirect(result.user.role, redirect, { locale });

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: result.user,
        redirect: redirectTo
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Set-Cookie': buildAccessTokenCookie(result.session.access_token, result.session.expires_in, request.url),
          ...rateLimitHeaders
        }
      }
    );
  } catch (error) {
    console.error('Login API error:', error);
    
    return new Response(
      JSON.stringify({ error: 'Login failed' }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );
  }
};
