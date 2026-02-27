import { describe, it, expect, beforeEach } from 'vitest';
import { MetadataGenerator, SitemapGenerator, RSSGenerator } from '../index.js';
import type { BlogPost, Author } from '../../types/index.js';

describe('SEO Integration', () => {
  let mockPosts: BlogPost[];
  let mockAuthors: Map<string, Author>;
  let metadataGenerator: MetadataGenerator;
  let sitemapGenerator: SitemapGenerator;
  let rssGenerator: RSSGenerator;

  beforeEach(() => {
    const siteConfig = {
      siteUrl: 'https://example.com',
      siteName: 'Integration Test Blog',
      siteDescription: 'A blog for testing SEO integration',
      defaultImage: 'https://example.com/default.jpg',
      twitterHandle: '@testblog'
    };

    metadataGenerator = new MetadataGenerator(siteConfig);
    sitemapGenerator = new SitemapGenerator(siteConfig.siteUrl);
    rssGenerator = new RSSGenerator(siteConfig);

    const mockAuthor: Author = {
      id: 'author-1',
      name: 'Test Author',
      email: 'test@example.com',
      bio: 'Test author bio',
      socialLinks: [
        { platform: 'twitter', url: 'https://twitter.com/testauthor' },
        { platform: 'website', url: 'https://testauthor.com' }
      ],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    };

    mockAuthors = new Map([['author-1', mockAuthor]]);

    mockPosts = [
      {
        id: 'post-1',
        title: 'Complete SEO Test Post',
        slug: 'complete-seo-test-post',
        content: 'This is a comprehensive test post for SEO functionality.',
        excerpt: 'A comprehensive test for all SEO features.',
        author: mockAuthor,
        publishedAt: new Date('2024-01-15T10:00:00Z'),
        updatedAt: new Date('2024-01-16T10:00:00Z'),
        createdAt: new Date('2024-01-15T10:00:00Z'),
        status: 'published',
        categories: [
          { id: 'cat-1', name: 'SEO', slug: 'seo', createdAt: new Date() },
          { id: 'cat-2', name: 'Testing', slug: 'testing', createdAt: new Date() }
        ],
        tags: [
          { id: 'tag-1', name: 'Metadata', slug: 'metadata', createdAt: new Date() },
          { id: 'tag-2', name: 'Structured Data', slug: 'structured-data', createdAt: new Date() }
        ],
        featuredImage: {
          id: 'img-1',
          filename: 'seo-test.jpg',
          url: 'https://example.com/images/seo-test.jpg',
          storagePath: '/images/seo-test.jpg',
          altText: 'SEO test image',
          mimeType: 'image/jpeg',
          fileSize: 2048,
          dimensions: { width: 1200, height: 630 },
          createdAt: new Date()
        },
        seoMetadata: {
          metaTitle: 'Custom SEO Title for Testing',
          metaDescription: 'Custom meta description for comprehensive SEO testing.',
          canonicalUrl: 'https://example.com/blog/complete-seo-test-post'
        }
      }
    ];
  });

  describe('Complete SEO workflow', () => {
    it('should generate consistent URLs across all SEO components', () => {
      const post = mockPosts[0];
      const author = mockAuthors.get(post.author.id)!;

      // Generate metadata
      const metadata = metadataGenerator.generatePostMetadata(post, author);
      
      // Generate sitemap
      const sitemap = sitemapGenerator.generateSitemap(mockPosts);
      
      // Generate RSS
      const rss = rssGenerator.generateRSSFeed(mockPosts, mockAuthors);

      const expectedUrl = 'https://example.com/blog/complete-seo-test-post';

      // Check URL consistency
      expect(metadata.canonicalUrl).toBe(expectedUrl);
      expect(metadata.openGraph?.url).toBe(expectedUrl);
      expect(sitemap).toContain(`<loc>${expectedUrl}</loc>`);
      expect(rss).toContain(`<link>${expectedUrl}</link>`);
      expect(rss).toContain(`<guid isPermaLink="true">${expectedUrl}</guid>`);
    });

    it('should generate complete structured data with all required fields', () => {
      const post = mockPosts[0];
      const author = mockAuthors.get(post.author.id)!;
      const metadata = metadataGenerator.generatePostMetadata(post, author);

      expect(metadata.jsonLd).toMatchObject({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: 'Complete SEO Test Post',
        description: 'A comprehensive test for all SEO features.',
        image: 'https://example.com/images/seo-test.jpg',
        datePublished: '2024-01-15T10:00:00.000Z',
        dateModified: '2024-01-16T10:00:00.000Z',
        author: {
          '@type': 'Person',
          name: 'Test Author',
          url: 'https://testauthor.com'
        },
        publisher: {
          '@type': 'Organization',
          name: 'Integration Test Blog',
          logo: {
            '@type': 'ImageObject',
            url: 'https://example.com/default.jpg'
          }
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': 'https://example.com/blog/complete-seo-test-post'
        },
        articleSection: 'SEO',
        keywords: ['Metadata', 'Structured Data']
      });
    });

    it('should generate comprehensive Open Graph metadata', () => {
      const post = mockPosts[0];
      const author = mockAuthors.get(post.author.id)!;
      const metadata = metadataGenerator.generatePostMetadata(post, author);

      expect(metadata.openGraph).toMatchObject({
        title: 'Custom SEO Title for Testing',
        description: 'Custom meta description for comprehensive SEO testing.',
        url: 'https://example.com/blog/complete-seo-test-post',
        image: 'https://example.com/images/seo-test.jpg',
        imageAlt: 'SEO test image',
        type: 'article',
        siteName: 'Integration Test Blog',
        locale: 'en_US',
        publishedTime: '2024-01-15T10:00:00.000Z',
        modifiedTime: '2024-01-16T10:00:00.000Z',
        author: 'Test Author',
        section: 'SEO',
        tags: ['Metadata', 'Structured Data']
      });
    });

    it('should generate proper Twitter Card metadata', () => {
      const post = mockPosts[0];
      const author = mockAuthors.get(post.author.id)!;
      const metadata = metadataGenerator.generatePostMetadata(post, author);

      expect(metadata.twitterCard).toMatchObject({
        card: 'summary_large_image',
        site: '@testblog',
        creator: '@testauthor',
        title: 'Custom SEO Title for Testing',
        description: 'Custom meta description for comprehensive SEO testing.',
        image: 'https://example.com/images/seo-test.jpg',
        imageAlt: 'SEO test image'
      });
    });

    it('should include all post categories and tags in sitemap', () => {
      const sitemap = sitemapGenerator.generateSitemap(mockPosts);

      // Check category pages
      expect(sitemap).toContain('<loc>https://example.com/category/seo</loc>');
      expect(sitemap).toContain('<loc>https://example.com/category/testing</loc>');

      // Check tag pages
      expect(sitemap).toContain('<loc>https://example.com/tag/metadata</loc>');
      expect(sitemap).toContain('<loc>https://example.com/tag/structured-data</loc>');
    });

    it('should include post categories in RSS feed', () => {
      const rss = rssGenerator.generateRSSFeed(mockPosts, mockAuthors);

      expect(rss).toContain('<category>SEO</category>');
      expect(rss).toContain('<category>Testing</category>');
    });

    it('should handle posts without featured images gracefully', () => {
      const postWithoutImage = {
        ...mockPosts[0],
        featuredImage: undefined
      };

      const author = mockAuthors.get(postWithoutImage.author.id)!;
      const metadata = metadataGenerator.generatePostMetadata(postWithoutImage, author);

      expect(metadata.openGraph?.image).toBe('https://example.com/default.jpg');
      expect(metadata.twitterCard?.image).toBe('https://example.com/default.jpg');
      expect(metadata.jsonLd?.image).toBe('https://example.com/default.jpg');
    });

    it('should generate valid XML for both sitemap and RSS', () => {
      const sitemap = sitemapGenerator.generateSitemap(mockPosts);
      const rss = rssGenerator.generateRSSFeed(mockPosts, mockAuthors);

      // Basic XML validation
      expect(sitemap).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
      expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(sitemap).toContain('</urlset>');

      expect(rss).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
      expect(rss).toContain('<rss version="2.0"');
      expect(rss).toContain('</rss>');
    });

    it('should maintain consistent date formatting across components', () => {
      const post = mockPosts[0];
      const author = mockAuthors.get(post.author.id)!;
      const metadata = metadataGenerator.generatePostMetadata(post, author);
      const rss = rssGenerator.generateRSSFeed(mockPosts, mockAuthors);

      // Check ISO date format in structured data
      expect(metadata.jsonLd?.datePublished).toBe('2024-01-15T10:00:00.000Z');
      expect(metadata.jsonLd?.dateModified).toBe('2024-01-16T10:00:00.000Z');

      // Check RFC 2822 date format in RSS
      expect(rss).toContain('<pubDate>Mon, 15 Jan 2024 10:00:00 GMT</pubDate>');
    });
  });
});