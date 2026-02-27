import { describe, it, expect } from 'vitest';
import {
  sanitizeHtml,
  generateSlug,
  generateExcerpt,
  transformDbAuthor,
  transformDbCategory,
  transformDbTag,
  transformDbMediaAsset,
  transformDbBlogPost,
  prepareAuthorForDb,
  prepareCategoryForDb,
  prepareTagForDb,
  prepareMediaAssetForDb,
  prepareBlogPostForDb,
  normalizeSEOMetadata,
} from '../data-transform';

describe('Data Transformation Utilities', () => {
  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const input = '<p>Safe content</p><script>alert("xss")</script>';
      const result = sanitizeHtml(input);
      expect(result).toBe('<p>Safe content</p>');
    });

    it('should remove event handlers', () => {
      const input = '<div onclick="alert(\'xss\')">Content</div>';
      const result = sanitizeHtml(input);
      expect(result).toBe('<div>Content</div>');
    });

    it('should remove javascript: URLs', () => {
      const input = '<a href="javascript:alert(\'xss\')">Link</a>';
      const result = sanitizeHtml(input);
      expect(result).toBe('<a>Link</a>');
    });

    it('should preserve safe HTML', () => {
      const input = '<p><strong>Bold</strong> and <em>italic</em> text</p>';
      const result = sanitizeHtml(input);
      expect(result).toBe(input);
    });
  });

  describe('generateSlug', () => {
    it('should create valid slugs from titles', () => {
      expect(generateSlug('Hello World')).toBe('hello-world');
      expect(generateSlug('This is a Test!')).toBe('this-is-a-test');
      expect(generateSlug('Special @#$% Characters')).toBe('special-characters');
    });

    it('should handle edge cases', () => {
      expect(generateSlug('   Multiple   Spaces   ')).toBe('multiple-spaces');
      expect(generateSlug('Under_scores_and-dashes')).toBe('under-scores-and-dashes');
      expect(generateSlug('123 Numbers 456')).toBe('123-numbers-456');
    });

    it('should handle empty or special-only strings', () => {
      expect(generateSlug('')).toBe('');
      expect(generateSlug('!@#$%^&*()')).toBe('');
      expect(generateSlug('   ')).toBe('');
    });
  });

  describe('generateExcerpt', () => {
    it('should extract plain text from markdown', () => {
      const content = '# Heading\n\nThis is **bold** and *italic* text with a [link](http://example.com).';
      const result = generateExcerpt(content);
      expect(result).toBe('Heading This is bold and italic text with a link.');
    });

    it('should truncate long content', () => {
      const content = 'a'.repeat(200);
      const result = generateExcerpt(content, 50);
      expect(result).toHaveLength(53); // 50 + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    it('should preserve short content', () => {
      const content = 'Short content';
      const result = generateExcerpt(content, 50);
      expect(result).toBe('Short content');
    });

    it('should break at word boundaries', () => {
      const content = 'This is a very long sentence that should be truncated at word boundaries';
      const result = generateExcerpt(content, 30);
      expect(result).toBe('This is a very long sentence...');
      expect(result.length).toBeLessThanOrEqual(33); // 30 + '...'
    });
  });

  describe('transformDbAuthor', () => {
    it('should transform database row to Author object', () => {
      const dbRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com',
        bio: 'Author bio',
        avatar_url: 'https://example.com/avatar.jpg',
        social_links: JSON.stringify([{ platform: 'twitter', url: 'https://twitter.com/johndoe' }]),
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      };

      const result = transformDbAuthor(dbRow);

      expect(result.id).toBe(dbRow.id);
      expect(result.name).toBe(dbRow.name);
      expect(result.email).toBe(dbRow.email);
      expect(result.bio).toBe(dbRow.bio);
      expect(result.avatar?.url).toBe(dbRow.avatar_url);
      expect(result.socialLinks).toEqual([{ platform: 'twitter', url: 'https://twitter.com/johndoe' }]);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should handle null optional fields', () => {
      const dbRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Jane Doe',
        email: 'jane@example.com',
        bio: null,
        avatar_url: null,
        social_links: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      };

      const result = transformDbAuthor(dbRow);

      expect(result.bio).toBeUndefined();
      expect(result.avatar).toBeUndefined();
      expect(result.socialLinks).toBeUndefined();
    });
  });

  describe('transformDbCategory', () => {
    it('should transform database row to Category object', () => {
      const dbRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Technology',
        slug: 'technology',
        description: 'Tech posts',
        parent_id: '123e4567-e89b-12d3-a456-426614174001',
        created_at: '2023-01-01T00:00:00Z',
      };

      const result = transformDbCategory(dbRow);

      expect(result.id).toBe(dbRow.id);
      expect(result.name).toBe(dbRow.name);
      expect(result.slug).toBe(dbRow.slug);
      expect(result.description).toBe(dbRow.description);
      expect(result.parentId).toBe(dbRow.parent_id);
      expect(result.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('transformDbTag', () => {
    it('should transform database row to Tag object', () => {
      const dbRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'JavaScript',
        slug: 'javascript',
        created_at: '2023-01-01T00:00:00Z',
      };

      const result = transformDbTag(dbRow);

      expect(result.id).toBe(dbRow.id);
      expect(result.name).toBe(dbRow.name);
      expect(result.slug).toBe(dbRow.slug);
      expect(result.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('transformDbMediaAsset', () => {
    it('should transform database row to MediaAsset object', () => {
      const dbRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        filename: 'image.jpg',
        url: 'https://example.com/image.jpg',
        storage_path: 'uploads/image.jpg',
        alt_text: 'Alt text',
        caption: 'Caption',
        mime_type: 'image/jpeg',
        file_size: 1024000,
        dimensions: JSON.stringify({ width: 1920, height: 1080 }),
        created_at: '2023-01-01T00:00:00Z',
      };

      const result = transformDbMediaAsset(dbRow);

      expect(result.id).toBe(dbRow.id);
      expect(result.filename).toBe(dbRow.filename);
      expect(result.url).toBe(dbRow.url);
      expect(result.storagePath).toBe(dbRow.storage_path);
      expect(result.altText).toBe(dbRow.alt_text);
      expect(result.caption).toBe(dbRow.caption);
      expect(result.mimeType).toBe(dbRow.mime_type);
      expect(result.fileSize).toBe(dbRow.file_size);
      expect(result.dimensions).toEqual({ width: 1920, height: 1080 });
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should generate URL from storage path when URL is missing', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      
      const dbRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        filename: 'image.jpg',
        storage_path: 'uploads/image.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024000,
        created_at: '2023-01-01T00:00:00Z',
      };

      const result = transformDbMediaAsset(dbRow);

      expect(result.url).toBe('https://test.supabase.co/storage/v1/object/public/media/uploads/image.jpg');
    });

    it('should accept object dimensions from jsonb columns', () => {
      const dbRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        filename: 'image.jpg',
        storage_path: 'uploads/image.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024000,
        dimensions: { width: 1024, height: 768 },
        created_at: '2023-01-01T00:00:00Z',
      };

      const result = transformDbMediaAsset(dbRow);
      expect(result.dimensions).toEqual({ width: 1024, height: 768 });
    });
  });

  describe('prepareAuthorForDb', () => {
    it('should prepare Author object for database insertion', () => {
      const author = {
        name: 'John Doe',
        email: 'john@example.com',
        bio: 'Author bio',
        avatar: { url: 'https://example.com/avatar.jpg' },
        socialLinks: [{ platform: 'twitter', url: 'https://twitter.com/johndoe' }],
      };

      const result = prepareAuthorForDb(author);

      expect(result.name).toBe(author.name);
      expect(result.email).toBe(author.email);
      expect(result.bio).toBe(author.bio);
      expect(result.avatar_url).toBe(author.avatar.url);
      expect(result.social_links).toBe(JSON.stringify(author.socialLinks));
    });

    it('should handle null optional fields', () => {
      const author = {
        name: 'Jane Doe',
        email: 'jane@example.com',
      };

      const result = prepareAuthorForDb(author);

      expect(result.bio).toBeNull();
      expect(result.avatar_url).toBeNull();
      expect(result.social_links).toBeNull();
    });
  });

  describe('prepareBlogPostForDb', () => {
    it('should prepare BlogPost object for database insertion', () => {
      const post = {
        title: 'Test Post',
        content: '<p>Content with <script>alert("xss")</script></p>',
        author: { id: '123e4567-e89b-12d3-a456-426614174000' },
        status: 'published' as const,
        publishedAt: new Date('2023-01-01'),
        seoMetadata: { metaTitle: 'SEO Title' },
        customFields: { field1: 'value1' },
      };

      const result = prepareBlogPostForDb(post);

      expect(result.title).toBe(post.title);
      expect(result.slug).toBe('test-post');
      expect(result.content).toBe('<p>Content with </p>'); // Script removed
      expect(result.author_id).toBe(post.author.id);
      expect(result.status).toBe(post.status);
      expect(result.published_at).toBe(post.publishedAt);
      expect(result.seo_metadata).toBe(JSON.stringify(post.seoMetadata));
      expect(result.custom_fields).toBe(JSON.stringify(post.customFields));
    });

    it('should generate slug and excerpt when missing', () => {
      const post = {
        title: 'Auto Generated Fields',
        content: 'This is the content that will be used to generate an excerpt.',
      };

      const result = prepareBlogPostForDb(post);

      expect(result.slug).toBe('auto-generated-fields');
      expect(result.excerpt).toBe('This is the content that will be used to generate an excerpt.');
      expect(result.status).toBe('draft');
    });
  });

  describe('normalizeSEOMetadata', () => {
    it('should normalize SEO metadata with fallbacks', () => {
      const metadata = {
        metaTitle: 'Custom Title',
      };

      const post = {
        title: 'Post Title',
        excerpt: 'Post excerpt',
        featuredImage: { url: 'https://example.com/image.jpg' },
      };

      const result = normalizeSEOMetadata(metadata, post);

      expect(result.metaTitle).toBe('Custom Title');
      expect(result.metaDescription).toBe('Post excerpt');
      expect(result.openGraph?.title).toBe('Custom Title');
      expect(result.openGraph?.description).toBe('Post excerpt');
      expect(result.openGraph?.image).toBe('https://example.com/image.jpg');
      expect(result.openGraph?.type).toBe('article');
      expect(result.twitterCard?.card).toBe('summary_large_image');
    });

    it('should use post data as fallbacks', () => {
      const metadata = {};
      const post = {
        title: 'Fallback Title',
        excerpt: 'Fallback excerpt',
      };

      const result = normalizeSEOMetadata(metadata, post);

      expect(result.metaTitle).toBe('Fallback Title');
      expect(result.metaDescription).toBe('Fallback excerpt');
      expect(result.openGraph?.title).toBe('Fallback Title');
      expect(result.openGraph?.description).toBe('Fallback excerpt');
    });

    it('should truncate long titles and descriptions', () => {
      const metadata = {};
      const post = {
        title: 'a'.repeat(100),
        excerpt: 'b'.repeat(200),
      };

      const result = normalizeSEOMetadata(metadata, post);

      expect(result.metaTitle?.length).toBe(60);
      expect(result.metaDescription?.length).toBe(160);
      expect(result.openGraph?.title?.length).toBe(60);
      expect(result.openGraph?.description?.length).toBe(160);
      expect(result.twitterCard?.title?.length).toBe(60);
      expect(result.twitterCard?.description?.length).toBe(160);
    });
  });
});
