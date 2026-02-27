import { describe, it, expect, beforeEach } from 'vitest';
import { SitemapGenerator } from '../sitemap-generator.js';
import type { BlogPost, Author } from '../../types/index.js';

describe('SitemapGenerator', () => {
  let generator: SitemapGenerator;
  let mockPosts: BlogPost[];

  beforeEach(() => {
    generator = new SitemapGenerator('https://example.com');

    const mockAuthor: Author = {
      id: 'author-1',
      name: 'John Doe',
      email: 'john@example.com',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockPosts = [
      {
        id: 'post-1',
        title: 'First Post',
        slug: 'first-post',
        content: 'Content',
        author: mockAuthor,
        publishedAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-16'),
        createdAt: new Date('2024-01-15'),
        status: 'published',
        categories: [
          { id: 'cat-1', name: 'Technology', slug: 'technology', createdAt: new Date() }
        ],
        tags: [
          { id: 'tag-1', name: 'JavaScript', slug: 'javascript', createdAt: new Date() }
        ]
      },
      {
        id: 'post-2',
        title: 'Draft Post',
        slug: 'draft-post',
        content: 'Content',
        author: mockAuthor,
        updatedAt: new Date('2024-01-17'),
        createdAt: new Date('2024-01-17'),
        status: 'draft',
        categories: [],
        tags: []
      },
      {
        id: 'post-3',
        title: 'Second Post',
        slug: 'second-post',
        content: 'Content',
        author: mockAuthor,
        publishedAt: new Date('2024-01-18'),
        updatedAt: new Date('2024-01-18'),
        createdAt: new Date('2024-01-18'),
        status: 'published',
        categories: [
          { id: 'cat-2', name: 'Design', slug: 'design', createdAt: new Date() }
        ],
        tags: [
          { id: 'tag-2', name: 'CSS', slug: 'css', createdAt: new Date() }
        ]
      }
    ];
  });

  describe('generateSitemap', () => {
    it('should generate XML sitemap with published posts only', () => {
      const sitemap = generator.generateSitemap(mockPosts);

      expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(sitemap).toContain('<loc>https://example.com/blog/first-post</loc>');
      expect(sitemap).toContain('<loc>https://example.com/blog/second-post</loc>');
      expect(sitemap).not.toContain('draft-post');
    });

    it('should include category and tag pages', () => {
      const sitemap = generator.generateSitemap(mockPosts);

      expect(sitemap).toContain('<loc>https://example.com/category/technology</loc>');
      expect(sitemap).toContain('<loc>https://example.com/category/design</loc>');
      expect(sitemap).toContain('<loc>https://example.com/tag/javascript</loc>');
      expect(sitemap).toContain('<loc>https://example.com/tag/css</loc>');
    });

    it('should include static pages when provided', () => {
      const staticPages = [
        {
          url: 'https://example.com/custom-page',
          changefreq: 'monthly' as const,
          priority: 0.7
        }
      ];

      const sitemap = generator.generateSitemap(mockPosts, staticPages);

      expect(sitemap).toContain('<loc>https://example.com/custom-page</loc>');
      expect(sitemap).toContain('<changefreq>monthly</changefreq>');
      expect(sitemap).toContain('<priority>0.7</priority>');
    });

    it('should include lastmod dates for posts', () => {
      const sitemap = generator.generateSitemap(mockPosts);

      expect(sitemap).toContain('<lastmod>2024-01-16</lastmod>');
      expect(sitemap).toContain('<lastmod>2024-01-18</lastmod>');
    });

    it('should set appropriate priorities and change frequencies', () => {
      const sitemap = generator.generateSitemap(mockPosts);

      // Posts should have priority 0.8 and weekly changefreq
      expect(sitemap).toContain('<priority>0.8</priority>');
      expect(sitemap).toContain('<changefreq>weekly</changefreq>');
    });

    it('should handle empty posts array', () => {
      const sitemap = generator.generateSitemap([]);

      expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(sitemap).toContain('</urlset>');
    });

    it('should escape XML characters in URLs', () => {
      const postsWithSpecialChars = [{
        ...mockPosts[0],
        slug: 'post-with-&-ampersand',
        categories: [
          { id: 'cat-1', name: 'Tech & Design', slug: 'tech-&-design', createdAt: new Date() }
        ]
      }];

      const sitemap = generator.generateSitemap(postsWithSpecialChars);

      expect(sitemap).toContain('post-with-&amp;-ampersand');
      expect(sitemap).toContain('tech-&amp;-design');
    });
  });

  describe('getDefaultStaticPages', () => {
    it('should return default static pages with correct priorities', () => {
      const staticPages = generator.getDefaultStaticPages();

      expect(staticPages).toHaveLength(4);
      
      const homePage = staticPages.find(page => page.url === 'https://example.com/');
      expect(homePage?.priority).toBe(1.0);
      expect(homePage?.changefreq).toBe('daily');

      const blogPage = staticPages.find(page => page.url === 'https://example.com/blog');
      expect(blogPage?.priority).toBe(0.9);
      expect(blogPage?.changefreq).toBe('daily');

      const aboutPage = staticPages.find(page => page.url === 'https://example.com/about');
      expect(aboutPage?.priority).toBe(0.7);
      expect(aboutPage?.changefreq).toBe('monthly');

      const contactPage = staticPages.find(page => page.url === 'https://example.com/contact');
      expect(contactPage?.priority).toBe(0.6);
      expect(contactPage?.changefreq).toBe('monthly');
    });

    it('should use custom article base path for default article index entry', () => {
      const customGenerator = new SitemapGenerator('https://example.com', {
        articleBasePath: 'articles'
      });
      const staticPages = customGenerator.getDefaultStaticPages();

      const articlesPage = staticPages.find(page => page.url === 'https://example.com/articles');
      expect(articlesPage?.priority).toBe(0.9);
      expect(articlesPage?.changefreq).toBe('daily');
    });
  });

  describe('constructor', () => {
    it('should remove trailing slash from site URL', () => {
      const generatorWithSlash = new SitemapGenerator('https://example.com/');
      const staticPages = generatorWithSlash.getDefaultStaticPages();
      
      expect(staticPages[0].url).toBe('https://example.com/');
    });

    it('should support wordpress permalink style for post entries', () => {
      const wordpressGenerator = new SitemapGenerator('https://example.com', {
        articleBasePath: 'posts',
        articlePermalinkStyle: 'wordpress'
      });
      const sitemap = wordpressGenerator.generateSitemap(mockPosts);

      expect(sitemap).toContain('<loc>https://example.com/2024/01/15/first-post</loc>');
      expect(sitemap).toContain('<loc>https://example.com/2024/01/18/second-post</loc>');
      expect(sitemap).not.toContain('https://example.com/posts/first-post');
    });
  });
});
