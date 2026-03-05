import { PostRepository } from '@/lib/database/repositories/post-repository';
import type { BlogPost } from '@/lib/types';
import { DEFAULT_LOCALE, normalizeLocaleCode } from './locales';

export type PostLocaleVariantRef = {
  locale: string;
  slug: string;
};

const sanitizeVariantRefs = (value: unknown): PostLocaleVariantRef[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as { locale?: unknown; slug?: unknown };
      const locale = normalizeLocaleCode(record.locale, '');
      const slug = typeof record.slug === 'string' ? record.slug.trim() : '';
      if (!locale || !slug) return null;
      return { locale, slug };
    })
    .filter((entry): entry is PostLocaleVariantRef => Boolean(entry));
};

export const getPostLocaleVariantRefs = (
  post: Pick<BlogPost, 'locale' | 'seoMetadata'>,
  locales: string[]
): PostLocaleVariantRef[] => {
  const currentLocale = normalizeLocaleCode(post.locale, DEFAULT_LOCALE);
  const normalizedLocales = new Set(
    locales
      .map((locale) => normalizeLocaleCode(locale, ''))
      .filter((locale) => locale.length > 0)
  );

  const refsByLocale = new Map<string, PostLocaleVariantRef>();
  const explicitRefs = sanitizeVariantRefs((post.seoMetadata as any)?.alternateLocales);
  for (const ref of explicitRefs) {
    if (ref.locale === currentLocale) continue;
    if (normalizedLocales.size > 0 && !normalizedLocales.has(ref.locale)) continue;
    refsByLocale.set(ref.locale, ref);
  }

  return [...refsByLocale.values()];
};

export const findPostLocaleVariants = async (
  post: BlogPost,
  locales: string[],
  options?: {
    publishedOnly?: boolean;
    useAdmin?: boolean;
  }
): Promise<BlogPost[]> => {
  const refs = getPostLocaleVariantRefs(post, locales);
  if (refs.length === 0) return [];

  const publishedOnly = options?.publishedOnly !== false;
  const repo = new PostRepository(options?.useAdmin === true);
  const matches = await Promise.all(refs.map(async (ref) => {
    const candidate = await repo.findBySlug(ref.slug, ref.locale);
    if (!candidate) return null;
    if (publishedOnly && candidate.status !== 'published') return null;
    if (candidate.id === post.id) return null;
    return candidate;
  }));

  const dedupedByLocale = new Map<string, BlogPost>();
  for (const candidate of matches) {
    if (!candidate) continue;
    const locale = normalizeLocaleCode(candidate.locale, DEFAULT_LOCALE);
    if (!dedupedByLocale.has(locale)) {
      dedupedByLocale.set(locale, candidate);
    }
  }

  return [...dedupedByLocale.values()];
};

export const findPublishedPostLocaleVariants = async (
  post: BlogPost,
  locales: string[]
): Promise<BlogPost[]> => findPostLocaleVariants(post, locales, { publishedOnly: true });
