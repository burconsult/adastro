import type { PostMigrationReport } from '../post-migration-optimizer.js';

export interface WordPressPost {
  title: string;
  link: string;
  pubDate: string;
  creator: string;
  guid: string;
  description: string;
  content: string;
  excerpt: string;
  postId: number;
  postDate: string;
  postDateGmt: string;
  commentStatus: string;
  pingStatus: string;
  postName: string;
  status: string;
  postParent: number;
  menuOrder: number;
  postType: string;
  postPassword: string;
  isSticky: number;
  taxonomies: WordPressPostTaxonomy[];
  postmeta: WordPressPostMeta[];
  attachment?: WordPressAttachment;
}

export interface WordPressPostTaxonomy {
  slug: string;
  domain: string;
}

export interface WordPressPostMeta {
  metaKey: string;
  metaValue: string;
}

export interface WordPressAttachment {
  attachmentUrl: string;
  postId: number;
  postTitle: string;
  postExcerpt: string;
  postContent: string;
  postParent: number;
}

export interface WordPressCategory {
  termId: number;
  categoryNicename: string;
  categoryParent: string;
  catName: string;
  categoryDescription: string;
}

export interface WordPressTag {
  termId: number;
  tagSlug: string;
  tagName: string;
  tagDescription: string;
}

export interface WordPressAuthor {
  authorId: number;
  authorLogin: string;
  authorEmail: string;
  authorDisplayName: string;
  authorFirstName: string;
  authorLastName: string;
}

export interface WordPressData {
  site: WordPressSiteInfo;
  authors: WordPressAuthor[];
  categories: WordPressCategory[];
  tags: WordPressTag[];
  posts: WordPressPost[];
  attachments: WordPressAttachment[];
}

export interface WordPressSiteInfo {
  title: string;
  link: string;
  description: string;
  language: string;
  baseSiteUrl: string;
  baseBlogUrl: string;
}

export interface MigrationResult {
  success: boolean;
  summary: MigrationSummary;
  errors: MigrationError[];
  warnings: MigrationWarning[];
  optimizationReport: MediaOptimizationReport;
  urlMappings: URLMapping[];
  postMigrationReport?: PostMigrationReport;
}

export interface MigrationSummary {
  postsProcessed: number;
  postsImported: number;
  authorsProcessed: number;
  authorsImported: number;
  categoriesProcessed: number;
  categoriesImported: number;
  tagsProcessed: number;
  tagsImported: number;
  mediaProcessed: number;
  mediaImported: number;
  totalProcessingTime: number;
}

export interface MigrationError {
  type: 'post' | 'media' | 'author' | 'category' | 'tag';
  id: string | number;
  message: string;
  details?: any;
}

export interface MigrationWarning {
  type: 'post' | 'media' | 'author' | 'category' | 'tag';
  id: string | number;
  message: string;
  suggestion?: string;
}

export interface MediaOptimizationReport {
  totalFilesProcessed: number;
  totalSizeBefore: number;
  totalSizeAfter: number;
  sizeSavings: number;
  sizeSavingsPercentage: number;
  formatConversions: FormatConversionStats;
  oversizedImagesOptimized: number;
  missingAltTextGenerated: number;
  recommendations: OptimizationRecommendation[];
}

export interface FormatConversionStats {
  webpConversions: number;
  avifConversions: number;
  jpegOptimizations: number;
  pngOptimizations: number;
}

export interface OptimizationRecommendation {
  type: 'size' | 'format' | 'accessibility' | 'performance';
  severity: 'low' | 'medium' | 'high';
  message: string;
  affectedFiles: number;
  potentialSavings?: number;
}

export interface URLMapping {
  originalUrl: string;
  newUrl: string;
  type: 'post' | 'media' | 'category' | 'tag';
  redirectStatus: 301 | 302;
}

export interface ImageAnalysisResult {
  filename: string;
  originalSize: number;
  dimensions: { width: number; height: number };
  format: string;
  quality: number;
  isOversized: boolean;
  recommendedOptimizations: OptimizationSuggestion[];
  potentialSavings: number;
}

export interface OptimizationSuggestion {
  type: 'size' | 'format' | 'quality';
  severity: 'low' | 'medium' | 'high';
  message: string;
  estimatedSavings: number;
}

export interface ResizingRecommendation {
  width: number;
  height: number;
  purpose: string;
}

export interface MediaMigrationSettings {
  optimizeImages?: boolean;
  altText?: string;
  caption?: string;
}

export type MigrationStage = 'parse' | 'authors' | 'categories' | 'tags' | 'media' | 'posts' | 'cleanup' | 'complete';
export type MigrationStatus = 'start' | 'progress' | 'complete';

export interface MigrationProgressUpdate {
  stage: MigrationStage;
  status: MigrationStatus;
  message: string;
  current?: number;
  total?: number;
  percent: number;
}

export interface MediaOptimizationResult {
  originalUrl: string;
  originalSize: number;
  optimizedVersions: OptimizedMediaVersion[];
  cdnUrls: CDNOptimizedUrls;
  totalSizeSavings: number;
  sizeSavingsPercentage: number;
  analysis: ImageAnalysisResult;
  recommendations: string[];
  primaryAssetId?: string;
  primaryUrl?: string;
}

export interface OptimizedMediaVersion {
  variant: string;
  filename: string;
  url: string;
  assetId?: string;
  fileSize: number;
  dimensions: { width: number; height: number };
  format: string;
  purpose: string;
}

export interface CDNOptimizedUrls {
  original: string;
  responsive: Record<string, string>;
  modernFormats: Record<string, string>;
}

export type MigrationArtifactType = 'author' | 'category' | 'tag' | 'media' | 'post';

export interface MigrationOptions {
  includeDrafts?: boolean;
  overwriteExisting?: boolean;
  generateAltText?: boolean;
  optimizeImages?: boolean;
  newBaseUrl?: string;
  preserveURLStructure?: boolean;
  trialImport?: boolean;
  articleBasePath?: string;
  articlePermalinkStyle?: 'segment' | 'wordpress';
}
