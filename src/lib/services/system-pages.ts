import { PageRepository } from '@/lib/database/repositories/page-repository';
import type { PageSectionInput } from '@/lib/database/repositories/page-section-repository';
import type { Page, SEOMetadata } from '@/lib/types';
import { DEFAULT_LOCALE, normalizeLocaleCode } from '@/lib/i18n/locales';
import { DEFAULT_ARTICLE_ROUTING, normalizeArticleBasePath } from '@/lib/routing/articles';
import { supabaseAdmin } from '@/lib/supabase';

export type SystemPageBlueprint = {
  title: string;
  slug: string;
  template: string;
  excerpt: string;
  seoMetadata: SEOMetadata;
  sections: PageSectionInput[];
};

export type LocalizedSystemPageProvisioningResult = {
  targetLocale: string;
  createdSlugs: string[];
  clonedSlugs: string[];
  blueprintSlugs: string[];
};

type AlternateLocaleRef = {
  locale: string;
  slug: string;
};

const deepClone = <T>(value: T): T => (
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value))
);

const sanitizeAlternateLocaleRefs = (value: unknown): AlternateLocaleRef[] => {
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
    .filter((entry): entry is AlternateLocaleRef => Boolean(entry));
};

const normalizeSeoMetadata = (value: unknown): SEOMetadata | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return deepClone(value as SEOMetadata);
};

const stripAlternateLocales = (seoMetadata: unknown): SEOMetadata | undefined => {
  const normalized = normalizeSeoMetadata(seoMetadata);
  if (!normalized) return undefined;
  const next = { ...normalized };
  delete next.alternateLocales;
  return next;
};

export const getRequiredSystemPageSlugs = (articleBasePath: string): string[] => {
  const normalizedArticleBasePath = normalizeArticleBasePath(articleBasePath || DEFAULT_ARTICLE_ROUTING.basePath);
  return ['home', normalizedArticleBasePath, 'about', 'contact'];
};

const getSystemPageSlugGroups = (articleBasePath: string): Array<{ blueprintSlug: string; candidates: string[] }> => {
  const normalizedArticleBasePath = normalizeArticleBasePath(articleBasePath || DEFAULT_ARTICLE_ROUTING.basePath);
  return [
    { blueprintSlug: 'home', candidates: ['home'] },
    {
      blueprintSlug: normalizedArticleBasePath,
      candidates: Array.from(new Set([normalizedArticleBasePath, DEFAULT_ARTICLE_ROUTING.basePath]))
    },
    { blueprintSlug: 'about', candidates: ['about'] },
    { blueprintSlug: 'contact', candidates: ['contact'] }
  ];
};

