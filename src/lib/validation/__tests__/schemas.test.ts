import { describe, it, expect } from 'vitest';
import {
  authorSchema,
  categorySchema,
  tagSchema,
  mediaAssetSchema,
  blogPostSchema,
  seoMetadataSchema,
  createAuthorSchema,
  updateAuthorSchema,
  createBlogPostSchema,
  updateBlogPostSchema,
  postFiltersSchema,
  uuidSchema,
  slugSchema,
  emailSchema,
} from '../schemas';

describe('Base Validation Schemas', () => {
  describe('uuidSchema', () => {
    it('should validate valid UUIDs', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      expect(() => uuidSchema.parse(validUuid)).not.toThrow();
    });

    it('should reject invalid UUIDs', () => {
      expect(() => uuidSchema.parse('invalid-uuid')).toThrow();
      expect(() => uuidSchema.parse('123')).toThrow();
    });
  });

  describe('slugSchema', () => {
    it('should validate valid slugs', () => {
      expect(() => slugSchema.parse('valid-slug')).not.toThrow();
      expect(() => slugSchema.parse('another-valid-slug-123')).not.toThrow();
    });

    it('should reject invalid slugs', () => {
      expect(() => slugSchema.parse('Invalid Slug')).toThrow();
      expect(() => slugSchema.parse('invalid_slug')).toThrow();
      expect(() => slugSchema.parse('invalid@slug')).toThrow();
      expect(() => slugSchema.parse('')).toThrow();
    });
  });

  describe('emailSchema', () => {
    it('should validate valid emails', () => {
      expect(() => emailSchema.parse('test@example.com')).not.toThrow();
      expect(() => emailSchema.parse('user.name+tag@domain.co.uk')).not.toThrow();
    });

    it('should reject invalid emails', () => {
      expect(() => emailSchema.parse('invalid-email')).toThrow();
      expect(() => emailSchema.parse('@domain.com')).toThrow();
      expect(() => emailSchema.parse('user@')).toThrow();
    });
  });
});

describe('Author Schema', () => {
  const validAuthor = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'John Doe',
    email: 'john@example.com',
    bio: 'A passionate writer',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should validate a complete author object', () => {
    expect(() => authorSchema.parse(validAuthor)).not.toThrow();
  });

  it('should validate author with optional fields', () => {
    const minimalAuthor = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Jane Doe',
      email: 'jane@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(() => authorSchema.parse(minimalAuthor)).not.toThrow();
  });

  it('should reject author with invalid email', () => {
    const invalidAuthor = { ...validAuthor, email: 'invalid-email' };
    expect(() => authorSchema.parse(invalidAuthor)).toThrow();
  });

  it('should reject author with empty name', () => {
    const invalidAuthor = { ...validAuthor, name: '' };
    expect(() => authorSchema.parse(invalidAuthor)).toThrow();
  });

  it('should reject author with name too long', () => {
    const invalidAuthor = { ...validAuthor, name: 'a'.repeat(101) };
    expect(() => authorSchema.parse(invalidAuthor)).toThrow();
  });
});

describe('Category Schema', () => {
  const validCategory = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Technology',
    slug: 'technology',
    description: 'Tech-related posts',
    createdAt: new Date(),
  };

  it('should validate a complete category object', () => {
    expect(() => categorySchema.parse(validCategory)).not.toThrow();
  });

  it('should validate category without optional fields', () => {
    const minimalCategory = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Science',
      slug: 'science',
      createdAt: new Date(),
    };
    expect(() => categorySchema.parse(minimalCategory)).not.toThrow();
  });

  it('should reject category with invalid slug', () => {
    const invalidCategory = { ...validCategory, slug: 'Invalid Slug' };
    expect(() => categorySchema.parse(invalidCategory)).toThrow();
  });

  it('should reject category with empty name', () => {
    const invalidCategory = { ...validCategory, name: '' };
    expect(() => categorySchema.parse(invalidCategory)).toThrow();
  });
});

describe('Tag Schema', () => {
  const validTag = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'JavaScript',
    slug: 'javascript',
    createdAt: new Date(),
  };

  it('should validate a valid tag object', () => {
    expect(() => tagSchema.parse(validTag)).not.toThrow();
  });

  it('should reject tag with invalid slug', () => {
    const invalidTag = { ...validTag, slug: 'Invalid Slug' };
    expect(() => tagSchema.parse(invalidTag)).toThrow();
  });

  it('should reject tag with name too long', () => {
    const invalidTag = { ...validTag, name: 'a'.repeat(51) };
    expect(() => tagSchema.parse(invalidTag)).toThrow();
  });
});

describe('Media Asset Schema', () => {
  const validMediaAsset = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    filename: 'image.jpg',
    url: 'https://example.com/image.jpg',
    storagePath: 'uploads/image.jpg',
    altText: 'A beautiful image',
    caption: 'This is a caption',
    mimeType: 'image/jpeg',
    fileSize: 1024000,
    dimensions: { width: 1920, height: 1080 },
    createdAt: new Date(),
  };

  it('should validate a complete media asset object', () => {
    expect(() => mediaAssetSchema.parse(validMediaAsset)).not.toThrow();
  });

  it('should validate media asset without optional fields', () => {
    const minimalMediaAsset = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      filename: 'document.pdf',
      url: 'https://example.com/document.pdf',
      storagePath: 'uploads/document.pdf',
      mimeType: 'application/pdf',
      fileSize: 2048000,
      createdAt: new Date(),
    };
    expect(() => mediaAssetSchema.parse(minimalMediaAsset)).not.toThrow();
  });

  it('should reject media asset with invalid URL', () => {
    const invalidMediaAsset = { ...validMediaAsset, url: 'not-a-url' };
    expect(() => mediaAssetSchema.parse(invalidMediaAsset)).toThrow();
  });

  it('should reject media asset with invalid MIME type', () => {
    const invalidMediaAsset = { ...validMediaAsset, mimeType: 'invalid-mime' };
    expect(() => mediaAssetSchema.parse(invalidMediaAsset)).toThrow();
  });

  it('should reject media asset with negative file size', () => {
    const invalidMediaAsset = { ...validMediaAsset, fileSize: -1 };
    expect(() => mediaAssetSchema.parse(invalidMediaAsset)).toThrow();
  });
});

