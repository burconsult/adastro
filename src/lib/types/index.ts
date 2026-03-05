import type { PostContentBlocks } from './block-editor.js';
import type { EditorJSData } from '../editorjs/types.js';

export * from './block-editor.js';

// Core data model interfaces
export interface Author {
  id: string;
  name: string;
  slug?: string;
  email?: string;
  bio?: string;
  avatar?: MediaAsset;
  socialLinks?: SocialLink[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  createdAt: Date;
  postCount?: number;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  postCount?: number;
}

export interface MediaAsset {
  id: string;
  filename: string;
  url: string;
  storagePath: string;
  altText?: string;
  caption?: string;
  mimeType: string;
  fileSize: number;
  dimensions?: {
    width: number;
    height: number;
  };
  originalFilename?: string;
  originalStoragePath?: string;
  originalMimeType?: string;
  originalFileSize?: number;
  originalDimensions?: {
    width: number;
    height: number;
  };
  createdAt: Date;
}

export interface SEOMetadata {
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  canonicalUrl?: string;
  noIndex?: boolean;
  noFollow?: boolean;
  openGraph?: OpenGraphData;
  twitterCard?: TwitterCardData;
}

export interface OpenGraphData {
  title?: string;
  description?: string;
  image?: string;
  type?: 'article' | 'website';
  url?: string;
}

export interface TwitterCardData {
  card?: 'summary' | 'summary_large_image';
  title?: string;
  description?: string;
  image?: string;
}

export interface SocialLink {
  platform: string;
  url: string;
}

export interface UserProfile {
  id: string;
  authUserId: string;
  fullName?: string;
  bio?: string;
  avatarUrl?: string;
  avatarSource?: 'custom' | 'gravatar';
  data?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PageSection {
  id: string;
  pageId: string;
  type: string;
  content: Record<string, any>;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Page {
  id: string;
  title: string;
  slug: string;
  locale?: string;
  status: PageStatus;
  template: string;
  contentBlocks?: EditorJSData;
  contentHtml?: string;
  excerpt?: string;
  author?: Author | null;
  seoMetadata?: SEOMetadata;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  sections?: PageSection[];
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  locale?: string;
  content: string;
  blocks?: PostContentBlocks | EditorJSData;
  excerpt?: string;
  author: Author;
  publishedAt?: Date;
  updatedAt: Date;
  createdAt: Date;
  status: 'draft' | 'published' | 'scheduled';
  categories: Category[];
  tags: Tag[];
  featuredImage?: MediaAsset;
  featuredImageId?: string;
  audioAsset?: MediaAsset;
  audioAssetId?: string;
  seoMetadata?: SEOMetadata;
  customFields?: Record<string, any>;
}

// Post status enum
export type PostStatus = 'draft' | 'published' | 'scheduled';

export type PageStatus = 'draft' | 'published' | 'archived';

// Filter interfaces
export interface PostFilters {
  status?: PostStatus;
  authorId?: string;
  locale?: string;
  categoryId?: string;
  tagId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface PageFilters {
  status?: PageStatus;
  authorId?: string;
  locale?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// Media optimization result
export interface MediaOptimizationResult {
  original: MediaAsset;
  public?: MediaAsset;
  standard?: MediaAsset;
  optimized: MediaAsset[];
  sizeSavings: number;
  formatConversions: string[];
}
