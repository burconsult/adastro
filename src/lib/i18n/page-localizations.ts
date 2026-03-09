import { PageRepository } from '@/lib/database/repositories/page-repository';
import type { Page } from '@/lib/types';
import { DEFAULT_LOCALE, normalizeLocaleCode } from './locales';

export type PageLocaleVariantRef = {
  locale: string;
  slug: string;
};

const sanitizeVariantRefs = (value: unknown): PageLocaleVariantRef[] => {
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
    .filter((entry): entry is PageLocaleVariantRef => Boolean(entry));
};

export const getPageLocaleVariantRefs = (
  page: Pick<Page, 'locale' | 'seoMetadata'>,
  locales: string[]
): PageLocaleVariantRef[] => {
  const currentLocale = normalizeLocaleCode(page.locale, DEFAULT_LOCALE);
  const normalizedLocales = new Set(
    locales
      .map((locale) => normalizeLocaleCode(locale, ''))
      .filter((locale) => locale.length > 0)
  );

  const refsByLocale = new Map<string, PageLocaleVariantRef>();
  const explicitRefs = sanitizeVariantRefs((page.seoMetadata as any)?.alternateLocales);
  for (const ref of explicitRefs) {
    if (ref.locale === currentLocale) continue;
    if (normalizedLocales.size > 0 && !normalizedLocales.has(ref.locale)) continue;
    refsByLocale.set(ref.locale, ref);
  }

  return [...refsByLocale.values()];
};

export const findPageLocaleVariants = async (
  page: Page,
  locales: string[],
  options?: {
    publishedOnly?: boolean;
    useAdmin?: boolean;
  }
): Promise<Page[]> => {
  const refs = getPageLocaleVariantRefs(page, locales);
  if (refs.length === 0) return [];

  const publishedOnly = options?.publishedOnly !== false;
  const repo = new PageRepository(options?.useAdmin === true);
  const matches = await Promise.all(refs.map(async (ref) => {
    const candidate = await repo.findBySlug(ref.slug, ref.locale);
    if (!candidate) return null;
    if (publishedOnly && candidate.status !== 'published') return null;
    if (candidate.id === page.id) return null;
    return candidate;
  }));

  const dedupedByLocale = new Map<string, Page>();
  for (const candidate of matches) {
    if (!candidate) continue;
    const locale = normalizeLocaleCode(candidate.locale, DEFAULT_LOCALE);
    if (!dedupedByLocale.has(locale)) {
      dedupedByLocale.set(locale, candidate);
    }
  }

  return [...dedupedByLocale.values()];
};

export const findPublishedPageLocaleVariants = async (
  page: Page,
  locales: string[]
): Promise<Page[]> => findPageLocaleVariants(page, locales, { publishedOnly: true });
