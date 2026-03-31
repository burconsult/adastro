import type { APIRoute } from 'astro';
import { sanitizeRedirectPath } from '@/lib/auth/redirects';
import { isOAuthProviderAvailable } from '@/lib/auth/oauth-providers';
import { resolveSiteUrl } from '@/lib/url/site-url';
import { buildLocalizedPath, normalizeLocaleCode } from '@/lib/i18n/locales';

const allowedProviders = new Set(['github', 'google', 'azure']);

export const GET: APIRoute = async ({ params, url, request, locals }) => {
  const provider = params.provider?.toLowerCase() || '';
  const locale = normalizeLocaleCode(locals?.locale, locals?.defaultLocale || 'en');
  if (!allowedProviders.has(provider)) {
    return new Response('Unsupported provider', { status: 400 });
  }

  const providerAvailable = await isOAuthProviderAvailable(provider);
  if (!providerAvailable) {
    const redirectTarget = sanitizeRedirectPath(url.searchParams.get('redirect'), buildLocalizedPath('/profile', locale));
    const loginRedirect = `${buildLocalizedPath('/auth/login', locale)}?redirect=${encodeURIComponent(redirectTarget)}&error=oauth_provider_unavailable`;
    return Response.redirect(new URL(loginRedirect, url).toString(), 302);
  }

  const redirectTarget = sanitizeRedirectPath(url.searchParams.get('redirect'), buildLocalizedPath('/profile', locale));
  const siteUrl = resolveSiteUrl(request, import.meta.env.SITE);
  const supabaseUrl = import.meta.env.SUPABASE_URL;

  if (!supabaseUrl) {
    return new Response('Supabase URL not configured', { status: 500 });
  }

  const redirectTo = `${siteUrl}${buildLocalizedPath('/auth/callback', locale)}?redirect=${encodeURIComponent(redirectTarget)}`;
  const authUrl = new URL(`${supabaseUrl}/auth/v1/authorize`);
  authUrl.searchParams.set('provider', provider);
  authUrl.searchParams.set('redirect_to', redirectTo);
  if (provider === 'azure') {
    authUrl.searchParams.set('scopes', 'email');
  }

  return Response.redirect(authUrl.toString(), 302);
};