export const buildSystemPageBlueprints = (articleBasePath: string): SystemPageBlueprint[] => {
  const normalizedArticleBasePath = normalizeArticleBasePath(articleBasePath || DEFAULT_ARTICLE_ROUTING.basePath);
  const articlesPath = `/${normalizedArticleBasePath}`;

  return [
    {
      title: 'Home',
      slug: 'home',
      template: 'home',
      excerpt: 'AdAstro launch page with a practical performance-first overview.',
      seoMetadata: {
        metaTitle: 'AdAstro - The Lightspeed CMS',
        metaDescription: 'Fast publishing with Astro + Supabase, with modular features you can enable when needed.'
      },
      sections: [
        {
          type: 'hero',
          orderIndex: 0,
          content: {
            label: 'AdAstro - The Lightspeed CMS',
            heading: 'Fast publishing with practical defaults',
            subheading: 'A clean CMS core built for green PageSpeed scores, reliable SEO, and modular features you can keep off until needed.',
            primaryCtaLabel: 'Open articles',
            primaryCtaHref: articlesPath,
            secondaryCtaLabel: 'About AdAstro',
            secondaryCtaHref: '/about',
            imageUrl: '/images/adastro.webp',
            imageAlt: 'AdAstro launch illustration'
          }
        },
        {
          type: 'info_blocks',
          orderIndex: 1,
          content: {
            heading: 'What ships in the core',
            items: [
              {
                title: 'Speed-first architecture',
                description: 'Astro rendering and stable defaults keep performance predictable as content grows.'
              },
              {
                title: 'SEO baseline included',
                description: 'Canonical tags, sitemap, metadata controls, and OG previews come built in.'
              },
              {
                title: 'Modular feature model',
                description: 'AI, comments, and newsletter stay off by default and can be enabled when you need them.'
              }
            ]
          }
        },
        {
          type: 'cta',
          orderIndex: 2,
          content: {
            heading: 'Ready to customize this site?',
            body: 'Start by editing this homepage and the About page from Admin -> Pages.',
            ctaLabel: 'Open pages',
            ctaHref: '/admin/pages'
          }
        }
      ]
    },
    {
      title: 'Articles',
      slug: normalizedArticleBasePath,
      template: 'blog',
      excerpt: 'Article index intro managed from the page editor.',
      seoMetadata: {
        metaTitle: 'Articles - AdAstro',
        metaDescription: 'Publishing notes, migration workflows, and practical performance wins.'
      },
      sections: [
        {
          type: 'hero',
          orderIndex: 0,
          content: {
            label: 'Articles',
            heading: 'Publishing notes, migration workflows, and performance wins',
            subheading: 'This page header is editable from Pages. The article list below is always generated from published posts.',
            primaryCtaLabel: 'Go to home',
            primaryCtaHref: '/',
            secondaryCtaLabel: 'Contact',
            secondaryCtaHref: '/contact'
          }
        }
      ]
    },
    {
      title: 'About',
      slug: 'about',
      template: 'landing',
      excerpt: 'Editable About page with practical context for the CMS.',
      seoMetadata: {
        metaTitle: 'About - AdAstro',
        metaDescription: 'How AdAstro is built and why the stack focuses on practical speed-first publishing.'
      },
      sections: [
        {
          type: 'hero',
          orderIndex: 0,
          content: {
            label: 'About',
            heading: 'Built to stay fast while keeping publishing simple',
            subheading: 'AdAstro started as a practical response to slow CMS setups and grew into a modular Astro + Supabase stack.',
            primaryCtaLabel: 'Open pages',
            primaryCtaHref: '/admin/pages',
            secondaryCtaLabel: 'Read articles',
            secondaryCtaHref: articlesPath,
            imageUrl: '/images/adastro.webp',
            imageAlt: 'AdAstro project timeline illustration'
          }
        },
        {
          type: 'feature_grid',
          orderIndex: 1,
          content: {
            heading: 'What this CMS optimizes for',
            items: [
              {
                title: 'Predictable performance',
                description: 'The baseline is tuned for 90+ PSI targets with real-world content.',
                badge: 'Core'
              },
              {
                title: 'Editable system pages',
                description: 'Home, About, Articles header, and Contact are managed from the page editor.',
                badge: 'Content'
              },
              {
                title: 'Modular feature lifecycle',
                description: 'Bundled features are optional and can be enabled or removed without touching the core.',
                badge: 'Features'
              }
            ]
          }
        }
      ]
    },
    {
      title: 'Contact',
      slug: 'contact',
      template: 'landing',
      excerpt: 'Editable contact page for support and collaboration details.',
      seoMetadata: {
        metaTitle: 'Contact - AdAstro',
        metaDescription: 'Contact details and collaboration links for your AdAstro site.'
      },
      sections: [
        {
          type: 'hero',
          orderIndex: 0,
          content: {
            label: 'Contact',
            heading: 'Questions, bug reports, or collaboration ideas',
            subheading: 'Update this page with your own support channels, SLA notes, and preferred contact paths.',
            primaryCtaLabel: 'Open an issue',
            primaryCtaHref: 'https://github.com/burconsult/adastro/issues',
            secondaryCtaLabel: 'View discussions',
            secondaryCtaHref: 'https://github.com/burconsult/adastro/discussions',
            imageUrl: '/images/adastro.webp',
            imageAlt: 'Support desk illustration for AdAstro contact page'
          }
        },
        {
          type: 'cta',
          orderIndex: 1,
          content: {
            heading: 'Customize this contact flow',
            body: 'Swap links, text, and CTA actions from Admin -> Pages without editing code.',
            ctaLabel: 'Edit contact page',
            ctaHref: '/admin/pages'
          }
        }
      ]
    }
  ];
};

