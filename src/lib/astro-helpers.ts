import { PostRepository } from './database/repositories/post-repository.js';
import { PageRepository } from './database/repositories/page-repository.js';
import { CategoryRepository } from './database/repositories/category-repository.js';
import { TagRepository } from './database/repositories/tag-repository.js';
import { getSiteLocaleConfig } from './site-config.js';
import {
  localizeBlogPost,
  localizeBlogPosts,
  localizeCategories,
  localizeCategory,
  localizeTag,
  localizeTags
} from './i18n/content-localizations.js';
import type { BlogPost, Category, Tag, PostFilters, Page } from './types/index.js';
import { DEFAULT_LOCALE, normalizeLocaleCode } from './i18n/locales.js';

const postRepo = new PostRepository();
const pageRepo = new PageRepository();
const categoryRepo = new CategoryRepository();
const tagRepo = new TagRepository();

const FALLBACK_WARNING_PREFIX = '[setup-fallback]';

type LocalizedLookupOptions = {
  locale?: string;
  includeFallback?: boolean;
  fallbackLocale?: string;
};

async function withFallback<T>(scope: string, fallback: T, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.warn(`${FALLBACK_WARNING_PREFIX} ${scope} failed; returning fallback value.`, error);
    return fallback;
  }
}

async function resolveLocaleSequence(options?: LocalizedLookupOptions): Promise<string[]> {
  const localeConfig = await getSiteLocaleConfig();
  const defaultLocale = normalizeLocaleCode(localeConfig.defaultLocale, DEFAULT_LOCALE);
  const requestedLocale = normalizeLocaleCode(options?.locale, defaultLocale);
  const fallbackLocale = normalizeLocaleCode(options?.fallbackLocale, defaultLocale);

  if (options?.includeFallback === false) {
    return [requestedLocale];
  }

  return Array.from(new Set([requestedLocale, fallbackLocale, defaultLocale]));
}

export async function getPublishedPosts(limit?: number, offset?: number, locale?: string): Promise<BlogPost[]> {
  return withFallback('getPublishedPosts', [], async () => {
    const normalizedLocale = locale ? normalizeLocaleCode(locale, DEFAULT_LOCALE) : undefined;
    const filters: PostFilters = {
      status: 'published',
      limit,
      offset,
      ...(normalizedLocale ? { locale: normalizedLocale } : {})
    };

    const posts = await postRepo.findWithFilters(filters);
    const sortedPosts = posts.sort((a, b) => {
      const aDate = a.publishedAt || a.createdAt;
      const bDate = b.publishedAt || b.createdAt;
      return bDate.getTime() - aDate.getTime();
    });

    return normalizedLocale
      ? localizeBlogPosts(sortedPosts, normalizedLocale)
      : sortedPosts;
  });
}

export async function getPublishedPostBySlug(slug: string, options?: LocalizedLookupOptions): Promise<BlogPost | null> {
  return withFallback('getPublishedPostBySlug', null, async () => {
    const locales = await resolveLocaleSequence(options);
    const post = await postRepo.findBySlugInLocales(slug, locales);
    if (!post || post.status !== 'published') {
      return null;
    }
    const requestedLocale = normalizeLocaleCode(options?.locale, DEFAULT_LOCALE);
    return localizeBlogPost(post, requestedLocale);
  });
}

export async function getPublishedPages(locale?: string): Promise<Page[]> {
  return withFallback('getPublishedPages', [], async () => {
    const pages = await pageRepo.findWithFilters({
      status: 'published',
      ...(locale ? { locale: normalizeLocaleCode(locale, DEFAULT_LOCALE) } : {})
    });
    return pages.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  });
}

export async function getPublishedPageBySlug(slug: string, options?: LocalizedLookupOptions): Promise<Page | null> {
  return withFallback('getPublishedPageBySlug', null, async () => {
    const locales = await resolveLocaleSequence(options);
    const page = await pageRepo.findBySlugInLocales(slug, locales);
    if (!page || page.status !== 'published') {
      return null;
    }
    return page;
  });
}

