import { SettingsService } from '@/lib/services/settings-service.js';
import type { BlogPost, Category, Tag } from '@/lib/types/index.js';
import { DEFAULT_LOCALE, isValidLocaleCode, normalizeLocaleCode } from './locales.js';

type LocaleValueMap = Record<string, string>;
type SlugLocaleValueMap = Record<string, LocaleValueMap>;

interface ContentLocalizationConfig {
  categoryLabelsByLocale: SlugLocaleValueMap;
  categoryDescriptionsByLocale: SlugLocaleValueMap;
  tagLabelsByLocale: SlugLocaleValueMap;
}

const DEFAULT_CONFIG: ContentLocalizationConfig = {
  categoryLabelsByLocale: {},
  categoryDescriptionsByLocale: {},
  tagLabelsByLocale: {}
};

let cachedConfig: ContentLocalizationConfig | null = null;
let loadingConfigPromise: Promise<ContentLocalizationConfig> | null = null;

const normalizeLocaleValueMap = (value: unknown): LocaleValueMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([locale, rawValue]) => {
      const normalizedLocale = isValidLocaleCode(locale) ? normalizeLocaleCode(locale, DEFAULT_LOCALE) : '';
      const normalizedValue = typeof rawValue === 'string' ? rawValue.trim() : '';
      if (!normalizedLocale || !normalizedValue) {
        return null;
      }
      return [normalizedLocale, normalizedValue] as const;
    })
    .filter((entry): entry is readonly [string, string] => Boolean(entry));

  return Object.fromEntries(entries);
};

const normalizeSlugLocaleValueMap = (value: unknown): SlugLocaleValueMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([slug, rawMap]) => {
      const normalizedSlug = slug.trim().toLowerCase();
      if (!normalizedSlug) {
        return null;
      }
      const normalizedMap = normalizeLocaleValueMap(rawMap);
      if (Object.keys(normalizedMap).length === 0) {
        return null;
      }
      return [normalizedSlug, normalizedMap] as const;
    })
    .filter((entry): entry is readonly [string, LocaleValueMap] => Boolean(entry));

  return Object.fromEntries(entries);
};

const resolveLocalizedValue = (
  localeMap: LocaleValueMap | undefined,
  locale: string,
  fallbackValue?: string
): string | undefined => {
  if (!localeMap) {
    return fallbackValue;
  }

  const normalizedLocale = normalizeLocaleCode(locale, DEFAULT_LOCALE);
  const languageCode = normalizedLocale.split('-')[0];
  const value = localeMap[normalizedLocale]
    || (languageCode && languageCode !== normalizedLocale ? localeMap[languageCode] : undefined)
    || localeMap[DEFAULT_LOCALE];

  return value || fallbackValue;
};

async function fetchContentLocalizationConfig(): Promise<ContentLocalizationConfig> {
  const settingsService = new SettingsService();
  const settings = await settingsService.getSettings([
    'content.categoryLabelsByLocale',
    'content.categoryDescriptionsByLocale',
    'content.tagLabelsByLocale'
  ]);

  return {
    categoryLabelsByLocale: normalizeSlugLocaleValueMap(settings['content.categoryLabelsByLocale']),
    categoryDescriptionsByLocale: normalizeSlugLocaleValueMap(settings['content.categoryDescriptionsByLocale']),
    tagLabelsByLocale: normalizeSlugLocaleValueMap(settings['content.tagLabelsByLocale'])
  };
}

export async function getContentLocalizationConfig(options?: { refresh?: boolean }): Promise<ContentLocalizationConfig> {
  if (options?.refresh) {
    cachedConfig = null;
    loadingConfigPromise = null;
  }

  if (cachedConfig) {
    return cachedConfig;
  }

  if (!loadingConfigPromise) {
    loadingConfigPromise = fetchContentLocalizationConfig()
      .catch((error) => {
        console.warn('Failed to load content localization settings. Falling back to defaults.', error);
        return DEFAULT_CONFIG;
      })
      .then((config) => {
        cachedConfig = config;
        return config;
      });
  }

  return loadingConfigPromise;
}

export async function localizeCategory(category: Category, locale: string): Promise<Category> {
  const config = await getContentLocalizationConfig();
  const normalizedSlug = category.slug.trim().toLowerCase();

  return {
    ...category,
    name: resolveLocalizedValue(config.categoryLabelsByLocale[normalizedSlug], locale, category.name) || category.name,
    description: resolveLocalizedValue(config.categoryDescriptionsByLocale[normalizedSlug], locale, category.description)
  };
}

export async function localizeTag(tag: Tag, locale: string): Promise<Tag> {
  const config = await getContentLocalizationConfig();
  const normalizedSlug = tag.slug.trim().toLowerCase();

  return {
    ...tag,
    name: resolveLocalizedValue(config.tagLabelsByLocale[normalizedSlug], locale, tag.name) || tag.name
  };
}

export async function localizeCategories(categories: Category[], locale: string): Promise<Category[]> {
  return Promise.all(categories.map((category) => localizeCategory(category, locale)));
}

export async function localizeTags(tags: Tag[], locale: string): Promise<Tag[]> {
  return Promise.all(tags.map((tag) => localizeTag(tag, locale)));
}

export async function localizeBlogPost(post: BlogPost, locale: string): Promise<BlogPost> {
  const [categories, tags] = await Promise.all([
    localizeCategories(post.categories ?? [], locale),
    localizeTags(post.tags ?? [], locale)
  ]);

  return {
    ...post,
    categories,
    tags
  };
}

export async function localizeBlogPosts(posts: BlogPost[], locale: string): Promise<BlogPost[]> {
  return Promise.all(posts.map((post) => localizeBlogPost(post, locale)));
}
