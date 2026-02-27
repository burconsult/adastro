import { describe, it, expect, beforeEach } from 'vitest';
import { MetadataGenerator } from '../metadata-generator.js';
import type { BlogPost, Author } from '../../types/index.js';

describe('MetadataGenerator', () => {
  let generator: MetadataGenerator;
  let mockPost: BlogPost;
  let mockAuthor: Author;

  beforeEach(() => {
    generator = new MetadataGenerator({
      siteUrl: 'https://example.com',
      siteName: 'Test Blog',
      defaultImage: 'https://example.com/default.jpg',
      twitterHandle: '@testblog'
    });

    mockAuthor = {
      id: 'author-1',
      name: 'John Doe',
      email: 'john@example.com',
      bio: 'Test author',
      socialLinks: [
        { platform: 'twitter', url: 'https://twitter.com/johndoe' },
        { platform: 'website', url: 'https://johndoe.com' }
      ],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    };

    mockPost = {
      id: 'post-1',
      title: 'Test Blog Post',
      slug: 'test-blog-post',
      content: 'This is a test blog post content.',
      excerpt: 'This is a test excerpt.',
      author: mockAuthor,
      publishedAt: new Date('2024-01-15T10:00:00Z'),
      updatedAt: new Date('2024-01-16T10:00:00Z'),
      createdAt: new Date('2024-01-15T10:00:00Z'),
      status: 'published',
      categories: [
        { id: 'cat-1', name: 'Technology', slug: 'technology', createdAt: new Date() }
      ],
      tags: [
        { id: 'tag-1', name: 'JavaScript', slug: 'javascript', createdAt: new Date() },
        { id: 'tag-2', name: 'Testing', slug: 'testing', createdAt: new Date() }
      ],
      featuredImage: {
        id: 'img-1',
        filename: 'featured.jpg',
        url: 'https://example.com/featured.jpg',
        storagePath: '/images/featured.jpg',
        altText: 'Featured image alt text',
        mimeType: 'image/jpeg',
        fileSize: 1024,
        dimensions: { width: 800, height: 600 },
        createdAt: new Date()
      }
    };
  });

  describe('generatePostMetadata', () => {
    it('should generate complete SEO metadata for a blog post', () => {
      const metadata = generator.generatePostMetadata(mockPost, mockAuthor);

      expect(metadata.title).toBe('Test Blog Post');
      expect(metadata.description).toBe('This is a test excerpt.');
      expect(metadata.canonicalUrl).toBe('https://example.com/blog/test-blog-post');
      expect(metadata.noIndex).toBe(false);
    });

    it('should use custom SEO metadata when provided', () => {
      mockPost.seoMetadata = {
        metaTitle: 'Custom Title',
        metaDescription: 'Custom description',
        noIndex: true
      };

      const metadata = generator.generatePostMetadata(mockPost, mockAuthor);

      expect(metadata.title).toBe('Custom Title');
      expect(metadata.description).toBe('Custom description');
      expect(metadata.noIndex).toBe(true);
    });

    it('should generate Open Graph metadata', () => {
      const metadata = generator.generatePostMetadata(mockPost, mockAuthor);

      expect(metadata.openGraph).toEqual({
        title: 'Test Blog Post',
        description: 'This is a test excerpt.',
        url: 'https://example.com/blog/test-blog-post',
        image: 'https://example.com/featured.jpg',
        imageAlt: 'Featured image alt text',
        type: 'article',
        siteName: 'Test Blog',
        locale: 'en_US',
        publishedTime: '2024-01-15T10:00:00.000Z',
        modifiedTime: '2024-01-16T10:00:00.000Z',
        author: 'John Doe',
        section: 'Technology',
        tags: ['JavaScript', 'Testing']
      });
    });

    it('should generate Twitter Card metadata', () => {
      const metadata = generator.generatePostMetadata(mockPost, mockAuthor);

      expect(metadata.twitterCard).toEqual({
        card: 'summary_large_image',
        site: '@testblog',
        creator: '@johndoe',
        title: 'Test Blog Post',
        description: 'This is a test excerpt.',
        image: 'https://example.com/featured.jpg',
        imageAlt: 'Featured image alt text'
      });
    });

    it('should generate JSON-LD structured data', () => {
      const metadata = generator.generatePostMetadata(mockPost, mockAuthor);

      expect(metadata.jsonLd).toEqual({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: 'Test Blog Post',
        description: 'This is a test excerpt.',
        image: 'https://example.com/featured.jpg',
        datePublished: '2024-01-15T10:00:00.000Z',
        dateModified: '2024-01-16T10:00:00.000Z',
        author: {
          '@type': 'Person',
          name: 'John Doe',
          url: 'https://johndoe.com'
        },
        publisher: {
          '@type': 'Organization',
          name: 'Test Blog',
          logo: {
            '@type': 'ImageObject',
            url: 'https://example.com/default.jpg'
          }
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': 'https://example.com/blog/test-blog-post'
        },
        articleSection: 'Technology',
        keywords: ['JavaScript', 'Testing']
      });
    });

    it('should use default image when no featured image is provided', () => {
      mockPost.featuredImage = undefined;
      const metadata = generator.generatePostMetadata(mockPost, mockAuthor);

      expect(metadata.openGraph?.image).toBe('https://example.com/default.jpg');
      expect(metadata.twitterCard?.image).toBe('https://example.com/default.jpg');
    });

    it('should respect custom article base path for canonical URLs', () => {
      const customRoutingGenerator = new MetadataGenerator({
        siteUrl: 'https://example.com',
        siteName: 'Test Blog',
        defaultImage: 'https://example.com/default.jpg',
        articleBasePath: 'articles'
      });

      const metadata = customRoutingGenerator.generatePostMetadata(mockPost, mockAuthor);
      expect(metadata.canonicalUrl).toBe('https://example.com/articles/test-blog-post');
      expect(metadata.openGraph?.url).toBe('https://example.com/articles/test-blog-post');
    });

    it('should generate wordpress-style canonical URLs when configured', () => {
      const wordpressGenerator = new MetadataGenerator({
        siteUrl: 'https://example.com',
        siteName: 'Test Blog',
        defaultImage: 'https://example.com/default.jpg',
        articleBasePath: 'posts',
        articlePermalinkStyle: 'wordpress'
      });

      const metadata = wordpressGenerator.generatePostMetadata(mockPost, mockAuthor);
      expect(metadata.canonicalUrl).toBe('https://example.com/2024/01/15/test-blog-post');
      expect(metadata.openGraph?.url).toBe('https://example.com/2024/01/15/test-blog-post');
    });
  });

  describe('generatePageMetadata', () => {
    it('should generate metadata for static pages', () => {
      const metadata = generator.generatePageMetadata(
        'About Page',
        'Learn more about us',
        '/about'
      );

      expect(metadata.title).toBe('About Page');
      expect(metadata.description).toBe('Learn more about us');
      expect(metadata.canonicalUrl).toBe('https://example.com/about');
      expect(metadata.openGraph?.type).toBe('website');
    });

    it('should handle root path correctly', () => {
      const metadata = generator.generatePageMetadata(
        'Home Page',
        'Welcome to our blog'
      );

      expect(metadata.canonicalUrl).toBe('https://example.com');
    });
  });

  describe('generateMetaTags', () => {
    it('should generate HTML meta tags', () => {
      const metadata = generator.generatePostMetadata(mockPost, mockAuthor);
      const metaTags = generator.generateMetaTags(metadata);

      expect(metaTags).toContain('<title>Test Blog Post</title>');
      expect(metaTags).toContain('<meta name="description" content="This is a test excerpt." />');
      expect(metaTags).toContain('<link rel="canonical" href="https://example.com/blog/test-blog-post" />');
      expect(metaTags).toContain('<meta property="og:title" content="Test Blog Post" />');
      expect(metaTags).toContain('<meta name="twitter:card" content="summary_large_image" />');
    });

    it('should handle noIndex robots meta tag', () => {
      mockPost.seoMetadata = { noIndex: true, noFollow: true };
      const metadata = generator.generatePostMetadata(mockPost, mockAuthor);
      const metaTags = generator.generateMetaTags(metadata);

      expect(metaTags).toContain('<meta name="robots" content="noindex, nofollow" />');
    });

    it('should escape HTML in meta tag content', () => {
      mockPost.title = 'Test & "Special" Characters <script>';
      const metadata = generator.generatePostMetadata(mockPost, mockAuthor);
      const metaTags = generator.generateMetaTags(metadata);

      expect(metaTags).toContain('Test &amp; &quot;Special&quot; Characters &lt;script&gt;');
    });
  });

  describe('generateJsonLdScript', () => {
    it('should generate JSON-LD script tag', () => {
      const jsonLd = { '@type': 'Article', headline: 'Test' };
      const script = generator.generateJsonLdScript(jsonLd);

      expect(script).toContain('<script type="application/ld+json">');
      expect(script).toContain('"@type": "Article"');
      expect(script).toContain('"headline": "Test"');
      expect(script).toContain('</script>');
    });
  });
});
