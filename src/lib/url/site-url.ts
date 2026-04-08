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

const resolveEnvSiteUrl = (): string | null => {
  const envSiteUrl = sanitizeBaseUrl((import.meta.env.SITE_URL as string | undefined) || getRuntimeEnv('SITE_URL'));
  const normalizedEnvSiteUrl = normalizeResolvedSiteUrl(envSiteUrl);
  if (normalizedEnvSiteUrl) return normalizedEnvSiteUrl;
  return null;
};

const resolveConfiguredSiteUrl = (buildTimeSiteUrl?: string | null): string | null => {
  const envSiteUrl = resolveEnvSiteUrl();
  if (envSiteUrl) return envSiteUrl;

  const buildSiteUrl = sanitizeBaseUrl(buildTimeSiteUrl || undefined);
  const normalizedBuildSiteUrl = normalizeResolvedSiteUrl(buildSiteUrl);
  if (normalizedBuildSiteUrl && normalizedBuildSiteUrl !== FALLBACK_SITE_URL) {
    return normalizedBuildSiteUrl;
  }

  return null;
};

const isLocalDevelopmentHostname = (hostname: string): boolean => {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'localhost'
    || normalized === '0.0.0.0'
    || normalized === '127.0.0.1'
    || normalized === '::1'
    || normalized.endsWith('.localhost');
};

export const resolveSiteUrl = (request: Request, buildTimeSiteUrl?: string | null): string => {
  const envSiteUrl = resolveEnvSiteUrl();
  if (envSiteUrl) return envSiteUrl;

  const requestSiteUrl = detectRequestSiteUrl(request);
  const normalizedRequestSiteUrl = normalizeResolvedSiteUrl(requestSiteUrl);
  if (normalizedRequestSiteUrl) return normalizedRequestSiteUrl;

  const buildSiteUrl = sanitizeBaseUrl(buildTimeSiteUrl || undefined);
  const normalizedBuildSiteUrl = normalizeResolvedSiteUrl(buildSiteUrl);
  if (normalizedBuildSiteUrl) return normalizedBuildSiteUrl;

  return FALLBACK_SITE_URL;
};

export const resolveAuthSiteUrl = (request: Request, buildTimeSiteUrl?: string | null): string => {
  const configuredSiteUrl = resolveConfiguredSiteUrl(buildTimeSiteUrl);
  if (configuredSiteUrl) return configuredSiteUrl;

  const requestUrl = new URL(request.url);
  if (isLocalDevelopmentHostname(requestUrl.hostname)) {
    const requestOrigin = normalizeResolvedSiteUrl(sanitizeBaseUrl(requestUrl.origin));
    if (requestOrigin) return requestOrigin;
  }

  throw new Error('SITE_URL must be configured for auth redirects outside local development.');
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
