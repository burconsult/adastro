import type { APIRoute } from 'astro';
import { requireAuth } from '../../../lib/auth/auth-helpers.js';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../lib/supabase.js';

const MIN_PASSWORD_LENGTH = 8;

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!isSupabaseAdminConfigured) {
      return new Response(
        JSON.stringify({ error: 'Supabase secret key is not configured.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const user = await requireAuth(request);
    const payload = await request.json().catch(() => ({}));
    const password = typeof payload?.password === 'string' ? payload.password : '';

    if (password.length < MIN_PASSWORD_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Password must contain at least ${MIN_PASSWORD_LENGTH} characters.` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password
    });

    if (error) {
      console.error('Password update API error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update password.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication required')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.error('Password update API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update password.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
