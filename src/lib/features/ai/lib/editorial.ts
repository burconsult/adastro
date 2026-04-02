import { normalizeLocaleCode } from '@/lib/i18n/locales.js';
import { getSiteIdentity, getSiteLocaleConfig } from '@/lib/site-config.js';
import type { SEOMetadata } from '@/lib/types/index.js';
import { generateExcerpt, generateSlug } from '@/lib/utils/data-transform.js';

import { aiConfigService } from './config-service.js';
import { generateContent } from './index.js';
import type { AiProviderId } from './types.js';

type EditorialCategory = {
  id: string;
  name: string;
  slug: string;
};

type EditorialTag = {
  id: string;
  name: string;
  slug: string;
};

type EditorialWarning = {
  field: 'title' | 'excerpt' | 'content' | 'seo' | 'featuredImage' | 'categories' | 'tags' | 'general';
  message: string;
};

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const clamp = (value: string, max: number) => value.slice(0, max).trim();

const extractJson = (raw: string) => {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
};

const sanitizeText = (value: unknown, max = 180) => {
  if (typeof value !== 'string') return '';
  return clamp(
    value
      .replace(/^["'\s]+|["'\s]+$/g, '')
      .replace(/\s+/g, ' '),
    max
  );
};

const uniqueStrings = (value: unknown, max: number, itemMax = 180) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const output: string[] = [];

  for (const entry of value) {
    const normalized = sanitizeText(entry, itemMax);
    const dedupeKey = normalized.toLowerCase();
    if (!normalized || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    output.push(normalized);
    if (output.length >= max) break;
  }

  return output;
};

const resolveLocale = async (locale?: string) => {
  const localeConfig = await getSiteLocaleConfig();
  return normalizeLocaleCode(locale, localeConfig.defaultLocale);
};

const normalizeTagSelection = (tagNames: string[], availableTags: EditorialTag[]) => {
  const tagIndex = new Map<string, EditorialTag>();
  for (const tag of availableTags) {
    tagIndex.set(tag.name.trim().toLowerCase(), tag);
    tagIndex.set(tag.slug.trim().toLowerCase(), tag);
  }

  const matchedIds: string[] = [];
  const unmatchedTagNames: string[] = [];
  const seenIds = new Set<string>();

  for (const tagName of tagNames) {
    const normalized = tagName.toLowerCase();
    const match = tagIndex.get(normalized);
    if (!match) {
      unmatchedTagNames.push(tagName);
      continue;
    }
    if (seenIds.has(match.id)) continue;
    seenIds.add(match.id);
    matchedIds.push(match.id);
  }

  return { matchedIds, unmatchedTagNames };
};

const normalizeCategorySelection = (value: unknown, availableCategories: EditorialCategory[]) => {
  const rawSelections = uniqueStrings(value, 3, 80);
  if (rawSelections.length === 0) return [];

  const categoryIndex = new Map<string, EditorialCategory>();
  for (const category of availableCategories) {
    categoryIndex.set(category.id.trim().toLowerCase(), category);
    categoryIndex.set(category.slug.trim().toLowerCase(), category);
    categoryIndex.set(category.name.trim().toLowerCase(), category);
  }

  const matchedIds: string[] = [];
  const seenIds = new Set<string>();

  for (const selection of rawSelections) {
    const match = categoryIndex.get(selection.toLowerCase());
    if (!match || seenIds.has(match.id)) continue;
    seenIds.add(match.id);
    matchedIds.push(match.id);
  }

  return matchedIds;
};

const buildHeuristicWarnings = (input: {
  title: string;
  excerpt: string;
  content: string;
  seoMetadata?: SEOMetadata;
  hasFeaturedImage?: boolean;
  featuredImageAltText?: string;
  currentCategoryIds?: string[];
  currentTagIds?: string[];
}): EditorialWarning[] => {
  const warnings: EditorialWarning[] = [];
  const plainContent = stripHtml(input.content);
  const title = input.title.trim();
  const excerpt = input.excerpt.trim();
  const metaTitle = input.seoMetadata?.metaTitle?.trim() || '';
  const metaDescription = input.seoMetadata?.metaDescription?.trim() || '';

  if (!title) {
    warnings.push({ field: 'title', message: 'Add a working title before publishing.' });
  } else if (title.length > 70) {
    warnings.push({ field: 'title', message: 'Title is long for search and social previews. Aim for about 70 characters or less.' });
  }

  if (!excerpt) {
    warnings.push({ field: 'excerpt', message: 'Excerpt is missing. Add a concise summary to improve cards, feeds, and archives.' });
  } else if (excerpt.length < 90) {
    warnings.push({ field: 'excerpt', message: 'Excerpt is short. Add a little more context so readers understand the angle immediately.' });
  } else if (excerpt.length > 180) {
    warnings.push({ field: 'excerpt', message: 'Excerpt is long. Tighten it so previews stay readable.' });
  }

  if (plainContent.length < 400) {
    warnings.push({ field: 'content', message: 'Body content is brief. Consider adding more context, examples, or supporting detail.' });
  }

  if (!metaTitle) {
    warnings.push({ field: 'seo', message: 'SEO title is missing.' });
  } else if (metaTitle.length > 60) {
    warnings.push({ field: 'seo', message: 'SEO title is likely too long for search results.' });
  }

  if (!metaDescription) {
    warnings.push({ field: 'seo', message: 'SEO description is missing.' });
  } else if (metaDescription.length > 160) {
    warnings.push({ field: 'seo', message: 'SEO description is likely too long for search results.' });
  }

  if (!input.hasFeaturedImage) {
    warnings.push({ field: 'featuredImage', message: 'Featured image is missing.' });
  } else if (!input.featuredImageAltText?.trim()) {
    warnings.push({ field: 'featuredImage', message: 'Featured image does not have alt text.' });
  }

  if (!input.currentCategoryIds || input.currentCategoryIds.length === 0) {
    warnings.push({ field: 'categories', message: 'No categories selected.' });
  }

  if (!input.currentTagIds || input.currentTagIds.length === 0) {
    warnings.push({ field: 'tags', message: 'No tags selected.' });
  }

  return warnings;
};

export async function generateDraftSuggestions(input: {
  title: string;
  slug?: string;
  excerpt: string;
  content: string;
  locale?: string;
  categories: EditorialCategory[];
  tags: EditorialTag[];
  currentCategoryIds?: string[];
  currentTagIds?: string[];
  seoMetadata?: SEOMetadata;
  provider?: AiProviderId;
  model?: string;
}) {
  const config = await aiConfigService.assertFeatureEnabled();
  const selection = await aiConfigService.resolveCapabilitySelection(
    config,
    'text',
    input.provider,
    input.model
  );
  const locale = await resolveLocale(input.locale);
  const siteIdentity = await getSiteIdentity({ locale });
  const plainContent = stripHtml(input.content).slice(0, 5000);

  const prompt = [
    `Site title: ${siteIdentity.title}`,
    `Locale: ${locale}`,
    `Current title: ${input.title.trim() || '(missing)'}`,
    `Current slug: ${input.slug?.trim() || '(missing)'}`,
    `Current excerpt: ${input.excerpt.trim() || '(missing)'}`,
    `Current SEO title: ${input.seoMetadata?.metaTitle?.trim() || '(missing)'}`,
    `Current SEO description: ${input.seoMetadata?.metaDescription?.trim() || '(missing)'}`,
    `Body content:\n${plainContent || '(missing)'}`,
    `Available categories (return categorySlugs from this list only):\n${input.categories.map((category) => `- ${category.slug}: ${category.name}`).join('\n') || '- none available'}`,
    `Existing tags to reuse when possible:\n${input.tags.map((tag) => `- ${tag.name} (${tag.slug})`).join('\n') || '- none available'}`,
    'Return a JSON object with keys: titleSuggestions, excerpt, slug, seo, tagNames, categorySlugs, notes.',
    'titleSuggestions should contain up to 3 distinct options.',
    'excerpt should be one paragraph under 180 characters.',
    'slug must be lower-case kebab-case.',
    'seo must include metaTitle, metaDescription, and keywords.',
    'tagNames should contain up to 5 tags.',
    'notes should contain up to 4 short rationale bullets.'
  ].join('\n\n');

  const system = [
    `You are an editorial drafting assistant for locale "${locale}".`,
    'Keep suggestions publication-ready and specific.',
    'Favor clarity over hype.',
    'Use the same language as the draft.',
    'Return JSON only.'
  ].join(' ');

  let response;
  try {
    response = await generateContent({
      prompt,
      system,
      provider: selection.provider,
      model: selection.model,
      temperature: 0.6,
      maxOutputTokens: 900,
      responseFormat: selection.provider === 'openai' || selection.provider === 'gateway' ? 'json_object' : undefined
    });
  } catch (error) {
    if (selection.provider === 'openai' || selection.provider === 'gateway') {
      response = await generateContent({
        prompt,
        system,
        provider: selection.provider,
        model: selection.model,
        temperature: 0.6,
        maxOutputTokens: 900
      });
    } else {
      throw error;
    }
  }

  const parsed = extractJson(response.text) ?? {};
  const titleSuggestions = uniqueStrings(parsed.titleSuggestions, 3, 90);
  const excerpt = sanitizeText(parsed.excerpt, 180)
    || input.excerpt.trim()
    || generateExcerpt(plainContent || input.title, 160);
  const slug = clamp(
    generateSlug(
      sanitizeText(parsed.slug, 120)
      || titleSuggestions[0]
      || input.title
      || excerpt
    ),
    90
  );
  const seoSource = parsed.seo && typeof parsed.seo === 'object' ? parsed.seo : {};
  const tagNames = uniqueStrings(parsed.tagNames ?? parsed.tags, 5, 50);
  const { matchedIds: tagIds, unmatchedTagNames } = normalizeTagSelection(tagNames, input.tags);
  const categoryIds = normalizeCategorySelection(parsed.categorySlugs ?? parsed.categories ?? parsed.categoryIds, input.categories);
  const notes = uniqueStrings(parsed.notes, 4, 160);

  return {
    locale,
    provider: response.provider,
    model: response.model,
    usage: response.usage,
    suggestions: {
      titleSuggestions,
      excerpt,
      slug,
      seo: {
        metaTitle: sanitizeText((seoSource as Record<string, unknown>).metaTitle, 70)
          || titleSuggestions[0]
          || input.title.trim(),
        metaDescription: sanitizeText((seoSource as Record<string, unknown>).metaDescription, 160)
          || excerpt,
        keywords: uniqueStrings((seoSource as Record<string, unknown>).keywords, 8, 40)
      },
      categoryIds,
      tagIds,
      tagNames,
      unmatchedTagNames,
      notes
    }
  };
}

export async function generateEditorialReview(input: {
  title: string;
  excerpt: string;
  content: string;
  locale?: string;
  categories: EditorialCategory[];
  tags: EditorialTag[];
  currentCategoryIds?: string[];
  currentTagIds?: string[];
  seoMetadata?: SEOMetadata;
  hasFeaturedImage?: boolean;
  featuredImageAltText?: string;
  hasAudioAsset?: boolean;
  provider?: AiProviderId;
  model?: string;
}) {
  const config = await aiConfigService.assertFeatureEnabled();
  const selection = await aiConfigService.resolveCapabilitySelection(
    config,
    'text',
    input.provider,
    input.model
  );
  const locale = await resolveLocale(input.locale);
  const siteIdentity = await getSiteIdentity({ locale });
  const heuristics = buildHeuristicWarnings(input);
  const plainContent = stripHtml(input.content).slice(0, 5000);
  const selectedCategories = input.categories
    .filter((category) => input.currentCategoryIds?.includes(category.id))
    .map((category) => category.name);
  const selectedTags = input.tags
    .filter((tag) => input.currentTagIds?.includes(tag.id))
    .map((tag) => tag.name);

  const prompt = [
    `Site title: ${siteIdentity.title}`,
    `Locale: ${locale}`,
    `Title: ${input.title.trim() || '(missing)'}`,
    `Excerpt: ${input.excerpt.trim() || '(missing)'}`,
    `Body content:\n${plainContent || '(missing)'}`,
    `Selected categories: ${selectedCategories.join(', ') || '(none)'}`,
    `Selected tags: ${selectedTags.join(', ') || '(none)'}`,
    `SEO title: ${input.seoMetadata?.metaTitle?.trim() || '(missing)'}`,
    `SEO description: ${input.seoMetadata?.metaDescription?.trim() || '(missing)'}`,
    `Featured image present: ${input.hasFeaturedImage ? 'yes' : 'no'}`,
    `Featured image alt text: ${input.featuredImageAltText?.trim() || '(missing)'}`,
    `Audio version present: ${input.hasAudioAsset ? 'yes' : 'no'}`,
    'Return a JSON object with keys: summary, warnings, quickWins.',
    'warnings should contain up to 5 objects with field and message keys.',
    'Focus on editorial clarity, search intent, structure, and weak metadata.',
    'Do not recommend blocking publication. These are warning-level observations only.'
  ].join('\n\n');

  const system = [
    `You are an editorial QA assistant for locale "${locale}".`,
    'Be direct, specific, and concise.',
    'Use the same language as the draft.',
    'Return JSON only.'
  ].join(' ');

  let response;
  try {
    response = await generateContent({
      prompt,
      system,
      provider: selection.provider,
      model: selection.model,
      temperature: 0.3,
      maxOutputTokens: 700,
      responseFormat: selection.provider === 'openai' || selection.provider === 'gateway' ? 'json_object' : undefined
    });
  } catch (error) {
    if (selection.provider === 'openai' || selection.provider === 'gateway') {
      response = await generateContent({
        prompt,
        system,
        provider: selection.provider,
        model: selection.model,
        temperature: 0.3,
        maxOutputTokens: 700
      });
    } else {
      throw error;
    }
  }

  const parsed = extractJson(response.text) ?? {};
  const aiWarnings = Array.isArray(parsed.warnings)
    ? parsed.warnings
      .map((warning) => {
        if (!warning || typeof warning !== 'object') return null;
        const field = sanitizeText((warning as Record<string, unknown>).field, 30).toLowerCase();
        const message = sanitizeText((warning as Record<string, unknown>).message, 180);
        if (!message) return null;
        const normalizedField = (
          field === 'title'
          || field === 'excerpt'
          || field === 'content'
          || field === 'seo'
          || field === 'featuredimage'
          || field === 'categories'
          || field === 'tags'
        )
          ? (field === 'featuredimage' ? 'featuredImage' : field) as EditorialWarning['field']
          : 'general';
        return { field: normalizedField, message };
      })
      .filter((warning): warning is EditorialWarning => Boolean(warning))
      .slice(0, 5)
    : [];

  return {
    locale,
    provider: response.provider,
    model: response.model,
    usage: response.usage,
    review: {
      summary: sanitizeText(parsed.summary, 220),
      heuristics,
      aiWarnings,
      quickWins: uniqueStrings(parsed.quickWins, 4, 160)
    }
  };
}
