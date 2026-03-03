import type { APIRoute } from 'astro';
import { buildAccessTokenCookie } from '../../../lib/auth/cookies.js';
import { authService } from '../../../lib/auth/auth-helpers.js';

export const POST: APIRoute = async ({ request }) => {
  try {
    await authService.signOut(request);
  } catch (error) {
    // OAuth callback sessions are cookie-synced and may not exist in this server runtime's
    // in-memory Supabase client state. Logout must still clear app auth cookie.
    console.warn('Supabase signOut skipped during logout:', error);
  }

  return new Response(
    JSON.stringify({ success: true }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Set-Cookie': buildAccessTokenCookie('', 0, request.url)
      }
    }
  );
};
