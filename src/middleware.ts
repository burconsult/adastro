import { defineMiddleware } from 'astro:middleware';
import { canRoleAccessAdminPath } from './lib/auth/access-policy.js';
import { authService } from './lib/auth/auth-helpers.js';
import { isSameOriginRequest, isUnsafeMethod } from './lib/security/request-guards.js';
import { getSiteContentRouting, getSiteLocaleConfig } from './lib/site-config.js';
import { resolveLegacyBlogPath } from './lib/routing/articles.js';
import { supabaseAdmin } from './lib/supabase.js';
import { buildLocalizedPath, DEFAULT_LOCALE, resolveLocalePath } from './lib/i18n/locales.js';
import {
  hasRequiredSetupEnv,
  isMissingRelationError,
  normalizeBooleanSetting,
  SETUP_ALLOW_REENTRY_KEY,
  SETUP_COMPLETION_KEY
} from './lib/setup/runtime.js';

const SETUP_COMPLETION_CACHE_TTL_MS = 5000;
let setupCompletionCache: { completed: boolean; allowReentry: boolean; checkedAt: number } | null = null;
const CONTENT_ROUTING_CACHE_TTL_MS = 30000;
let contentRoutingCache:
  | { articleBasePath: string; articlePermalinkStyle: 'segment' | 'wordpress'; checkedAt: number }
  | null = null;
const LOCALE_CONFIG_CACHE_TTL_MS = 30000;
let localeConfigCache:
  | { defaultLocale: string; locales: string[]; checkedAt: number }
  | null = null;

const SETUP_ALLOWED_PREFIXES = [
  '/setup',
  '/installation',
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

const shouldRewriteLocalizedPublicRoute = (pathname: string) => (
  pathname === '/profile'
  || pathname === '/404'
  || pathname === '/500'
  || pathname === '/auth/callback'
  || pathname === '/auth/login'
  || pathname === '/auth/forgot-password'
  || pathname === '/auth/reset-password'
  || pathname === '/auth/unauthorized'
  || pathname.startsWith('/auth/oauth/')
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

const getSetupGateState = async (): Promise<{ completed: boolean; allowReentry: boolean }> => {
  if (!hasRequiredSetupEnv()) return { completed: false, allowReentry: false };

  const now = Date.now();
  if (setupCompletionCache && now - setupCompletionCache.checkedAt <= SETUP_COMPLETION_CACHE_TTL_MS) {
    return {
      completed: setupCompletionCache.completed,
      allowReentry: setupCompletionCache.allowReentry
    };
  }

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('site_settings')
      .select('key,value')
      .in('key', [SETUP_COMPLETION_KEY, SETUP_ALLOW_REENTRY_KEY]);

    if (error) {
      const message = String(error.message || '').toLowerCase();
      if (isMissingRelationError(message)) {
        setupCompletionCache = { completed: false, allowReentry: false, checkedAt: now };
        return { completed: false, allowReentry: false };
      }
      console.warn('Setup completion check failed:', error.message);
      setupCompletionCache = { completed: false, allowReentry: false, checkedAt: now };
      return { completed: false, allowReentry: false };
    }

    const rows = Array.isArray(data) ? data : [];
    const completionRow = rows.find((row: any) => row.key === SETUP_COMPLETION_KEY);
    const allowReentryRow = rows.find((row: any) => row.key === SETUP_ALLOW_REENTRY_KEY);

    const completed = normalizeBooleanSetting(completionRow?.value);
    const allowReentry = normalizeBooleanSetting(allowReentryRow?.value);

    setupCompletionCache = { completed, allowReentry, checkedAt: now };
    return { completed, allowReentry };
  } catch (error) {
    console.warn('Setup completion check failed:', error);
    setupCompletionCache = { completed: false, allowReentry: false, checkedAt: now };
    return { completed: false, allowReentry: false };
  }
};

const getContentRoutingForRewrite = async (): Promise<{ articleBasePath: string; articlePermalinkStyle: 'segment' | 'wordpress' }> => {
  const now = Date.now();
  if (contentRoutingCache && now - contentRoutingCache.checkedAt <= CONTENT_ROUTING_CACHE_TTL_MS) {
    return {
      articleBasePath: contentRoutingCache.articleBasePath,
      articlePermalinkStyle: contentRoutingCache.articlePermalinkStyle
    };
  }

  const routing = await getSiteContentRouting({ refresh: true });
  contentRoutingCache = {
    articleBasePath: routing.articleBasePath,
    articlePermalinkStyle: routing.articlePermalinkStyle,
    checkedAt: now
  };
  return routing;
};

const getLocaleConfigForRequest = async (): Promise<{ defaultLocale: string; locales: string[] }> => {
  const now = Date.now();
  if (localeConfigCache && now - localeConfigCache.checkedAt <= LOCALE_CONFIG_CACHE_TTL_MS) {
    return {
      defaultLocale: localeConfigCache.defaultLocale,
      locales: localeConfigCache.locales
    };
  }

  try {
    const localeConfig = await getSiteLocaleConfig({ refresh: true });
    localeConfigCache = {
      defaultLocale: localeConfig.defaultLocale || DEFAULT_LOCALE,
      locales: localeConfig.locales.length > 0 ? localeConfig.locales : [DEFAULT_LOCALE],
      checkedAt: now
    };
    return localeConfigCache;
  } catch (error) {
    console.warn('Locale config lookup failed. Falling back to default locale.', error);
    localeConfigCache = {
      defaultLocale: DEFAULT_LOCALE,
      locales: [DEFAULT_LOCALE],
      checkedAt: now
    };
    return localeConfigCache;
  }
};

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, redirect } = context;
  const localeConfig = await getLocaleConfigForRequest();
  const localePath = resolveLocalePath(url.pathname, localeConfig.locales, localeConfig.defaultLocale);
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
  const isAdminRoute = url.pathname.startsWith('/admin');
  const isProfileRoute = requestPolicyPath === '/profile' || requestPolicyPath.startsWith('/profile/');

  if (!hasRequiredSetupEnv() && !shouldBypassSetupRedirect(requestPolicyPath)) {
    return redirect('/setup');
  }

  if (hasRequiredSetupEnv()) {
    const setupGate = await getSetupGateState();

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
      const rewriteInput = localePath.hasLocalePrefix ? localePath.pathnameWithoutLocale : url.pathname;
      const rewritePath = resolveLegacyBlogPath(rewriteInput, {
        basePath: routing.articleBasePath,
        permalinkStyle: routing.articlePermalinkStyle
      });
      if (rewritePath && rewritePath !== rewriteInput) {
        const rewriteUrl = new URL(url);
        rewriteUrl.pathname = localePath.hasLocalePrefix
          ? `/${localePath.locale}${rewritePath}`
          : rewritePath;
        return context.rewrite(rewriteUrl);
      }
    } catch (routingError) {
      console.warn('Article routing rewrite skipped due to settings lookup error.', routingError);
    }
  }

  if (localePath.hasLocalePrefix && shouldRewriteLocalizedPublicRoute(localePath.pathnameWithoutLocale)) {
    const rewriteUrl = new URL(url);
    rewriteUrl.pathname = localePath.pathnameWithoutLocale;
    return context.rewrite(rewriteUrl);
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

  if (url.pathname.startsWith('/api')) {
    setHeader('Cache-Control', 'no-store');
  }

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https://*.supabase.co",
    "font-src 'self' https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
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
