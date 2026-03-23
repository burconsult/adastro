import {
  detectRequestSiteUrl,
  getRuntimeEnv,
  sanitizeBaseUrl
} from '@/lib/setup/runtime';
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

export { normalizeCanonicalSiteUrl, FALLBACK_SITE_URL };
