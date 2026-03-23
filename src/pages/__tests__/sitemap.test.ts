import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findPosts: vi.fn(),
  findPages: vi.fn(),
  getSiteContentRouting: vi.fn(),
  getSiteLocaleConfig: vi.fn(),
  resolveSiteUrl: vi.fn()
}));

vi.mock('../../lib/database/repositories/post-repository.js', () => ({
  PostRepository: class {
    findWithFilters(...args: any[]) {
      return mocks.findPosts(...args);
    }
  }
}));

vi.mock('../../lib/database/repositories/page-repository.js', () => ({
  PageRepository: class {
    findWithFilters(...args: any[]) {
      return mocks.findPages(...args);
    }
  }
}));

vi.mock('../../lib/site-config.js', () => ({
  getSiteContentRouting: mocks.getSiteContentRouting,
  getSiteLocaleConfig: mocks.getSiteLocaleConfig
}));

vi.mock('../../lib/url/site-url.js', () => ({
  resolveSiteUrl: mocks.resolveSiteUrl
}));

import { GET } from '../sitemap.xml.ts';

describe('sitemap route', () => {
  beforeEach(() => {
    mocks.findPosts.mockReset();
    mocks.findPages.mockReset();
    mocks.getSiteContentRouting.mockReset();
    mocks.getSiteLocaleConfig.mockReset();
    mocks.resolveSiteUrl.mockReset();
  });

  it('maps the legacy article index page slug to the configured article base path', async () => {
    mocks.resolveSiteUrl.mockReturnValue('https://www.adastro.no');
    mocks.getSiteContentRouting.mockResolvedValue({
      articleBasePath: 'articles',
      articlePermalinkStyle: 'segment'
    });
    mocks.getSiteLocaleConfig.mockResolvedValue({
      defaultLocale: 'en',
      locales: ['en']
    });
    mocks.findPosts.mockResolvedValue([]);
    mocks.findPages.mockResolvedValue([
      {
        slug: 'blog',
        updatedAt: new Date('2026-03-11T08:26:41.356Z')
      }
    ]);

    const response = await GET({
      request: new Request('https://www.adastro.no/sitemap.xml')
    } as any);

    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('<loc>https://www.adastro.no/en/articles</loc>');
    expect(body).not.toContain('<loc>https://www.adastro.no/en/blog</loc>');
  });
});