describe('SEO Metadata Schema', () => {
  const validSEOMetadata = {
    metaTitle: 'Test Title',
    metaDescription: 'Test description for SEO',
    canonicalUrl: 'https://example.com/post',
    noIndex: false,
    openGraph: {
      title: 'OG Title',
      description: 'OG Description',
      image: 'https://example.com/og-image.jpg',
      type: 'article' as const,
      url: 'https://example.com/post',
    },
    twitterCard: {
      card: 'summary_large_image' as const,
      title: 'Twitter Title',
      description: 'Twitter Description',
      image: 'https://example.com/twitter-image.jpg',
    },
  };

  it('should validate complete SEO metadata', () => {
    expect(() => seoMetadataSchema.parse(validSEOMetadata)).not.toThrow();
  });

  it('should validate empty SEO metadata', () => {
    expect(() => seoMetadataSchema.parse({})).not.toThrow();
  });

  it('should reject SEO metadata with title too long', () => {
    const invalidSEO = { ...validSEOMetadata, metaTitle: 'a'.repeat(61) };
    expect(() => seoMetadataSchema.parse(invalidSEO)).toThrow();
  });

  it('should reject SEO metadata with description too long', () => {
    const invalidSEO = { ...validSEOMetadata, metaDescription: 'a'.repeat(161) };
    expect(() => seoMetadataSchema.parse(invalidSEO)).toThrow();
  });
});

describe('Blog Post Schema', () => {
  const validAuthor = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'John Doe',
    email: 'john@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const validCategory = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Technology',
    slug: 'technology',
    createdAt: new Date(),
  };

  const validTag = {
    id: '123e4567-e89b-12d3-a456-426614174002',
    name: 'JavaScript',
    slug: 'javascript',
    createdAt: new Date(),
  };

  const validBlogPost = {
    id: '123e4567-e89b-12d3-a456-426614174003',
    title: 'Test Blog Post',
    slug: 'test-blog-post',
    content: 'This is the content of the blog post.',
    excerpt: 'This is an excerpt',
    author: validAuthor,
    publishedAt: new Date(),
    updatedAt: new Date(),
    createdAt: new Date(),
    status: 'published' as const,
    categories: [validCategory],
    tags: [validTag],
  };

  it('should validate a complete blog post', () => {
    expect(() => blogPostSchema.parse(validBlogPost)).not.toThrow();
  });

  it('should validate blog post with minimal required fields', () => {
    const minimalPost = {
      id: '123e4567-e89b-12d3-a456-426614174003',
      title: 'Minimal Post',
      slug: 'minimal-post',
      content: 'Content',
      author: validAuthor,
      updatedAt: new Date(),
      createdAt: new Date(),
      status: 'draft' as const,
      categories: [],
      tags: [],
    };
    expect(() => blogPostSchema.parse(minimalPost)).not.toThrow();
  });

  it('should reject blog post with empty title', () => {
    const invalidPost = { ...validBlogPost, title: '' };
    expect(() => blogPostSchema.parse(invalidPost)).toThrow();
  });

  it('should reject blog post with invalid status', () => {
    const invalidPost = { ...validBlogPost, status: 'invalid' };
    expect(() => blogPostSchema.parse(invalidPost)).toThrow();
  });

  it('should reject blog post with title too long', () => {
    const invalidPost = { ...validBlogPost, title: 'a'.repeat(201) };
    expect(() => blogPostSchema.parse(invalidPost)).toThrow();
  });
});

describe('Create/Update Schemas', () => {
  describe('createAuthorSchema', () => {
    it('should validate author creation data', () => {
      const createData = {
        name: 'New Author',
        email: 'new@example.com',
        bio: 'Bio text',
      };
      expect(() => createAuthorSchema.parse(createData)).not.toThrow();
    });

    it('should reject creation data with id field', () => {
      const createData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'New Author',
        email: 'new@example.com',
      };
      expect(() => createAuthorSchema.parse(createData)).toThrow();
    });
  });

  describe('updateAuthorSchema', () => {
    it('should validate partial author update data', () => {
      const updateData = { name: 'Updated Name' };
      expect(() => updateAuthorSchema.parse(updateData)).not.toThrow();
    });

    it('should validate empty update data', () => {
      expect(() => updateAuthorSchema.parse({})).not.toThrow();
    });
  });
});

describe('Post Filters Schema', () => {
  it('should validate valid filters', () => {
    const filters = {
      status: 'published' as const,
      authorId: '123e4567-e89b-12d3-a456-426614174000',
      search: 'test query',
      limit: 20,
      offset: 10,
    };
    expect(() => postFiltersSchema.parse(filters)).not.toThrow();
  });

  it('should apply default values', () => {
    const result = postFiltersSchema.parse({});
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(0);
  });

  it('should reject invalid status', () => {
    const filters = { status: 'invalid' };
    expect(() => postFiltersSchema.parse(filters)).toThrow();
  });

  it('should reject limit too high', () => {
    const filters = { limit: 101 };
    expect(() => postFiltersSchema.parse(filters)).toThrow();
  });

  it('should reject negative offset', () => {
    const filters = { offset: -1 };
    expect(() => postFiltersSchema.parse(filters)).toThrow();
  });
});