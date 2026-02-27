import type { APIRoute } from 'astro';
import { authService, requireAdmin } from '@/lib/auth/auth-helpers';
import { buildInvitePasswordSetupPath, normalizeAppUserRole } from '@/lib/auth/access-policy';
import { ensureAuthorProfileForAuthUser } from '@/lib/auth/author-provisioning';
import { supabaseAdmin } from '@/lib/supabase';

const sanitizeSiteUrl = (value: string | undefined): string | null => {
  if (!value || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);

    const { email, role = 'author' } = await request.json();
    const rawRole = typeof role === 'string' ? role.trim().toLowerCase() : 'author';
    const normalizedRole = normalizeAppUserRole(rawRole);
    const allowedRoles = new Set(['admin', 'author', 'reader']);

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!allowedRoles.has(rawRole)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const siteUrl = sanitizeSiteUrl(import.meta.env.SITE_URL as string | undefined);
    const requestOrigin = sanitizeSiteUrl(request.url);
    const redirectBase = siteUrl || requestOrigin;
    const callbackPath = buildInvitePasswordSetupPath(normalizedRole);
    const redirectTo = redirectBase
      ? `${redirectBase}/auth/callback?redirect=${encodeURIComponent(callbackPath)}`
      : undefined;

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      ...(redirectTo ? { redirectTo } : {})
    });

    if (error) {
      console.error('Invite user API error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to send invitation' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (data?.user?.id) {
      await authService.setUserRole(data.user.id, normalizedRole);
      if (normalizedRole === 'admin' || normalizedRole === 'author') {
        try {
          await ensureAuthorProfileForAuthUser(data.user.id);
        } catch (authorProvisionError) {
          console.warn('Invite user API author provisioning warning:', authorProvisionError);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invitation sent successfully'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Invite user API error:', error);
    
    return new Response(
      JSON.stringify({ error: 'Failed to invite user' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
