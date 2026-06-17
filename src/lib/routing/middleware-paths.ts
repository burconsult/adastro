const SETUP_ALLOWED_PREFIXES = [
  '/setup',
  '/installation',
  '/auth',
  '/api/auth',
  '/api/setup',
  '/_vercel',
  '/_image',
  '/_astro',
  '/images',
  '/scripts',
  '/favicon'
];

const STATIC_ASSET_PATTERN = /\.[a-z0-9]+$/i;

const LOCALE_REDIRECT_BYPASS_PREFIXES = [
  '/admin',
  '/api',
  '/auth',
  '/profile',
  '/setup',
  '/mcp',
  '/_vercel',
  '/_image',
  '/_astro',
  '/images',
  '/scripts',
  '/favicon',
  '/404',
  '/500'
];

const matchesPrefix = (pathname: string, prefix: string) => (
  pathname === prefix || pathname.startsWith(`${prefix}/`)
);

export const isStaticAssetPath = (pathname: string) => STATIC_ASSET_PATTERN.test(pathname);

export const shouldBypassSetupRedirect = (pathname: string) => {
  if (isStaticAssetPath(pathname)) return true;
  if (pathname === '/') return false;
  return SETUP_ALLOWED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
};

export const shouldRedirectToDefaultLocale = (pathname: string) => {
  if (isStaticAssetPath(pathname)) return false;
  return !LOCALE_REDIRECT_BYPASS_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
};
