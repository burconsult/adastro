export type ArticlePermalinkStyle = 'segment' | 'wordpress';

export interface ArticleRoutingConfig {
  basePath: string;
  permalinkStyle: ArticlePermalinkStyle;
  localePrefix?: string;
}

export const DEFAULT_ARTICLE_ROUTING: ArticleRoutingConfig = {
  basePath: 'blog',
  permalinkStyle: 'segment'
};

const SEGMENT_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_BASE_PATHS = new Set([
  'admin',
  'api',
  'auth',
  'setup',
  'category',
  'tag',
  'author',
  'profile',
  'contact',
  'about'
]);

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, '');
const defaultArticlesPrefix = `/${DEFAULT_ARTICLE_ROUTING.basePath}`;
const normalizeLocalePrefix = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const normalized = trimSlashes(value.trim().toLowerCase());
  return normalized.length > 0 ? normalized : '';
};
const applyLocalePrefix = (pathname: string, localePrefix?: string): string => {
  const normalizedLocale = normalizeLocalePrefix(localePrefix);
  if (!normalizedLocale) return pathname;
  if (pathname === '/') return `/${normalizedLocale}`;
  return `/${normalizedLocale}${pathname}`;
};

const pad = (value: number) => String(value).padStart(2, '0');

const normalizeDate = (value: Date | string | null | undefined): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const normalizeArticleBasePath = (value: unknown): string => {
  const raw = typeof value === 'string' ? trimSlashes(value.trim().toLowerCase()) : '';
  if (!raw) return DEFAULT_ARTICLE_ROUTING.basePath;
  if (!SEGMENT_RE.test(raw)) return DEFAULT_ARTICLE_ROUTING.basePath;
  if (RESERVED_BASE_PATHS.has(raw)) return DEFAULT_ARTICLE_ROUTING.basePath;
  return raw;
};

export const normalizeArticlePermalinkStyle = (value: unknown): ArticlePermalinkStyle =>
  value === 'wordpress' ? 'wordpress' : 'segment';

export const normalizeArticleRoutingConfig = (config: Partial<ArticleRoutingConfig> | null | undefined): ArticleRoutingConfig => ({
  basePath: normalizeArticleBasePath(config?.basePath),
  permalinkStyle: normalizeArticlePermalinkStyle(config?.permalinkStyle),
  localePrefix: normalizeLocalePrefix(config?.localePrefix)
});

export const buildArticlesIndexPath = (config: Partial<ArticleRoutingConfig> | null | undefined): string => {
  const normalized = normalizeArticleRoutingConfig(config);
  return applyLocalePrefix(`/${normalized.basePath}`, normalized.localePrefix);
};

export const buildArticlesPagePath = (page: number, config: Partial<ArticleRoutingConfig> | null | undefined): string => {
  const normalized = normalizeArticleRoutingConfig(config);
  const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  const basePath = safePage <= 1
    ? `/${normalized.basePath}`
    : `/${normalized.basePath}/page/${safePage}/`;
  return applyLocalePrefix(basePath, normalized.localePrefix);
};

export const buildArticlePostPath = (
  slug: string,
  publishedAt: Date | string | null | undefined,
  config: Partial<ArticleRoutingConfig> | null | undefined
): string => {
  const normalized = normalizeArticleRoutingConfig(config);
  const safeSlug = trimSlashes((slug || '').trim());
  if (!safeSlug) return buildArticlesIndexPath(normalized);

  if (normalized.permalinkStyle === 'wordpress') {
    const date = normalizeDate(publishedAt);
    if (date) {
      return applyLocalePrefix(
        `/${date.getUTCFullYear()}/${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}/${safeSlug}/`,
        normalized.localePrefix
      );
    }
  }

  return applyLocalePrefix(`/${normalized.basePath}/${safeSlug}/`, normalized.localePrefix);
};

export const applyArticleBasePathToHref = (
  href: string,
  config: Partial<ArticleRoutingConfig> | null | undefined
): string => {
  const normalized = normalizeArticleRoutingConfig(config);
  const localePrefix = normalized.localePrefix ? `/${normalized.localePrefix}` : '';
  const targetPrefix = `/${normalized.basePath}`;
  const normalizedHref = localePrefix && href.startsWith(localePrefix)
    ? href.slice(localePrefix.length) || '/'
    : href;
  if (normalizedHref === defaultArticlesPrefix || normalizedHref === `${defaultArticlesPrefix}/`) {
    return `${localePrefix}${targetPrefix}`;
  }
  if (normalizedHref.startsWith(`${defaultArticlesPrefix}/`)) {
    return `${localePrefix}${targetPrefix}${normalizedHref.slice(defaultArticlesPrefix.length)}`;
  }
  return href;
};

const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const resolveLegacyBlogPath = (
  pathname: string,
  config: Partial<ArticleRoutingConfig> | null | undefined
): string | null => {
  const normalized = normalizeArticleRoutingConfig(config);

  const wpMatch = pathname.match(/^\/(\d{4})\/(\d{2})\/(\d{2})\/([^/]+)\/?$/);
  if (normalized.permalinkStyle === 'wordpress' && wpMatch) {
    return `${defaultArticlesPrefix}/${wpMatch[4]}/`;
  }

  if (normalized.basePath === DEFAULT_ARTICLE_ROUTING.basePath) return null;

  const escapedBase = escapeRe(normalized.basePath);
  if (new RegExp(`^/${escapedBase}/?$`).test(pathname)) {
    return defaultArticlesPrefix;
  }

  const pageMatch = pathname.match(new RegExp(`^/${escapedBase}/page/(\\d+)/?$`));
  if (pageMatch) {
    return `${defaultArticlesPrefix}/page/${pageMatch[1]}/`;
  }

  const postMatch = pathname.match(new RegExp(`^/${escapedBase}/([^/]+)/?$`));
  if (postMatch && postMatch[1] !== 'page') {
    return `${defaultArticlesPrefix}/${postMatch[1]}/`;
  }

  return null;
};
