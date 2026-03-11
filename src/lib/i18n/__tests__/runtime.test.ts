import { describe, expect, it, vi } from 'vitest';

vi.mock('../catalog', () => ({
  getCoreLocaleMessages: () => ({
    en: {
      'core.greeting': 'Hello',
      'core.only.en': 'English core'
    },
    nb: {
      'core.greeting': 'Hei'
    }
  }),
  getFeatureLocaleMessages: () => ({
    en: {
      'feature.greeting': 'Feature hello',
      'feature.only.en': 'English feature'
    },
    nb: {
      'feature.greeting': 'Funksjon hei'
    }
  })
}));

import { getLocaleMessages } from '../runtime';

describe('locale runtime', () => {
  it('falls back to english keys when a localized feature pack is incomplete', () => {
    const messages = getLocaleMessages('nb');

    expect(messages['core.greeting']).toBe('Hei');
    expect(messages['feature.greeting']).toBe('Funksjon hei');
    expect(messages['core.only.en']).toBe('English core');
    expect(messages['feature.only.en']).toBe('English feature');
  });

  it('falls back to english for unsupported locales', () => {
    const messages = getLocaleMessages('fr');

    expect(messages['core.greeting']).toBe('Hello');
    expect(messages['feature.greeting']).toBe('Feature hello');
  });
});
