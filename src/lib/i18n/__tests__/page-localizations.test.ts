import { describe, it, expect } from 'vitest';
import { getPageLocaleVariantRefs } from '../page-localizations';

describe('getPageLocaleVariantRefs', () => {
  it('normalizes and filters alternate locale refs', () => {
    const refs = getPageLocaleVariantRefs(
      {
        locale: 'nb',
        seoMetadata: {
          alternateLocales: [
            { locale: 'EN', slug: 'about' },
            { locale: 'es', slug: 'sobre-nosotros' },
            { locale: 'nb', slug: 'om-oss' },
            { locale: 'zh', slug: '' },
            { locale: 'es', slug: 'sobre-nosotros-v2' }
          ]
        }
      },
      ['nb', 'en', 'es']
    );

    expect(refs).toEqual([
      { locale: 'en', slug: 'about' },
      { locale: 'es', slug: 'sobre-nosotros-v2' }
    ]);
  });

  it('returns empty refs when metadata is missing', () => {
    const refs = getPageLocaleVariantRefs(
      { locale: 'en', seoMetadata: {} },
      ['en', 'nb']
    );

    expect(refs).toEqual([]);
  });
});
