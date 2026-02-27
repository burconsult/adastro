import type { APIRoute } from 'astro';
import { authService } from '../../../lib/auth/auth-helpers.js';
import { resolveRoleSafeRedirect } from '../../../lib/auth/access-policy.js';
import { buildAccessTokenCookie } from '../../../lib/auth/cookies.js';
import { checkRateLimit } from '../../../lib/security/rate-limit.js';
import { getClientIp } from '../../../lib/security/request-guards.js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email, password, redirect } = await request.json();
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit({
      key: `auth:login:${ip}:${normalizedEmail || 'unknown'}`,
      limit: 8,
      windowMs: 10 * 60 * 1000
    });

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many login attempts. Try again shortly.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimit.retryAfterSec)
          }
        }
      );
    }

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await authService.signIn({ email, password });
    const redirectTo = resolveRoleSafeRedirect(result.user.role, redirect);

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
          'Set-Cookie': buildAccessTokenCookie(result.session.access_token, result.session.expires_in, request.url)
        }
      }
    );
  } catch (error) {
    console.error('Login API error:', error);
    
    return new Response(
      JSON.stringify({ error: 'Login failed' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
