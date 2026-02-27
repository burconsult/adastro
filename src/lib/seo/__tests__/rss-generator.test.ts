import { describe, it, expect, beforeEach } from 'vitest';
import { RSSGenerator } from '../rss-generator.js';
import type { BlogPost, Author } from '../../types/index.js';

describe('RSSGenerator', () => {
  let generator: RSSGenerator;
  let mockPosts: BlogPost[];
  let mockAuthors: Map<string, Author>;

  beforeEach(() => {
    generator = new RSSGenerator({
      siteUrl: 'https://example.com',
      siteName: 'Test Blog',
      siteDescription: 'A test blog for RSS generation'
    });

    const mockAuthor1: Author = {
      id: 'author-1',
      name: 'John Doe',
      email: 'john@example.com',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockAuthor2: Author = {
      id: 'author-2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockAuthors = new Map([
      ['author-1', mockAuthor1],
      ['author-2', mockAuthor2]
    ]);

    mockPosts = [
      {
        id: 'post-1',
        title: 'First Post',
        slug: 'first-post',
        content: '<p>This is the first post content with <strong>HTML</strong> tags.</p>',
        excerpt: 'This is the first post excerpt.',
        author: mockAuthor1,
        publishedAt: new Date('2024-01-15T10:00:00Z'),
        updatedAt: new Date('2024-01-15T10:00:00Z'),
        createdAt: new Date('2024-01-15T10:00:00Z'),
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
        content: 'Draft content',
        author: mockAuthor1,
        updatedAt: new Date('2024-01-16T10:00:00Z'),
        createdAt: new Date('2024-01-16T10:00:00Z'),
        status: 'draft',
        categories: [],
        tags: []
      },
      {
        id: 'post-3',
        title: 'Second Post',
        slug: 'second-post',
        content: 'Second post content',
        excerpt: 'Second post excerpt.',
        author: mockAuthor2,
        publishedAt: new Date('2024-01-18T15:30:00Z'),
        updatedAt: new Date('2024-01-18T15:30:00Z'),
        createdAt: new Date('2024-01-18T15:30:00Z'),
        status: 'published',
        categories: [
          { id: 'cat-2', name: 'Design', slug: 'design', createdAt: new Date() },
          { id: 'cat-3', name: 'UX', slug: 'ux', createdAt: new Date() }
        ],
        tags: [
          { id: 'tag-2', name: 'CSS', slug: 'css', createdAt: new Date() }
        ]
      }
    ];
  });

  describe('generateRSSFeed', () => {
    it('should generate valid RSS XML with published posts only', () => {
      const rssXml = generator.generateRSSFeed(mockPosts, mockAuthors);

      expect(rssXml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(rssXml).toContain('<rss version="2.0"');
      expect(rssXml).toContain('<title>Test Blog</title>');
      expect(rssXml).toContain('<description>A test blog for RSS generation</description>');
      expect(rssXml).toContain('<link>https://example.com</link>');
      expect(rssXml).toContain('<language>en-us</language>');
    });

    it('should include published posts in correct order (newest first)', () => {
      const rssXml = generator.generateRSSFeed(mockPosts, mockAuthors);

      // Second post should appear before first post (newer date)
      const secondPostIndex = rssXml.indexOf('<title>Second Post</title>');
      const firstPostIndex = rssXml.indexOf('<title>First Post</title>');
      
      expect(secondPostIndex).toBeLessThan(firstPostIndex);
      expect(secondPostIndex).toBeGreaterThan(-1);
      expect(firstPostIndex).toBeGreaterThan(-1);
    });

    it('should not include draft posts', () => {
      const rssXml = generator.generateRSSFeed(mockPosts, mockAuthors);

      expect(rssXml).not.toContain('Draft Post');
      expect(rssXml).not.toContain('draft-post');
    });

    it('should include post metadata correctly', () => {
      const rssXml = generator.generateRSSFeed(mockPosts, mockAuthors);

      expect(rssXml).toContain('<title>First Post</title>');
      expect(rssXml).toContain('<description><![CDATA[This is the first post excerpt.]]></description>');
      expect(rssXml).toContain('<link>https://example.com/blog/first-post</link>');
      expect(rssXml).toContain('<guid isPermaLink="true">https://example.com/blog/first-post</guid>');
      expect(rssXml).toContain('<pubDate>Mon, 15 Jan 2024 10:00:00 GMT</pubDate>');
    });

    it('should include author information when available', () => {
      const rssXml = generator.generateRSSFeed(mockPosts, mockAuthors);

      expect(rssXml).toContain('<author>John Doe</author>');
      expect(rssXml).toContain('<author>Jane Smith</author>');
    });

    it('should include categories from post categories', () => {
      const rssXml = generator.generateRSSFeed(mockPosts, mockAuthors);

      expect(rssXml).toContain('<category>Technology</category>');
      expect(rssXml).toContain('<category>Design</category>');
      expect(rssXml).toContain('<category>UX</category>');
    });

    it('should handle posts without excerpts by using content', () => {
      // Remove excerpt from first post
      mockPosts[0].excerpt = undefined;
      const rssXml = generator.generateRSSFeed(mockPosts, mockAuthors);

      expect(rssXml).toContain('<description><![CDATA[This is the first post content with HTML tags....]]></description>');
    });

    it('should limit to 20 most recent posts', () => {
      // Create 25 posts
      const manyPosts = Array.from({ length: 25 }, (_, i) => ({
        ...mockPosts[0],
        id: `post-${i}`,
        title: `Post ${i}`,
        slug: `post-${i}`,
        publishedAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`)
      }));

      const rssXml = generator.generateRSSFeed(manyPosts, mockAuthors);
      
      // Count the number of <item> elements
      const itemCount = (rssXml.match(/<item>/g) || []).length;
      expect(itemCount).toBe(20);
    });

    it('should handle missing authors gracefully', () => {
      const emptyAuthors = new Map<string, Author>();
      const rssXml = generator.generateRSSFeed(mockPosts, emptyAuthors);

      expect(rssXml).toContain('<title>First Post</title>');
      expect(rssXml).not.toContain('<author>');
    });

    it('should escape XML characters in content', () => {
      mockPosts[0].title = 'Post with & special <characters>';
      mockPosts[0].excerpt = 'Description with "quotes" & ampersands';
      
      const rssXml = generator.generateRSSFeed(mockPosts, mockAuthors);

      expect(rssXml).toContain('<title>Post with &amp; special &lt;characters&gt;</title>');
      expect(rssXml).toContain('Description with "quotes" & ampersands'); // CDATA section doesn't need escaping
    });

    it('should set lastBuildDate to most recent post date', () => {
      const rssXml = generator.generateRSSFeed(mockPosts, mockAuthors);

      // Should use the date from the most recent post (Second Post - 2024-01-18)
      expect(rssXml).toContain('<lastBuildDate>Thu, 18 Jan 2024 15:30:00 GMT</lastBuildDate>');
    });

    it('should include atom:link for self-reference', () => {
      const rssXml = generator.generateRSSFeed(mockPosts, mockAuthors);

      expect(rssXml).toContain('<atom:link href="https://example.com/rss.xml" rel="self" type="application/rss+xml" />');
    });
  });

  describe('constructor', () => {
    it('should remove trailing slash from site URL', () => {
      const generatorWithSlash = new RSSGenerator({
        siteUrl: 'https://example.com/',
        siteName: 'Test',
        siteDescription: 'Test'
      });

      const rssXml = generatorWithSlash.generateRSSFeed(mockPosts, mockAuthors);
      expect(rssXml).toContain('<link>https://example.com</link>');
    });

    it('should use custom language when provided', () => {
      const customGenerator = new RSSGenerator({
        siteUrl: 'https://example.com',
        siteName: 'Test',
        siteDescription: 'Test',
        language: 'fr-fr'
      });

      const rssXml = customGenerator.generateRSSFeed(mockPosts, mockAuthors);
      expect(rssXml).toContain('<language>fr-fr</language>');
    });
  });
});
