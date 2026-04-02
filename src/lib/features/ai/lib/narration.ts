import { normalizeLocaleCode } from '@/lib/i18n/locales.js';
import { getSiteIdentity, getSiteLocaleConfig } from '@/lib/site-config.js';

import type { AiRuntimeConfig } from './config-service.js';

const NARRATION_SEPARATOR = '\n\n';

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const resolveLocaleTemplate = (templates: Record<string, string>, locale: string) => {
  const normalizedLocale = normalizeLocaleCode(locale, '');
  const languageCode = normalizedLocale.split('-')[0];
  return templates[normalizedLocale] || templates[languageCode] || templates.en || '';
};

const applyTemplateTokens = (
  template: string,
  tokens: Record<'postTitle' | 'siteTitle' | 'authorName' | 'locale', string>
) => {
  return template.replace(/\{\{\s*(postTitle|siteTitle|authorName|locale)\s*\}\}/g, (_match, key) => tokens[key] || '');
};

const clamp = (value: string, maxLength: number) => value.slice(0, Math.max(0, maxLength)).trim();

const joinNarrationSegments = (segments: string[]) => segments.filter(Boolean).join(NARRATION_SEPARATOR);

const applyNarrationLimit = (intro: string, body: string, outro: string, maxLength?: number) => {
  const fullText = joinNarrationSegments([intro, body, outro]);
  if (!maxLength || fullText.length <= maxLength) {
    return fullText;
  }

  const withoutBody = joinNarrationSegments([intro, outro]);
  if (withoutBody.length >= maxLength) {
    return clamp(withoutBody, maxLength);
  }

  const bodySeparatorBudget = joinNarrationSegments([intro, 'x', outro]).length - withoutBody.length - 1;
  const bodyBudget = Math.max(0, maxLength - withoutBody.length - bodySeparatorBudget);
  return joinNarrationSegments([intro, clamp(body, bodyBudget), outro]);
};

export async function buildNarrationText(input: {
  config: AiRuntimeConfig;
  title: string;
  content: string;
  locale?: string;
  authorName?: string;
  maxLength?: number;
}) {
  const localeConfig = await getSiteLocaleConfig();
  const locale = normalizeLocaleCode(input.locale, localeConfig.defaultLocale);
  const siteIdentity = await getSiteIdentity({ locale });
  const plainContent = stripHtml(input.content);
  const tokens = {
    postTitle: input.title.trim(),
    siteTitle: siteIdentity.title,
    authorName: input.authorName?.trim() || '',
    locale
  };

  const introTemplate = resolveLocaleTemplate(input.config.capabilities.audio.narrationIntroByLocale, locale);
  const outroTemplate = resolveLocaleTemplate(input.config.capabilities.audio.narrationOutroByLocale, locale);
  const intro = introTemplate ? applyTemplateTokens(introTemplate, tokens).trim() : '';
  const outro = outroTemplate ? applyTemplateTokens(outroTemplate, tokens).trim() : '';
  const text = applyNarrationLimit(intro, plainContent, outro, input.maxLength);

  return {
    text,
    locale,
    intro,
    outro
  };
}
