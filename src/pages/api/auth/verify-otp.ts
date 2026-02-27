import type { APIRoute } from 'astro';
import { buildAccessTokenCookie } from '../../../lib/auth/cookies.js';
import { supabase } from '../../../lib/supabase.js';

const ALLOWED_OTP_TYPES = new Set([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email',
  'email_change'
]);

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.json().catch(() => ({}));
    const tokenHash = typeof payload.token_hash === 'string' ? payload.token_hash.trim() : '';
    const otpType = typeof payload.type === 'string' ? payload.type.trim().toLowerCase() : '';

    if (!tokenHash || !otpType) {
      return json({ error: 'token_hash and type are required.' }, 400);
    }

    if (!ALLOWED_OTP_TYPES.has(otpType)) {
      return json({ error: 'Unsupported OTP type.' }, 400);
    }

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType as any
    });

    if (error || !data.session?.access_token) {
      return json({ error: 'Invalid or expired authentication token.' }, 401);
    }

    const maxAge = typeof data.session.expires_in === 'number' ? data.session.expires_in : 3600;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': buildAccessTokenCookie(data.session.access_token, maxAge, request.url)
      }
    });
  } catch (error) {
    console.error('OTP verification failed:', error);
    return json({ error: 'Failed to verify authentication token.' }, 500);
  }
};
