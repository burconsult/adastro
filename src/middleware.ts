import { defineMiddleware } from 'astro:middleware';
import { canRoleAccessAdminPath } from './lib/auth/access-policy.js';
import { authService } from './lib/auth/auth-helpers.js';
import {
  HTML_BROWSER_CACHE_CONTROL,
  HTML_CDN_CACHE_CONTROL,
  HTML_NETLIFY_CDN_CACHE_CONTROL,
  HTML_VERCEL_CDN_CACHE_CONTROL,
  NO_STORE_CACHE_CONTROL,
  shouldApplyHtmlCdnCache,
  shouldForceNoStore
} from './lib/http/cache-policy.js';
import { isSameOriginRequest, isUnsafeMethod } from './lib/security/request-guards.js';
import { getSiteContentRouting, getSiteLocaleConfig } from './lib/site-config.js';
import { resolveLegacyBlogPath } from './lib/routing/articles.js';
import { buildLocalizedPath, DEFAULT_LOCALE, resolveLocalePath } from './lib/i18n/locales.js';
import {
  getContentRoutingRuntimeCache,
  getLocaleConfigRuntimeCache,
  setContentRoutingRuntimeCache,
  setLocaleConfigRuntimeCache
} from './lib/runtime-config-cache.js';
import { hasRequiredSetupEnv } from './lib/setup/runtime.js';
import { getSetupGateState } from './lib/setup/gate.js';

const CONTENT_ROUTING_CACHE_TTL_MS = 30000;
const LOCALE_CONFIG_CACHE_TTL_MS = 30000;

const SETUP_ALLOWED_PREFIXES = [
  '/setup',
  '/installation',
  '/auth',
  '/api/auth',
  '/api/setup',
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
  '/_astro',
  '/images',
  '/scripts',
  '/favicon',
  '/404',
  '/500'
];

const getRequestPolicyPath = (pathname: string, localePath: { hasLocalePrefix: boolean; pathnameWithoutLocale: string }) => (
  localePath.hasLocalePrefix ? localePath.pathnameWithoutLocale : pathname
);

const shouldBypassSetupRedirect = (pathname: string) => {
  if (STATIC_ASSET_PATTERN.test(pathname)) return true;
  if (pathname === '/') return false;
  return SETUP_ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
};

const shouldRedirectToDefaultLocale = (pathname: string) => {
  if (STATIC_ASSET_PATTERN.test(pathname)) return false;
  return !LOCALE_REDIRECT_BYPASS_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
};

const getContentRoutingForRewrite = async (): Promise<{ articleBasePath: string; articlePermalinkStyle: 'segment' | 'wordpress' }> => {
  const now = Date.now();
  const cachedContentRouting = getContentRoutingRuntimeCache();
  if (cachedContentRouting && now - cachedContentRouting.checkedAt <= CONTENT_ROUTING_CACHE_TTL_MS) {
    return {
      articleBasePath: cachedContentRouting.articleBasePath,
      articlePermalinkStyle: cachedContentRouting.articlePermalinkStyle
    };
  }

  const routing = await getSiteContentRouting({ refresh: true });
  setContentRoutingRuntimeCache({
    articleBasePath: routing.articleBasePath,
    articlePermalinkStyle: routing.articlePermalinkStyle,
    checkedAt: now
  });
  return routing;
};

