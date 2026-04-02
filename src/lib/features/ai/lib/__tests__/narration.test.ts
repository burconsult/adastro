import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/site-config.js', () => ({
  getSiteLocaleConfig: vi.fn(async () => ({
    defaultLocale: 'en'
  })),
  getSiteIdentity: vi.fn(async ({ locale }: { locale: string }) => ({
    title: locale === 'nb' ? 'AdAstro Norge' : 'AdAstro'
  }))
}));

import { buildNarrationText } from '../narration.js';

describe('buildNarrationText', () => {
  it('preserves intro and outro when trimming long narration text', async () => {
    const result = await buildNarrationText({
      config: {
        enabled: true,
        tools: {
          seo: true,
          image: true,
          audio: true,
          alt: true
        },
        limits: {
          enabled: false,
          seoDailyRequests: 0,
          imageDailyRequests: 0,
          audioDailyRequests: 0
        },
        capabilities: {
          text: {
            defaultProvider: 'openai',
            defaultModel: 'gpt-5',
            mediaAnalysisProvider: 'openai',
            mediaAnalysisModel: 'gpt-4o-mini'
          },
          image: {
            defaultProvider: 'openai',
            defaultModel: 'gpt-image-1',
            defaultSize: '1024x1024',
            defaultAspectRatio: '1:1',
            defaultResolution: '1K'
          },
          audio: {
            defaultProvider: 'openai',
            defaultModel: 'gpt-4o-mini-tts',
            defaultVoice: 'alloy',
            narrationIntroByLocale: {
              en: 'Intro {{postTitle}}'
            },
            narrationOutroByLocale: {
              en: 'Outro {{authorName}}'
            }
          }
        }
      },
      title: 'Launch Update',
      content: '<p>' + 'Body '.repeat(40) + '</p>',
      locale: 'en',
      authorName: 'Jane Doe',
      maxLength: 70
    });

    expect(result.text).toContain('Intro Launch Update');
    expect(result.text).toContain('Outro Jane Doe');
    expect(result.text.length).toBeLessThanOrEqual(70);
  });
});