export const resolvePrimaryAuthorId = async (): Promise<string | null> => {
  const { data, error } = await (supabaseAdmin as any)
    .from('authors')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not determine default author for system pages: ${error.message}`);
  }

  return data?.id || null;
};

const cloneSystemPageFromSource = async (
  pageRepo: PageRepository,
  sourcePage: Page,
  targetLocale: string,
  authorId: string | null
) => {
  const sections = (sourcePage.sections || []).map((section) => ({
    type: section.type,
    content: deepClone(section.content ?? {}),
    orderIndex: section.orderIndex
  }));

  await pageRepo.createWithSections({
    title: sourcePage.title,
    slug: sourcePage.slug,
    locale: targetLocale,
    status: sourcePage.status,
    template: sourcePage.template,
    contentBlocks: sourcePage.contentBlocks ? deepClone(sourcePage.contentBlocks) : undefined,
    contentHtml: sourcePage.contentHtml,
    excerpt: sourcePage.excerpt,
    authorId: sourcePage.author?.id || authorId,
    seoMetadata: stripAlternateLocales(sourcePage.seoMetadata),
    publishedAt: sourcePage.publishedAt ?? new Date()
  }, sections);
};

const createBlueprintSystemPage = async (
  pageRepo: PageRepository,
  blueprint: SystemPageBlueprint,
  targetLocale: string,
  authorId: string | null
) => {
  await pageRepo.createWithSections({
    title: blueprint.title,
    slug: blueprint.slug,
    locale: targetLocale,
    status: 'published',
    template: blueprint.template,
    excerpt: blueprint.excerpt,
    authorId,
    seoMetadata: deepClone(blueprint.seoMetadata),
    publishedAt: new Date()
  }, deepClone(blueprint.sections));
};

const syncAlternateLocaleRefsForSlug = async (slug: string) => {
  const { data, error } = await (supabaseAdmin as any)
    .from('pages')
    .select('id, slug, locale, seo_metadata')
    .eq('slug', slug);

  if (error) {
    throw new Error(`Failed to load localized system pages for "${slug}": ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  if (rows.length <= 1) return;

  const normalizedRows = rows
    .map((row) => ({
      id: String(row.id),
      slug: typeof row.slug === 'string' ? row.slug.trim() : slug,
      locale: normalizeLocaleCode(row.locale, DEFAULT_LOCALE),
      seoMetadata: normalizeSeoMetadata(row.seo_metadata)
    }))
    .filter((row) => row.locale.length > 0);

  const localeSet = new Set(normalizedRows.map((row) => row.locale));
  const pageRepo = new PageRepository(true);

  for (const row of normalizedRows) {
    const preserved = sanitizeAlternateLocaleRefs(row.seoMetadata?.alternateLocales)
      .filter((ref) => ref.locale !== row.locale && !localeSet.has(ref.locale));
    const generated = normalizedRows
      .filter((candidate) => candidate.id !== row.id)
      .map((candidate) => ({
        locale: candidate.locale,
        slug: candidate.slug
      }));
    const nextAlternateLocales = [...preserved, ...generated]
      .sort((a, b) => a.locale.localeCompare(b.locale));
    const previousAlternateLocales = sanitizeAlternateLocaleRefs(row.seoMetadata?.alternateLocales)
      .sort((a, b) => a.locale.localeCompare(b.locale));

    if (JSON.stringify(previousAlternateLocales) === JSON.stringify(nextAlternateLocales)) {
      continue;
    }

    await pageRepo.update(row.id, {
      seoMetadata: {
        ...(row.seoMetadata || {}),
        alternateLocales: nextAlternateLocales
      }
    });
  }
};

export const ensureLocalizedSystemPages = async (options: {
  articleBasePath: string;
  targetLocale: string;
  sourceLocale?: string;
  fallbackSourceLocale?: string;
  authorId?: string | null;
}): Promise<LocalizedSystemPageProvisioningResult> => {
  const targetLocale = normalizeLocaleCode(options.targetLocale, DEFAULT_LOCALE);
  const sourceLocale = normalizeLocaleCode(options.sourceLocale, DEFAULT_LOCALE);
  const fallbackSourceLocale = normalizeLocaleCode(options.fallbackSourceLocale, DEFAULT_LOCALE);
  const articleBasePath = normalizeArticleBasePath(options.articleBasePath || DEFAULT_ARTICLE_ROUTING.basePath);
  const slugGroups = getSystemPageSlugGroups(articleBasePath);
  const blueprintsBySlug = new Map(buildSystemPageBlueprints(articleBasePath).map((blueprint) => [blueprint.slug, blueprint] as const));
  const pageRepo = new PageRepository(true);
  const authorId = options.authorId === undefined ? await resolvePrimaryAuthorId() : options.authorId;

  const result: LocalizedSystemPageProvisioningResult = {
    targetLocale,
    createdSlugs: [],
    clonedSlugs: [],
    blueprintSlugs: []
  };

  for (const group of slugGroups) {
    const existingTargetPage = await Promise.all(group.candidates.map((slug) => pageRepo.findBySlug(slug, targetLocale)))
      .then((pages) => pages.find(Boolean));
    if (existingTargetPage) continue;

    const sourcePage = await Promise.all(group.candidates.map((slug) => pageRepo.findBySlug(slug, sourceLocale)))
      .then((pages) => pages.find(Boolean))
      || (sourceLocale !== fallbackSourceLocale
        ? await Promise.all(group.candidates.map((slug) => pageRepo.findBySlug(slug, fallbackSourceLocale)))
          .then((pages) => pages.find(Boolean))
        : null);

    if (sourcePage) {
      await cloneSystemPageFromSource(pageRepo, sourcePage, targetLocale, authorId ?? null);
      result.createdSlugs.push(sourcePage.slug);
      result.clonedSlugs.push(sourcePage.slug);
      continue;
    }

    const blueprint = blueprintsBySlug.get(group.blueprintSlug);
    if (!blueprint) {
      throw new Error(`No system page blueprint is defined for slug "${group.blueprintSlug}".`);
    }

    await createBlueprintSystemPage(pageRepo, blueprint, targetLocale, authorId ?? null);
    result.createdSlugs.push(group.blueprintSlug);
    result.blueprintSlugs.push(group.blueprintSlug);
  }

  const slugsToSync = Array.from(new Set(slugGroups.flatMap((group) => group.candidates)));
  for (const slug of slugsToSync) {
    await syncAlternateLocaleRefsForSlug(slug);
  }

  return result;
};
