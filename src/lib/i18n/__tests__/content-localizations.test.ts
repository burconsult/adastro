import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSettingsMock = vi.fn();

vi.mock('@/lib/services/settings-service.js', () => ({
  SettingsService: vi.fn(() => ({
    getSettings: getSettingsMock
  }))
}));

import {
  getContentLocalizationConfig,
  localizeBlogPost,
  localizeCategory,
  localizeTag
} from '../content-localizations.js';

describe('content localizations', () => {
  beforeEach(() => {
    getSettingsMock.mockReset();
  });

  it('localizes categories and tags by slug for a locale', async () => {
    getSettingsMock.mockResolvedValue({
      'content.categoryLabelsByLocale': {
        performance: { es: 'Rendimiento' }
      },
      'content.categoryDescriptionsByLocale': {
        performance: { es: 'Publicaciones sobre rendimiento.' }
      },
      'content.tagLabelsByLocale': {
        astro: { es: 'Astro ES' }
      }
    });

    await getContentLocalizationConfig({ refresh: true });

    const category = await localizeCategory({
      id: '1',
      name: 'Performance',
      slug: 'performance',
      createdAt: new Date('2026-01-01T00:00:00Z')
    }, 'es');
    const tag = await localizeTag({
      id: '2',
      name: 'Astro',
      slug: 'astro',
      createdAt: new Date('2026-01-01T00:00:00Z')
    }, 'es');

    expect(category.name).toBe('Rendimiento');
    expect(category.description).toBe('Publicaciones sobre rendimiento.');
    expect(tag.name).toBe('Astro ES');
  });

  it('falls back to default values when a locale override is missing', async () => {
    getSettingsMock.mockResolvedValue({
      'content.categoryLabelsByLocale': {
        performance: { nb: 'Ytelse' }
      },
      'content.categoryDescriptionsByLocale': {},
      'content.tagLabelsByLocale': {}
    });

    await getContentLocalizationConfig({ refresh: true });

    const post = await localizeBlogPost({
      id: 'post-1',
      title: 'Example',
      slug: 'example',
      locale: 'zh',
      content: '<p>Example</p>',
      excerpt: 'Excerpt',
      author: {
        id: 'author-1',
        name: 'Adastro Team',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z')
      },
      publishedAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      createdAt: new Date('2026-01-01T00:00:00Z'),
      status: 'published',
      categories: [{
        id: 'category-1',
        name: 'Performance',
        slug: 'performance',
        createdAt: new Date('2026-01-01T00:00:00Z')
      }],
      tags: [{
        id: 'tag-1',
        name: 'Astro',
        slug: 'astro',
        createdAt: new Date('2026-01-01T00:00:00Z')
      }]
    }, 'zh');

    expect(post.categories[0]?.name).toBe('Performance');
    expect(post.tags[0]?.name).toBe('Astro');
  });
});
