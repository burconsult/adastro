import { z } from 'zod';

// Base validation schemas
export const uuidSchema = z.string().uuid();
export const slugSchema = z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const emailSchema = z.string().email();
export const urlSchema = z.string().url();

// Social Link schema
export const socialLinkSchema = z.object({
  platform: z.string().min(1).max(50),
  url: urlSchema,
});

// Media Asset schema
export const mediaAssetSchema = z.object({
  id: uuidSchema,
  filename: z.string().min(1).max(255),
  url: urlSchema,
  storagePath: z.string().min(1),
  altText: z.string().max(500).optional(),
  caption: z.string().max(1000).optional(),
  mimeType: z.string().regex(/^[a-z]+\/[a-z0-9\-\+]+$/),
  fileSize: z.number().positive(),
  dimensions: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }).optional(),
  originalFilename: z.string().min(1).max(255).optional(),
  originalStoragePath: z.string().min(1).optional(),
  originalMimeType: z.string().regex(/^[a-z]+\/[a-z0-9\-\+]+$/).optional(),
  originalFileSize: z.number().positive().optional(),
  originalDimensions: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }).optional(),
  createdAt: z.date(),
});

// Author schema
export const authorSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(100),
  slug: slugSchema.optional(),
  email: emailSchema,
  bio: z.string().max(1000).optional(),
  avatar: mediaAssetSchema.optional(),
  socialLinks: z.array(socialLinkSchema).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Category schema
export const categorySchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(100),
  slug: slugSchema,
  description: z.string().max(500).optional(),
  parentId: uuidSchema.optional(),
  createdAt: z.date(),
});

// Tag schema
export const tagSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(50),
  slug: slugSchema,
  createdAt: z.date(),
});

// SEO Metadata schemas
export const openGraphDataSchema = z.object({
  title: z.string().max(60).optional(),
  description: z.string().max(160).optional(),
  image: urlSchema.optional(),
  type: z.enum(['article', 'website']).optional(),
  url: urlSchema.optional(),
});

export const twitterCardDataSchema = z.object({
  card: z.enum(['summary', 'summary_large_image']).optional(),
  title: z.string().max(70).optional(),
  description: z.string().max(200).optional(),
  image: urlSchema.optional(),
});

export const seoMetadataSchema = z.object({
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  keywords: z.array(z.string().max(40)).optional(),
  canonicalUrl: urlSchema.optional(),
  noIndex: z.boolean().optional(),
  openGraph: openGraphDataSchema.optional(),
  twitterCard: twitterCardDataSchema.optional(),
});

// Blog Post schema
export const blogPostSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1).max(200),
  slug: slugSchema,
  content: z.string().min(1),
  excerpt: z.string().max(500).optional(),
  author: authorSchema,
  publishedAt: z.date().optional(),
  updatedAt: z.date(),
  createdAt: z.date(),
  status: z.enum(['draft', 'published', 'scheduled']),
  categories: z.array(categorySchema),
  tags: z.array(tagSchema),
  featuredImage: mediaAssetSchema.optional(),
  audioAsset: mediaAssetSchema.optional(),
  seoMetadata: seoMetadataSchema.optional(),
  customFields: z.record(z.any()).optional(),
});

export const pageSectionSchema = z.object({
  id: uuidSchema,
  pageId: uuidSchema,
  type: z.string().min(1).max(50),
  content: z.record(z.any()),
  orderIndex: z.number().int().nonnegative(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const pageSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1).max(200),
  slug: slugSchema,
  status: z.enum(['draft', 'published', 'archived']),
  template: z.string().min(1).max(50),
  contentBlocks: z.record(z.any()).optional(),
  contentHtml: z.string().optional(),
  excerpt: z.string().max(500).optional(),
  author: authorSchema.optional(),
  publishedAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  seoMetadata: seoMetadataSchema.optional(),
  sections: z.array(pageSectionSchema).optional(),
});

// Input schemas for creating/updating (without generated fields)
export const createAuthorSchema = z.object({
  name: z.string().min(1).max(100),
  email: emailSchema,
  bio: z.string().max(1000).optional(),
  avatarUrl: z.string().max(400).optional(),
  avatar: mediaAssetSchema.optional(),
  socialLinks: z.array(socialLinkSchema).optional(),
  slug: slugSchema.optional(),
}).strict();

export const updateAuthorSchema = createAuthorSchema.partial();

export const createCategorySchema = categorySchema.omit({ 
  id: true, 
  createdAt: true 
});

export const updateCategorySchema = createCategorySchema.partial();

export const createTagSchema = tagSchema.omit({ 
  id: true, 
  createdAt: true 
});

export const updateTagSchema = createTagSchema.partial();

export const createMediaAssetSchema = mediaAssetSchema.omit({ 
  id: true, 
  createdAt: true 
});

export const createBlogPostSchema = blogPostSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const updateBlogPostSchema = createBlogPostSchema.partial();

// Filter schemas
export const postFiltersSchema = z.object({
  status: z.enum(['draft', 'published', 'scheduled']).optional(),
  authorId: uuidSchema.optional(),
  categoryId: uuidSchema.optional(),
  tagId: uuidSchema.optional(),
  search: z.string().max(100).optional(),
  limit: z.number().positive().max(100).default(10),
  offset: z.number().nonnegative().default(0),
});

export const pageFiltersSchema = z.object({
  status: z.enum(['draft', 'published', 'archived']).optional(),
  authorId: uuidSchema.optional(),
  search: z.string().max(100).optional(),
  limit: z.number().positive().max(100).default(10),
  offset: z.number().nonnegative().default(0),
});