const getLocaleConfigForRequest = async (): Promise<{ defaultLocale: string; locales: string[] }> => {
  const now = Date.now();
  const cachedLocaleConfig = getLocaleConfigRuntimeCache();
  if (cachedLocaleConfig && now - cachedLocaleConfig.checkedAt <= LOCALE_CONFIG_CACHE_TTL_MS) {
    return {
      defaultLocale: cachedLocaleConfig.defaultLocale,
      locales: cachedLocaleConfig.locales
    };
  }

  try {
    const localeConfig = await getSiteLocaleConfig({ refresh: true });
    const nextLocaleConfig = {
      defaultLocale: localeConfig.defaultLocale || DEFAULT_LOCALE,
      locales: localeConfig.locales.length > 0 ? localeConfig.locales : [DEFAULT_LOCALE],
      checkedAt: now
    };
    setLocaleConfigRuntimeCache(nextLocaleConfig);
    return nextLocaleConfig;
  } catch (error) {
    console.warn('Locale config lookup failed. Falling back to default locale.', error);
    const fallbackLocaleConfig = {
      defaultLocale: DEFAULT_LOCALE,
      locales: [DEFAULT_LOCALE],
      checkedAt: now
    };
    setLocaleConfigRuntimeCache(fallbackLocaleConfig);
    return fallbackLocaleConfig;
  }
};

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, redirect } = context;
  const localeConfig = await getLocaleConfigForRequest();
  const originalRequestPathname = typeof context.locals.requestPathname === 'string' && context.locals.requestPathname.length > 0
    ? context.locals.requestPathname
    : url.pathname;
  const requestLocalePath = resolveLocalePath(url.pathname, localeConfig.locales, localeConfig.defaultLocale);
  const originalLocalePath = originalRequestPathname !== url.pathname
    ? resolveLocalePath(originalRequestPathname, localeConfig.locales, localeConfig.defaultLocale)
    : requestLocalePath;
  const localePath = originalLocalePath.hasLocalePrefix ? originalLocalePath : requestLocalePath;
  const requestPolicyPath = getRequestPolicyPath(url.pathname, localePath);
  context.locals.locale = localePath.locale;
  context.locals.defaultLocale = localeConfig.defaultLocale;
  context.locals.supportedLocales = localeConfig.locales;
  context.locals.hasLocalePrefix = localePath.hasLocalePrefix;
  context.locals.localizedPath = localePath.pathnameWithoutLocale;
  if (typeof context.locals.requestPathname !== 'string' || context.locals.requestPathname.length === 0) {
    context.locals.requestPathname = url.pathname;
  }

  const isSetupRoute = requestPolicyPath === '/setup' || requestPolicyPath.startsWith('/setup/');
  const isSetupApiRoute = url.pathname === '/api/setup' || url.pathname.startsWith('/api/setup/');
  const isAdminRoute = url.pathname.startsWith('/admin');
  const isProfileRoute = requestPolicyPath === '/profile' || requestPolicyPath.startsWith('/profile/');

  if (!hasRequiredSetupEnv() && !shouldBypassSetupRedirect(requestPolicyPath)) {
    return redirect('/setup');
  }

  if (hasRequiredSetupEnv()) {
    const setupGate = await getSetupGateState();

    if (setupGate.completed && (isSetupRoute || isSetupApiRoute)) {
      try {
        const user = await authService.getUserFromRequest(context.request);
        if (!user) {
          if (isSetupApiRoute) {
            return new Response(JSON.stringify({ error: 'Authentication required.' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
            });
          }

          if (!setupGate.allowReentry && isSetupRoute) {
            return redirect('/');
          }

          const requestedPath = `${url.pathname}${url.search}`;
          const loginPath = localePath.hasLocalePrefix
            ? buildLocalizedPath('/auth/login', localePath.locale)
            : '/auth/login';
          return redirect(`${loginPath}?redirect=${encodeURIComponent(requestedPath)}`);
        }

        if (user.role !== 'admin') {
          if (isSetupApiRoute) {
            return new Response(JSON.stringify({ error: 'Admin access required.' }), {
              status: 403,
              headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
            });
          }

          if (!setupGate.allowReentry && isSetupRoute) {
            return redirect('/');
          }

          const unauthorizedPath = localePath.hasLocalePrefix
            ? buildLocalizedPath('/auth/unauthorized', localePath.locale)
            : '/auth/unauthorized';
          return redirect(unauthorizedPath);
        }

        context.locals.user = user;
      } catch (error) {
        if (isSetupApiRoute) {
          return new Response(JSON.stringify({ error: 'Authentication required.' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
          });
        }
        return redirect('/auth/login?error=auth_error');
      }
    }

    if (isSetupRoute && setupGate.completed && !setupGate.allowReentry) {
      return redirect('/');
    }

    if (!shouldBypassSetupRedirect(requestPolicyPath) && !setupGate.completed) {
      return redirect('/setup');
    }
  }

  if (
    !localePath.hasLocalePrefix
    && (context.request.method === 'GET' || context.request.method === 'HEAD')
  ) {
    const localeLikePrefix = /^\/([a-z]{2})(?:\/(.*))?$/i.exec(url.pathname);
    if (localeLikePrefix) {
      const candidateLocale = localeLikePrefix[1].toLowerCase();
      if (!localeConfig.locales.includes(candidateLocale)) {
        const remainder = localeLikePrefix[2] ? `/${localeLikePrefix[2]}` : '/';
        const localizedUrl = new URL(url);
        localizedUrl.pathname = buildLocalizedPath(remainder, localeConfig.defaultLocale);
        return redirect(`${localizedUrl.pathname}${localizedUrl.search}`, 308);
      }
    }
  }

  if (
    !localePath.hasLocalePrefix
    && (context.request.method === 'GET' || context.request.method === 'HEAD')
    && shouldRedirectToDefaultLocale(requestPolicyPath)
  ) {
    const localizedUrl = new URL(url);
    localizedUrl.pathname = buildLocalizedPath(url.pathname, localeConfig.defaultLocale);
    return redirect(`${localizedUrl.pathname}${localizedUrl.search}`, 308);
  }

  if (url.pathname.startsWith('/api') && isUnsafeMethod(context.request.method)) {
    if (!isSameOriginRequest(context.request, url.origin)) {
      return new Response(JSON.stringify({ error: 'Cross-origin requests are not allowed.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      });
    }
  }

  if (
    !url.pathname.startsWith('/api')
    && !url.pathname.startsWith('/admin')
    && requestPolicyPath !== '/profile'
    && !requestPolicyPath.startsWith('/auth')
  ) {
    try {
      const routing = await getContentRoutingForRewrite();
      const rewriteInput = requestLocalePath.hasLocalePrefix ? requestLocalePath.pathnameWithoutLocale : url.pathname;
      const rewritePath = resolveLegacyBlogPath(rewriteInput, {
        basePath: routing.articleBasePath,
        permalinkStyle: routing.articlePermalinkStyle
      });
      if (rewritePath && rewritePath !== rewriteInput) {
        const rewriteUrl = new URL(url);
        rewriteUrl.pathname = requestLocalePath.hasLocalePrefix
          ? `/${requestLocalePath.locale}${rewritePath}`
          : rewritePath;
        return context.rewrite(rewriteUrl);
      }
    } catch (routingError) {
      console.warn('Article routing rewrite skipped due to settings lookup error.', routingError);
    }
  }

  // Protect authenticated app routes
  if (isAdminRoute || isProfileRoute) {
    try {
      const user = await authService.getUserFromRequest(context.request);
      if (!user) {
        const requestedPath = `${url.pathname}${url.search}`;
        const loginPath = localePath.hasLocalePrefix
          ? buildLocalizedPath('/auth/login', localePath.locale)
          : '/auth/login';
        return redirect(`${loginPath}?redirect=${encodeURIComponent(requestedPath)}`);
      }

      if (isAdminRoute && !canRoleAccessAdminPath(user.role, url.pathname)) {
        const unauthorizedPath = localePath.hasLocalePrefix
          ? buildLocalizedPath('/auth/unauthorized', localePath.locale)
          : '/auth/unauthorized';
        return redirect(unauthorizedPath);
      }
      
      context.locals.user = user;
    } catch (error) {
      console.error('Auth middleware error:', error);
      return redirect('/auth/login?error=auth_error');
    }
  }
  
  const response = await next();
  let mutableResponse = response;
  let headers = mutableResponse.headers;

  const ensureMutableHeaders = () => {
    if (mutableResponse !== response) return;
    mutableResponse = new Response(response.body, response);
    headers = mutableResponse.headers;
  };

  const setHeader = (name: string, value: string) => {
    try {
      headers.set(name, value);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('immutable')) {
        ensureMutableHeaders();
        headers.set(name, value);
        return;
      }
      throw error;
    }
  };

  const deleteHeader = (name: string) => {
    try {
      headers.delete(name);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('immutable')) {
        ensureMutableHeaders();
        headers.delete(name);
        return;
      }
      throw error;
    }
  };

  setHeader('X-Content-Type-Options', 'nosniff');
  setHeader('X-Frame-Options', 'DENY');
  setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  if (url.protocol === 'https:') {
    setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  const contentType = headers.get('content-type');

  if (shouldForceNoStore({
    request: context.request,
    pathname: url.pathname,
    requestPolicyPath,
    contentType
  })) {
    setHeader('Cache-Control', NO_STORE_CACHE_CONTROL);
    deleteHeader('CDN-Cache-Control');
    deleteHeader('Netlify-CDN-Cache-Control');
    deleteHeader('Vercel-CDN-Cache-Control');
  } else if (shouldApplyHtmlCdnCache({
    request: context.request,
    pathname: url.pathname,
    requestPolicyPath,
    responseStatus: mutableResponse.status,
    contentType
  })) {
    setHeader('Cache-Control', HTML_BROWSER_CACHE_CONTROL);
    setHeader('CDN-Cache-Control', HTML_CDN_CACHE_CONTROL);
    setHeader('Netlify-CDN-Cache-Control', HTML_NETLIFY_CDN_CACHE_CONTROL);
    setHeader('Vercel-CDN-Cache-Control', HTML_VERCEL_CDN_CACHE_CONTROL);
    setHeader('Vary', 'Cookie');
  }

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://*.supabase.co",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https://*.supabase.co",
    "font-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'",
    "script-src-attr 'none'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "form-action 'self'",
    'upgrade-insecure-requests'
  ].join('; ');
  setHeader('Content-Security-Policy', csp);

  deleteHeader('x-supabase-api-version');

  return mutableResponse;
});
