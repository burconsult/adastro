import type { APIRoute } from 'astro';
import { authService, requireAdmin } from '@/lib/auth/auth-helpers';
import { buildInvitePasswordSetupPath, normalizeAppUserRole } from '@/lib/auth/access-policy';
import { buildLocalizedPath } from '@/lib/i18n/locales';
import { getSiteLocaleConfig } from '@/lib/site-config';
import { ensureAuthorProfileForAuthUser } from '@/lib/auth/author-provisioning';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveAuthSiteUrl } from '@/lib/url/site-url';

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

    const redirectBase = resolveAuthSiteUrl(request, import.meta.env.SITE);
    const localeConfig = await getSiteLocaleConfig();
    const defaultLocale = localeConfig.defaultLocale;
    const callbackPath = buildInvitePasswordSetupPath(normalizedRole, { locale: defaultLocale, defaultLocale });
    const redirectTo = redirectBase
      ? `${redirectBase}${buildLocalizedPath('/auth/callback', defaultLocale)}?redirect=${encodeURIComponent(callbackPath)}`
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
