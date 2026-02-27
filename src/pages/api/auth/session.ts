import type { APIRoute } from 'astro';
import { buildAccessTokenCookie } from '../../../lib/auth/cookies.js';
import { supabaseAdmin } from '../../../lib/supabase.js';

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.json().catch(() => ({}));
    const accessToken = typeof payload.access_token === 'string' ? payload.access_token.trim() : '';

    if (!accessToken) {
      return json({ error: 'Access token is required.' }, 400);
    }

    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !data.user) {
      return json({ error: 'Invalid access token.' }, 401);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': buildAccessTokenCookie(accessToken, 3600, request.url)
      }
    });
  } catch (error) {
    console.error('Session sync failed:', error);
    return json({ error: 'Failed to set session.' }, 500);
  }
};
