import { generateContent } from './index.js';
import type { SEOMetadata } from '../../../types/index.js';
import type { AiProviderKey } from './types.js';

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

export interface GenerateSeoInput {
  title: string;
  excerpt?: string;
  content?: string;
  tags?: string[];
  provider?: AiProviderKey;
  model?: string;
}

export async function generateSeoMetadata(input: GenerateSeoInput): Promise<SEOMetadata> {
  const { title, excerpt, content, tags = [], provider, model } = input;
  const trimmedContent = content?.replace(/\s+/g, ' ').trim() || '';
  const snippet = trimmedContent.slice(0, 1200);
  const keywords = tags.slice(0, 8).join(', ');

  const system = [
    'You are an SEO assistant for a modern blog.',
    'Return a JSON object with keys: metaTitle, metaDescription, ogTitle, ogDescription, twitterTitle, twitterDescription.',
    'Keep metaTitle <= 60 chars, metaDescription <= 160 chars.',
    'Do not include markdown or extra text.'
  ].join(' ');

  const prompt = [
    `Title: ${title}`,
    excerpt ? `Excerpt: ${excerpt}` : '',
    keywords ? `Tags: ${keywords}` : '',
    snippet ? `Content: ${snippet}` : ''
  ]
    .filter(Boolean)
    .join('\n');

  let response;
  try {
    response = await generateContent({
      prompt,
      system,
      provider,
      model,
      temperature: 0.4,
      maxOutputTokens: 400,
      responseFormat: provider === 'openai' ? 'json_object' : undefined
    });
  } catch (error) {
    if (provider === 'openai') {
      response = await generateContent({
        prompt,
        system,
        provider,
        model,
        temperature: 0.4,
        maxOutputTokens: 400
      });
    } else {
      throw error;
    }
  }

  const parsed = extractJson(response.text) ?? {};
  const metaTitle = clamp(parsed.metaTitle || parsed.ogTitle || title, 60);
  const metaDescription = clamp(parsed.metaDescription || parsed.ogDescription || excerpt || '', 160);
  const ogTitle = clamp(parsed.ogTitle || metaTitle || title, 60);
  const ogDescription = clamp(parsed.ogDescription || metaDescription || '', 160);
  const twitterTitle = clamp(parsed.twitterTitle || ogTitle || metaTitle || title, 70);
  const twitterDescription = clamp(parsed.twitterDescription || ogDescription || metaDescription || '', 200);

  return {
    metaTitle,
    metaDescription,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: 'article'
    },
    twitterCard: {
      card: 'summary_large_image',
      title: twitterTitle,
      description: twitterDescription
    }
  };
}
