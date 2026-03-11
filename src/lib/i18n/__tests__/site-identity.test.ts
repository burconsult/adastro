import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSettingsMock = vi.fn();

vi.mock('@/lib/services/settings-service.js', () => ({
  SettingsService: vi.fn(() => ({
    getSettings: getSettingsMock
  }))
}));

import { getSiteIdentity } from '@/lib/site-config.js';

describe('site identity localization', () => {
  beforeEach(() => {
    getSettingsMock.mockReset();
  });

  it('uses locale-specific identity overrides when present', async () => {
    getSettingsMock
      .mockResolvedValueOnce({
        'site.title': 'AdAstro',
        'site.description': 'A practical, speed-first CMS built with Astro and Supabase.',
        'site.tagline': 'AdAstro - The Lightspeed CMS',
        'site.logoUrl': '/logo.svg'
      })
      .mockResolvedValueOnce({
        'site.titleByLocale': { es: 'AdAstro ES' },
        'site.descriptionByLocale': { es: 'CMS rapido.' },
        'site.taglineByLocale': { es: 'AdAstro - El CMS ultrarrapido' }
      });

    const identity = await getSiteIdentity({ refresh: true, locale: 'es' });

    expect(identity).toEqual({
      title: 'AdAstro ES',
      description: 'CMS rapido.',
      tagline: 'AdAstro - El CMS ultrarrapido',
      logoUrl: '/logo.svg'
    });
  });

  it('falls back to english defaults when localized identity is missing', async () => {
    getSettingsMock
      .mockResolvedValueOnce({
        'site.title': 'AdAstro',
        'site.description': 'A practical, speed-first CMS built with Astro and Supabase.',
        'site.tagline': 'AdAstro - The Lightspeed CMS',
        'site.logoUrl': '/logo.svg'
      })
      .mockResolvedValueOnce({
        'site.titleByLocale': { nb: 'AdAstro NB' },
        'site.descriptionByLocale': {},
        'site.taglineByLocale': {}
      });

    const identity = await getSiteIdentity({ refresh: true, locale: 'zh' });

    expect(identity).toEqual({
      title: 'AdAstro',
      description: 'A practical, speed-first CMS built with Astro and Supabase.',
      tagline: 'AdAstro - The Lightspeed CMS',
      logoUrl: '/logo.svg'
    });
  });
});
