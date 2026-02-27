import type { APIRoute } from 'astro';
import { buildAccessTokenCookie } from '../../../lib/auth/cookies.js';
import { authService } from '../../../lib/auth/auth-helpers.js';

export const POST: APIRoute = async ({ request }) => {
  try {
    await authService.signOut();

    return new Response(
      JSON.stringify({ success: true }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Set-Cookie': buildAccessTokenCookie('', 0, request.url)
        }
      }
    );
  } catch (error) {
    console.error('Logout API error:', error);
    
    return new Response(
      JSON.stringify({ error: 'Logout failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
