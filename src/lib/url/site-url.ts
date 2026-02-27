import {
  detectRequestSiteUrl,
  getRuntimeEnv,
  sanitizeBaseUrl
} from '@/lib/setup/runtime';

export const FALLBACK_SITE_URL = 'https://example.com';

export const resolveSiteUrl = (request: Request, buildTimeSiteUrl?: string | null): string => {
  const envSiteUrl = sanitizeBaseUrl((import.meta.env.SITE_URL as string | undefined) || getRuntimeEnv('SITE_URL'));
  if (envSiteUrl) return envSiteUrl;

  const requestSiteUrl = detectRequestSiteUrl(request);
  if (requestSiteUrl) return requestSiteUrl;

  const buildSiteUrl = sanitizeBaseUrl(buildTimeSiteUrl || undefined);
  if (buildSiteUrl) return buildSiteUrl;

  return FALLBACK_SITE_URL;
};
