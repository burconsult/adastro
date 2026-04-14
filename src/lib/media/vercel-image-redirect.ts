const ALLOWED_LOCAL_IMAGE_PATHS = new Set([
  '/favicon.svg',
  '/logo.svg'
]);

const ALLOWED_LOCAL_IMAGE_PREFIXES = [
  '/_astro/',
  '/images/'
];

const isAllowedLocalImagePath = (pathname: string): boolean => (
  ALLOWED_LOCAL_IMAGE_PATHS.has(pathname)
  || ALLOWED_LOCAL_IMAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
);

export const resolveLegacyVercelImageRedirect = (
  rawImageUrl: string | null,
  requestOrigin: string
): string | null => {
  if (!rawImageUrl) {
    return null;
  }

  try {
    const candidate = rawImageUrl.startsWith('/') && !rawImageUrl.startsWith('//')
      ? new URL(rawImageUrl, requestOrigin)
      : new URL(rawImageUrl);

    if (candidate.origin !== requestOrigin || !isAllowedLocalImagePath(candidate.pathname)) {
      return null;
    }

    return `${candidate.pathname}${candidate.search}`;
  } catch {
    return null;
  }
};
