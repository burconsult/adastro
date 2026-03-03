import type { APIRoute } from 'astro';
import { buildAccessTokenCookie } from '../../../lib/auth/cookies.js';
import { createSupabaseServerClient } from '../../../lib/supabase.js';

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    const serverClient = createSupabaseServerClient();
    const payload = await request.json().catch(() => ({}));
    const code = typeof payload.code === 'string' ? payload.code.trim() : '';

    if (!code) {
      return json({ error: 'Authorization code is required.' }, 400);
    }

    const { data, error } = await serverClient.auth.exchangeCodeForSession(code);

    if (error || !data.session?.access_token) {
      return json({ error: 'Invalid or expired authorization code.' }, 401);
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
    console.error('Auth code exchange failed:', error);
    return json({ error: 'Failed to exchange authorization code.' }, 500);
  }
};
