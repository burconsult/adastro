export const DEFAULT_LOCALE = 'en';

const LOCALE_CODE_RE = /^[a-z]{2}(?:-[a-z]{2})?$/;

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, '');

const ensureLeadingSlash = (value: string) => (value.startsWith('/') ? value : `/${value}`);

const normalizePathname = (value: string): string => {
  const normalized = ensureLeadingSlash((value || '/').trim());
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
};

export const isValidLocaleCode = (value: unknown): value is string => (
  typeof value === 'string' && LOCALE_CODE_RE.test(value.trim().toLowerCase())
);

export const normalizeLocaleCode = (value: unknown, fallback = DEFAULT_LOCALE): string => {
  if (!isValidLocaleCode(value)) return fallback;
  return value.trim().toLowerCase();
};

export const normalizeLocaleList = (value: unknown, fallback = DEFAULT_LOCALE): string[] => {
  if (!Array.isArray(value)) return [fallback];
  const deduped = Array.from(new Set(
    value
      .map((entry) => normalizeLocaleCode(entry, ''))
      .filter((entry) => entry.length > 0)
  ));
  return deduped.length > 0 ? deduped : [fallback];
};

export const ensureDefaultLocaleInList = (defaultLocale: string, locales: string[]): string[] => (
  locales.includes(defaultLocale) ? locales : [defaultLocale, ...locales]
);

export type LocalePathResolution = {
  hasLocalePrefix: boolean;
  locale: string;
  pathnameWithoutLocale: string;
};

export const resolveLocalePath = (
  pathname: string,
  locales: string[],
  defaultLocale: string
): LocalePathResolution => {
  const normalized = normalizePathname(pathname);
  const segments = trimSlashes(normalized).split('/').filter(Boolean);

  if (segments.length === 0) {
    return {
      hasLocalePrefix: false,
      locale: defaultLocale,
      pathnameWithoutLocale: '/'
    };
  }

  const firstSegment = segments[0].toLowerCase();
  if (!locales.includes(firstSegment)) {
    return {
      hasLocalePrefix: false,
      locale: defaultLocale,
      pathnameWithoutLocale: normalized
    };
  }

  const remaining = segments.slice(1).join('/');
  return {
    hasLocalePrefix: true,
    locale: firstSegment,
    pathnameWithoutLocale: remaining.length > 0 ? `/${remaining}` : '/'
  };
};

export const buildLocalizedPath = (pathname: string, locale: string): string => {
  const normalizedPathname = normalizePathname(pathname);
  const safeLocale = normalizeLocaleCode(locale, DEFAULT_LOCALE);
  if (normalizedPathname === '/') return `/${safeLocale}`;
  return `/${safeLocale}${normalizedPathname}`;
};

export const localizeHref = (
  href: string,
  locale: string,
  options?: { skipPrefixes?: string[] }
): string => {
  if (typeof href !== 'string') return href;
  const trimmed = href.trim();
  if (!trimmed) return trimmed;
  if (!trimmed.startsWith('/')) return trimmed;
  if (trimmed.startsWith('//')) return trimmed;

  const [path, query = ''] = trimmed.split('?');
  const skipPrefixes = options?.skipPrefixes ?? [];
  const normalizedPath = normalizePathname(path);
  const safeLocale = normalizeLocaleCode(locale, DEFAULT_LOCALE);
  if (normalizedPath === `/${safeLocale}` || normalizedPath.startsWith(`/${safeLocale}/`)) {
    return trimmed;
  }
  if (skipPrefixes.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`))) {
    return trimmed;
  }

  const localizedPath = buildLocalizedPath(normalizedPath, safeLocale);
  return query.length > 0 ? `${localizedPath}?${query}` : localizedPath;
};

export const toHtmlLang = (locale: string): string => normalizeLocaleCode(locale, DEFAULT_LOCALE);

export const toOpenGraphLocale = (locale: string): string => {
  const normalized = normalizeLocaleCode(locale, DEFAULT_LOCALE);
  if (normalized === 'nb') return 'nb_NO';
  const [language, region] = normalized.split('-');
  if (region) {
    return `${language}_${region.toUpperCase()}`;
  }
  return `${language}_${language.toUpperCase()}`;
};

export const toIntlLocale = (locale: string): string => {
  const normalized = normalizeLocaleCode(locale, DEFAULT_LOCALE);
  if (normalized === 'nb') return 'nb-NO';
  const [language, region] = normalized.split('-');
  return region ? `${language}-${region.toUpperCase()}` : language;
};

export const toRssLanguageCode = (locale: string): string => {
  const normalized = normalizeLocaleCode(locale, DEFAULT_LOCALE);
  if (normalized === 'en') return 'en-us';
  if (normalized === 'nb') return 'nb-no';
  if (normalized.includes('-')) return normalized.toLowerCase();
  return `${normalized.toLowerCase()}-${normalized.toLowerCase()}`;
};
