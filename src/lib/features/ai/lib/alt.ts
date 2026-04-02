import { normalizeLocaleCode } from '@/lib/i18n/locales.js';
import { getSiteIdentity, getSiteLocaleConfig } from '@/lib/site-config.js';
import type { MediaAsset } from '@/lib/types/index.js';

import { aiConfigService } from './config-service.js';
import { generateContent } from './index.js';
import type { AiProviderId } from './types.js';

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

const sanitizeAltText = (value: string) => {
  return clamp(
    value
      .replace(/^["'\s]+|["'\s]+$/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\.$/, ''),
    160
  );
};

const pickPromptLine = (prompt: string) => {
  const titleMatch = prompt.match(/^Title:\s*(.+)$/im);
  if (titleMatch?.[1]) {
    return `Editorial hero image for ${titleMatch[1].trim()}`;
  }

  const firstUsefulLine = prompt
    .split('\n')
    .map((line) => line.trim())
    .find((line) => (
      line.length > 0
      && !/^create a high-quality hero image/i.test(line)
      && !/^excerpt:/i.test(line)
      && !/^tags:/i.test(line)
      && !/^style:/i.test(line)
    ));

  return firstUsefulLine || prompt.trim();
};

export const inferAltTextFromPrompt = (input: {
  prompt?: string;
  title?: string;
  excerpt?: string;
}) => {
  const prompt = input.prompt?.trim();
  if (prompt) {
    return sanitizeAltText(pickPromptLine(prompt));
  }
  if (input.title?.trim()) {
    return sanitizeAltText(`Editorial image for ${input.title.trim()}`);
  }
  if (input.excerpt?.trim()) {
    return sanitizeAltText(input.excerpt.trim());
  }
  return 'Editorial image';
};

const resolveLocale = async (locale?: string) => {
  const localeConfig = await getSiteLocaleConfig();
  return normalizeLocaleCode(locale, localeConfig.defaultLocale);
};

export async function generateMediaAltText(input: {
  asset: MediaAsset;
  locale?: string;
  provider?: AiProviderId;
  model?: string;
}) {
  const locale = await resolveLocale(input.locale);
  const config = await aiConfigService.assertFeatureEnabled('alt');
  const selection = await aiConfigService.resolveMediaAnalysisSelection(
    config,
    input.provider,
    input.model
  );
  const siteIdentity = await getSiteIdentity({ locale });

  const system = [
    `You write concise, accessibility-focused alt text in locale "${locale}".`,
    'Return a JSON object with one key: altText.',
    'Describe the image itself, not the file name or prompt.',
    'Do not start with "image of" or "photo of".',
    'Keep altText under 160 characters.',
    'Do not include markdown or extra commentary.'
  ].join(' ');

  const prompt = [
    `Site title: ${siteIdentity.title}`,
    `Filename: ${input.asset.filename}`,
    input.asset.caption ? `Existing caption: ${input.asset.caption}` : '',
    input.asset.altText ? `Existing alt text: ${input.asset.altText}` : '',
    'Write one strong alt text string for this image.'
  ].filter(Boolean).join('\n');

  let response;
  try {
    response = await generateContent({
      prompt,
      system,
      provider: selection.provider,
      model: selection.model,
      temperature: 0.2,
      maxOutputTokens: 160,
      responseFormat: selection.provider === 'openai' || selection.provider === 'gateway' ? 'json_object' : undefined,
      images: [{ url: input.asset.url, mimeType: input.asset.mimeType }]
    });
  } catch (error) {
    if (selection.provider === 'openai' || selection.provider === 'gateway') {
      response = await generateContent({
        prompt,
        system,
        provider: selection.provider,
        model: selection.model,
        temperature: 0.2,
        maxOutputTokens: 160,
        images: [{ url: input.asset.url, mimeType: input.asset.mimeType }]
      });
    } else {
      throw error;
    }
  }

  const parsed = extractJson(response.text) ?? {};
  const altText = sanitizeAltText(parsed.altText || response.text || input.asset.altText || input.asset.filename);
  if (!altText) {
    throw new Error('AI did not return alt text.');
  }

  return {
    altText,
    locale,
    provider: response.provider,
    model: response.model,
    usage: response.usage
  };
}
