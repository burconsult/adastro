import { describe, expect, it } from 'vitest';
import {
  getAvailableLocaleCodes,
  getCoreLocalePacks,
  getFeatureLocalePacks,
  getLocalePackHealth,
  LOCALE_CATALOG_VERSION,
  LOCALE_SCHEMA_VERSION
} from '../catalog';

describe('locale catalog', () => {
  it('includes the shipped locale codes', () => {
    expect(getAvailableLocaleCodes()).toEqual(expect.arrayContaining(['en', 'nb', 'es', 'zh']));
  });

  it('keeps core locale pack metadata aligned with the active catalog contract', () => {
    const corePacks = getCoreLocalePacks();

    expect(Object.keys(corePacks).length).toBeGreaterThan(0);

    for (const pack of Object.values(corePacks)) {
      expect(pack.meta.scope).toBe('core');
      expect(pack.meta.locale).toBe(pack.locale);
      expect(pack.meta.catalogVersion).toBe(LOCALE_CATALOG_VERSION);
      expect(pack.meta.schemaVersion).toBe(LOCALE_SCHEMA_VERSION);
      expect(pack.meta.fallbackLocale).toBe('en');
      expect(Object.keys(pack.messages).length).toBeGreaterThan(0);
    }
  });

  it('keeps feature locale pack metadata aligned and preserves an english fallback source', () => {
    const featurePacks = getFeatureLocalePacks();

    for (const [featureId, packs] of Object.entries(featurePacks)) {
      expect(packs.en).toBeDefined();
      for (const pack of Object.values(packs)) {
        expect(pack.meta.scope).toBe('feature');
        expect(pack.meta.featureId).toBe(featureId);
        expect(pack.meta.locale).toBe(pack.locale);
        expect(pack.meta.catalogVersion).toBe(LOCALE_CATALOG_VERSION);
        expect(pack.meta.schemaVersion).toBe(LOCALE_SCHEMA_VERSION);
        expect(pack.meta.fallbackLocale).toBe('en');
      }
    }
  });

  it('reports health for active and default locales', () => {
    const localeHealth = getLocalePackHealth({ activeLocales: ['en', 'nb'], defaultLocale: 'en' });
    const english = localeHealth.find((entry) => entry.locale === 'en');
    const norwegian = localeHealth.find((entry) => entry.locale === 'nb');

    expect(english).toMatchObject({
      isActive: true,
      isDefault: true,
      coreStatus: 'ok'
    });
    expect(norwegian).toMatchObject({
      isActive: true,
      isDefault: false,
      hasCorePack: true
    });
    expect(norwegian?.features.length).toBeGreaterThan(0);
  });
});
