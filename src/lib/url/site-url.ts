import {
  detectRequestSiteUrl,
  getRuntimeEnv,
  sanitizeBaseUrl
} from '@/lib/setup/runtime';
import { resolveLocalePath } from '@/lib/i18n/locales';
import { FALLBACK_SITE_URL, normalizeCanonicalSiteUrl } from './canonical-site.js';

const normalizeResolvedSiteUrl = (value?: string | null): string | null => (
  normalizeCanonicalSiteUrl(value || null)
);

export const resolveSiteUrl = (request: Request, buildTimeSiteUrl?: string | null): string => {
  const envSiteUrl = sanitizeBaseUrl((import.meta.env.SITE_URL as string | undefined) || getRuntimeEnv('SITE_URL'));
  const normalizedEnvSiteUrl = normalizeResolvedSiteUrl(envSiteUrl);
  if (normalizedEnvSiteUrl) return normalizedEnvSiteUrl;

  const requestSiteUrl = detectRequestSiteUrl(request);
  const normalizedRequestSiteUrl = normalizeResolvedSiteUrl(requestSiteUrl);
  if (normalizedRequestSiteUrl) return normalizedRequestSiteUrl;

  const buildSiteUrl = sanitizeBaseUrl(buildTimeSiteUrl || undefined);
  const normalizedBuildSiteUrl = normalizeResolvedSiteUrl(buildSiteUrl);
  if (normalizedBuildSiteUrl) return normalizedBuildSiteUrl;

  return FALLBACK_SITE_URL;
};

export const resolveAlternateLocalePath = ({
  canonicalUrl,
  siteBaseUrl,
  fallbackPathname,
  locales,
  defaultLocale
}: {
  canonicalUrl?: string | null;
  siteBaseUrl: string;
  fallbackPathname: string;
  locales: string[];
  defaultLocale: string;
}): string => {
  const normalizedFallbackPath = typeof fallbackPathname === 'string' && fallbackPathname.trim().length > 0
    ? (fallbackPathname.startsWith('/') ? fallbackPathname : `/${fallbackPathname}`)
    : '/';

  if (typeof canonicalUrl !== 'string' || canonicalUrl.trim().length === 0) {
    return normalizedFallbackPath;
  }

  try {
    const siteBase = new URL(siteBaseUrl);
    const parsedCanonicalUrl = new URL(canonicalUrl.trim(), siteBase);
    if (parsedCanonicalUrl.origin !== siteBase.origin) {
      return normalizedFallbackPath;
    }

    return resolveLocalePath(parsedCanonicalUrl.pathname, locales, defaultLocale).pathnameWithoutLocale;
  } catch {
    return normalizedFallbackPath;
  }
};

export { normalizeCanonicalSiteUrl, FALLBACK_SITE_URL };
