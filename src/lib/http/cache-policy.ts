import { ACCESS_TOKEN_COOKIE } from '@/lib/auth/cookies.js';

const STATIC_ASSET_PATTERN = /\.[a-z0-9]+$/i;
const PRIVATE_ROUTE_PREFIXES = ['/admin', '/api', '/auth', '/profile', '/setup', '/mcp'];
const NON_CACHEABLE_PUBLIC_PREFIXES = ['/search'];

export const HTML_BROWSER_CACHE_CONTROL = 'public, max-age=0, must-revalidate';
export const HTML_CDN_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=86400';
export const HTML_VERCEL_CDN_CACHE_CONTROL = HTML_CDN_CACHE_CONTROL;
export const NO_STORE_CACHE_CONTROL = 'no-store';

const hasPrefixedPath = (pathname: string, prefixes: string[]) => (
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
);

export const hasCookie = (request: Request, cookieName = ACCESS_TOKEN_COOKIE): boolean => {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return false;

  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .some((cookie) => cookie.startsWith(`${cookieName}=`));
};

export const isPrivateAppPath = (requestPolicyPath: string): boolean => (
  hasPrefixedPath(requestPolicyPath, PRIVATE_ROUTE_PREFIXES)
);

const isCacheablePublicPath = (requestPolicyPath: string, pathname: string): boolean => {
  if (STATIC_ASSET_PATTERN.test(pathname)) return false;
  if (isPrivateAppPath(requestPolicyPath)) return false;
  if (hasPrefixedPath(requestPolicyPath, NON_CACHEABLE_PUBLIC_PREFIXES)) return false;
  return true;
};

export const shouldForceNoStore = ({
  request,
  pathname,
  requestPolicyPath,
  contentType
}: {
  request: Request;
  pathname: string;
  requestPolicyPath: string;
  contentType: string | null;
}): boolean => {
  if (pathname.startsWith('/api')) return true;

  const normalizedContentType = (contentType || '').toLowerCase();
  if (!normalizedContentType.includes('text/html')) return false;

  return isPrivateAppPath(requestPolicyPath) || hasCookie(request);
};

export const shouldApplyHtmlCdnCache = ({
  request,
  pathname,
  requestPolicyPath,
  responseStatus,
  contentType
}: {
  request: Request;
  pathname: string;
  requestPolicyPath: string;
  responseStatus: number;
  contentType: string | null;
}): boolean => {
  if (responseStatus !== 200) return false;

  const method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return false;

  const normalizedContentType = (contentType || '').toLowerCase();
  if (!normalizedContentType.includes('text/html')) return false;

  if (hasCookie(request)) return false;

  return isCacheablePublicPath(requestPolicyPath, pathname);
};
