import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';
import { sanitizeRedirectPath } from '@/lib/auth/redirects';
import { isOAuthProviderAvailable } from '@/lib/auth/oauth-providers';
import { resolveSiteUrl } from '@/lib/url/site-url';

const allowedProviders = new Set(['github', 'google']);
const OAUTH_STATE_COOKIE = 'adastro-oauth-state';

const buildOAuthStateCookie = (value: string, requestUrl: string): string => {
  const isSecure = requestUrl.startsWith('https://');
  const parts = [
    `${OAUTH_STATE_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'SameSite=Lax',
    'Max-Age=600',
    'Priority=High'
  ];
  if (isSecure) {
    parts.push('Secure');
  }
  return parts.join('; ');
};

export const GET: APIRoute = async ({ params, url, request }) => {
  const provider = params.provider?.toLowerCase() || '';
  if (!allowedProviders.has(provider)) {
    return new Response('Unsupported provider', { status: 400 });
  }

  const providerAvailable = await isOAuthProviderAvailable(provider);
  if (!providerAvailable) {
    const redirectTarget = sanitizeRedirectPath(url.searchParams.get('redirect'), '/profile');
    const loginRedirect = `/auth/login?redirect=${encodeURIComponent(redirectTarget)}&error=oauth_provider_unavailable`;
    return Response.redirect(new URL(loginRedirect, url).toString(), 302);
  }

  const redirectTarget = sanitizeRedirectPath(url.searchParams.get('redirect'), '/profile');
  const state = randomBytes(24).toString('hex');
  const siteUrl = resolveSiteUrl(request, import.meta.env.SITE);
  const supabaseUrl = import.meta.env.SUPABASE_URL;

  if (!supabaseUrl) {
    return new Response('Supabase URL not configured', { status: 500 });
  }

  const redirectTo = `${siteUrl}/auth/callback?redirect=${encodeURIComponent(redirectTarget)}`;
  const authUrl = `${supabaseUrl}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectTo)}&state=${encodeURIComponent(state)}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl,
      'Set-Cookie': buildOAuthStateCookie(state, request.url)
    }
  });
};