export async function getPostsByTag(
  tagSlug: string,
  limit?: number,
  offset?: number,
  locale?: string
): Promise<BlogPost[]> {
  return withFallback('getPostsByTag', [], async () => {
    const tag = await tagRepo.findBySlug(tagSlug);
    if (!tag) {
      return [];
    }

    const filters: PostFilters = {
      status: 'published',
      tagId: tag.id,
      limit,
      offset,
      ...(locale ? { locale: normalizeLocaleCode(locale, DEFAULT_LOCALE) } : {})
    };

    const posts = await postRepo.findWithFilters(filters);
    const sortedPosts = posts.sort((a, b) => {
      const aDate = a.publishedAt || a.createdAt;
      const bDate = b.publishedAt || b.createdAt;
      return bDate.getTime() - aDate.getTime();
    });
    return locale ? localizeBlogPosts(sortedPosts, locale) : sortedPosts;
  });
}

export async function getPostsByCategory(
  categorySlug: string,
  limit?: number,
  offset?: number,
  locale?: string
): Promise<BlogPost[]> {
  return withFallback('getPostsByCategory', [], async () => {
    const category = await categoryRepo.findBySlug(categorySlug);
    if (!category) {
      return [];
    }

    const filters: PostFilters = {
      status: 'published',
      categoryId: category.id,
      limit,
      offset,
      ...(locale ? { locale: normalizeLocaleCode(locale, DEFAULT_LOCALE) } : {})
    };

    const posts = await postRepo.findWithFilters(filters);
    const sortedPosts = posts.sort((a, b) => {
      const aDate = a.publishedAt || a.createdAt;
      const bDate = b.publishedAt || b.createdAt;
      return bDate.getTime() - aDate.getTime();
    });
    return locale ? localizeBlogPosts(sortedPosts, locale) : sortedPosts;
  });
}

export async function getTagsWithPosts(locale?: string): Promise<Tag[]> {
  return withFallback('getTagsWithPosts', [], async () => {
    const tags = await tagRepo.findAllWithStats();
    const filteredTags = tags
      .filter((tag) => (tag.postCount ?? 0) > 0)
      .map((tag) => ({ ...tag, postCount: tag.postCount }));
    return locale ? localizeTags(filteredTags, locale) : filteredTags;
  });
}

export async function getCategoriesWithPosts(locale?: string): Promise<Category[]> {
  return withFallback('getCategoriesWithPosts', [], async () => {
    const categories = await categoryRepo.findAllWithStats();
    const filteredCategories = categories
      .filter((category) => (category.postCount ?? 0) > 0)
      .map((category) => ({ ...category, postCount: category.postCount }));
    return locale ? localizeCategories(filteredCategories, locale) : filteredCategories;
  });
}

export async function getPostStaticPaths(options?: { locale?: string; includeLocaleParam?: boolean }) {
  const locale = options?.locale;
  const posts = await getPublishedPosts(undefined, undefined, locale);
  return posts.map((post) => ({
    params: options?.includeLocaleParam
      ? { locale: locale || post.locale, slug: post.slug }
      : { slug: post.slug },
    props: { post }
  }));
}

export async function getPageStaticPaths(options?: { locale?: string; includeLocaleParam?: boolean }) {
  const locale = options?.locale;
  const pages = await getPublishedPages(locale);
  return pages.map((page) => ({
    params: options?.includeLocaleParam
      ? { locale: locale || page.locale, slug: page.slug }
      : { slug: page.slug },
    props: { page }
  }));
}

export async function getTagStaticPaths() {
  const tags = await getTagsWithPosts();
  return tags.map((tag) => ({
    params: { tag: tag.slug },
    props: { tag }
  }));
}

export async function getCategoryStaticPaths() {
  const categories = await getCategoriesWithPosts();
  return categories.map((category) => ({
    params: { category: category.slug },
    props: { category }
  }));
}

export async function getLocalizedTagBySlug(slug: string, locale: string): Promise<Tag | null> {
  return withFallback('getLocalizedTagBySlug', null, async () => {
    const tag = await tagRepo.findBySlug(slug);
    if (!tag) {
      return null;
    }
    return localizeTag(tag, locale);
  });
}

export async function getLocalizedCategoryBySlug(slug: string, locale: string): Promise<Category | null> {
  return withFallback('getLocalizedCategoryBySlug', null, async () => {
    const category = await categoryRepo.findBySlug(slug);
    if (!category) {
      return null;
    }
    return localizeCategory(category, locale);
  });
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPage?: number;
  prevPage?: number;
}

export function calculatePagination(
  totalItems: number,
  itemsPerPage: number,
  currentPage: number
): PaginationInfo {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  return {
    currentPage,
    totalPages,
    hasNextPage,
    hasPrevPage,
    nextPage: hasNextPage ? currentPage + 1 : undefined,
    prevPage: hasPrevPage ? currentPage - 1 : undefined
  };
}
