import { mediaManager } from './media-manager.js';
import { supabaseAdmin } from '../supabase.js';
import { generateSlug } from '../utils/data-transform.js';
import {
  buildArticlePostPath,
  normalizeArticleBasePath,
  normalizeArticlePermalinkStyle
} from '../routing/articles.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase.js';
import {
  AdvancedMediaOptimizer,
  MediaFetchError,
  fetchWithTimeout,
  ImageAnalysisService
} from './wordpress-migration/media-optimizer.js';
import { WXRParser } from './wordpress-migration/parser.js';
import type {
  FormatConversionStats,
  MediaOptimizationReport,
  MigrationError,
  MigrationOptions,
  MigrationProgressUpdate,
  MigrationResult,
  MigrationStage,
  MigrationStatus,
  MigrationSummary,
  MigrationWarning,
  OptimizationRecommendation,
  URLMapping,
  WordPressAttachment,
  WordPressAuthor,
  WordPressCategory,
  WordPressData,
  WordPressPost,
  WordPressPostMeta,
  WordPressPostTaxonomy,
  WordPressTag,
  MigrationArtifactType
} from './wordpress-migration/types.js';

type StageProgressHandlers = {
  start: (total: number, message: string) => void;
  tick: (current: number, total: number, message: string) => void;
  complete: (message?: string) => void;
};

type MediaImportResult = {
  imported: number;
  optimizationReport: MediaOptimizationReport;
  attachmentIdMap: Map<number, string>;
  urlMap: Map<string, string>;
};

/*
 * Main WordPress Migration Service
 */
export interface WordPressMigrationDependencies {
  parser?: WXRParser;
  mediaOptimizer?: AdvancedMediaOptimizer;
  dbClient?: SupabaseClient<Database>;
}

export interface MigrationHooks {
  onTotals?: (totalUnits: number) => void;
  onArtifact?: (artifact: { type: MigrationArtifactType; id: string }) => Promise<void> | void;
}

export class WordPressMigrationService {
  private parser: WXRParser;
  private mediaOptimizer: AdvancedMediaOptimizer;
  private dbClient: SupabaseClient<Database>;
  private errors: MigrationError[] = [];
  private warnings: MigrationWarning[] = [];
  private authorEmailMap = new Map<string, string>();
  private authorLoginMap = new Map<string, string>();
  private categorySlugMap = new Map<string, string>();
  private tagSlugMap = new Map<string, string>();

  constructor(dependencies: WordPressMigrationDependencies = {}) {
    this.parser = dependencies.parser ?? new WXRParser();
    this.mediaOptimizer = dependencies.mediaOptimizer ?? new AdvancedMediaOptimizer();
    this.dbClient = dependencies.dbClient ?? supabaseAdmin;
  }

  /**
   * Import WordPress site from WXR file
   */
  async importFromWXR(
    file: File,
    options: MigrationOptions = {},
    progress?: (update: MigrationProgressUpdate) => void,
    hooks?: MigrationHooks
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    this.errors = [];
    this.warnings = [];
    this.authorEmailMap.clear();
    this.authorLoginMap.clear();
    this.categorySlugMap.clear();
    this.tagSlugMap.clear();

    try {
      progress?.({ stage: 'parse', status: 'start', message: 'Parsing WXR file…', percent: 0 });

      const xmlContent = await file.text();
      let wpData = await this.parser.parseWXR(xmlContent);

      if (options.trialImport) {
        const publishedPosts = wpData.posts.filter(post => post.status === 'publish');
        const limitedPosts = publishedPosts.slice(0, 10);
        const limitedPostIds = new Set(limitedPosts.map(post => post.postId));
        const limitedAttachments = wpData.attachments.filter(att => limitedPostIds.has(att.postParent));

        if (limitedPosts.length < wpData.posts.length) {
          this.warnings.push({
            type: 'post',
            id: 'trial-mode',
            message: 'Trial import enabled: only the first 10 published posts were imported.',
            suggestion: 'Disable trial import to migrate the full archive.'
          });
        }

        wpData = {
          ...wpData,
          posts: limitedPosts,
          attachments: limitedAttachments
        };
      }

      const totalUnits =
        wpData.authors.length +
        wpData.categories.length +
        wpData.tags.length +
        wpData.attachments.length +
        wpData.posts.length;

      hooks?.onTotals?.(totalUnits);

      let completedUnits = 0;

      const emit = (
        stage: MigrationStage,
        status: MigrationStatus,
        message: string,
        current?: number,
        total?: number,
        increment = false
      ) => {
        if (!progress) return;
        if (increment) {
          completedUnits = Math.min(totalUnits, completedUnits + 1);
        }
        const percent = totalUnits === 0
          ? stage === 'complete' ? 100 : 0
          : Math.min(100, Math.round((completedUnits / totalUnits) * 100));
        progress({ stage, status, message, current, total, percent });
      };

      emit(
        'parse',
        'complete',
        `Parsed ${wpData.posts.length} posts, ${wpData.attachments.length} media assets, ${wpData.categories.length} categories, and ${wpData.tags.length} tags.`
      );

      const stageTotals = {
        authors: wpData.authors.length,
        categories: wpData.categories.length,
        tags: wpData.tags.length,
        media: wpData.attachments.length,
        posts: wpData.posts.length
      } as const;

      const stageLabels: Record<keyof typeof stageTotals, string> = {
        authors: 'Author import',
        categories: 'Category import',
        tags: 'Tag import',
        media: 'Media import',
        posts: 'Post import'
      };

      const stageHandlers = (stage: keyof typeof stageTotals): StageProgressHandlers => {
        const total = stageTotals[stage];
        const label = stageLabels[stage];
        return {
          start: (_total, message) => emit(stage, 'start', message || `${label} started`, 0, total),
          tick: (current, _total, message) => emit(stage, 'progress', message, current, total, true),
          complete: (message) => emit(stage, 'complete', message || `${label} complete`, total, total)
        };
      };

      // Import data in order: authors -> categories -> tags -> media -> posts
      const authorsResult = await this.importAuthors(wpData.authors, stageHandlers('authors'), hooks);
      const categoriesResult = await this.importCategories(wpData.categories, stageHandlers('categories'), hooks);
      const tagsResult = await this.importTags(wpData.tags, stageHandlers('tags'), hooks);
      const mediaResult = await this.importMedia(wpData.attachments, options, stageHandlers('media'), hooks);
      const postsResult = await this.importPosts(
        wpData.posts,
        options,
        mediaResult.attachmentIdMap,
        mediaResult.urlMap,
        stageHandlers('posts'),
        hooks
      );

      // Generate URL mappings for redirects
      const urlMappings = await this.generateURLMappings(wpData, options);

      const processingTime = Date.now() - startTime;

      const summary: MigrationSummary = {
        postsProcessed: wpData.posts.length,
        postsImported: postsResult.imported,
        authorsProcessed: wpData.authors.length,
        authorsImported: authorsResult.imported,
        categoriesProcessed: wpData.categories.length,
        categoriesImported: categoriesResult.imported,
        tagsProcessed: wpData.tags.length,
        tagsImported: tagsResult.imported,
        mediaProcessed: wpData.attachments.length,
        mediaImported: mediaResult.imported,
        totalProcessingTime: processingTime
      };

      const result: MigrationResult = {
        success: this.errors.length === 0,
        summary,
        errors: this.errors,
        warnings: this.warnings,
        optimizationReport: mediaResult.optimizationReport,
        urlMappings
      };

      emit(
        'complete',
        'complete',
        result.success ? 'Migration finished successfully.' : 'Migration completed with issues.',
        totalUnits,
        totalUnits
      );

      return result;

    } catch (error) {
      this.errors.push({
        type: 'post',
        id: 'migration',
        message: `Migration failed: ${error.message}`
      });

      const failureResult: MigrationResult = {
        success: false,
        summary: {
          postsProcessed: 0,
          postsImported: 0,
          authorsProcessed: 0,
          authorsImported: 0,
          categoriesProcessed: 0,
          categoriesImported: 0,
          tagsProcessed: 0,
          tagsImported: 0,
          mediaProcessed: 0,
          mediaImported: 0,
          totalProcessingTime: Date.now() - startTime
        },
        errors: this.errors,
        warnings: this.warnings,
        optimizationReport: {
          totalFilesProcessed: 0,
          totalSizeBefore: 0,
          totalSizeAfter: 0,
          sizeSavings: 0,
          sizeSavingsPercentage: 0,
          formatConversions: {
            webpConversions: 0,
            avifConversions: 0,
            jpegOptimizations: 0,
            pngOptimizations: 0
          },
          oversizedImagesOptimized: 0,
          missingAltTextGenerated: 0,
          recommendations: []
        },
        urlMappings: []
      };

      progress?.({
        stage: 'complete',
        status: 'complete',
        message: error instanceof Error ? error.message : 'Migration failed',
        percent: 100
      });

      return failureResult;
    }
  }

  /**
   * Import authors
   */
  private async importAuthors(
    wpAuthors: WordPressAuthor[],
    progressHandlers?: StageProgressHandlers,
    hooks?: MigrationHooks
  ): Promise<{ imported: number }> {
    let imported = 0;

    progressHandlers?.start(
      wpAuthors.length,
      `Importing ${wpAuthors.length} author${wpAuthors.length === 1 ? '' : 's'}`
    );

    for (let index = 0; index < wpAuthors.length; index++) {
      const wpAuthor = wpAuthors[index];
      const email = (wpAuthor.authorEmail || '').trim() || `${wpAuthor.authorLogin || 'author'}-${wpAuthor.authorId || Date.now()}@example.com`;
      const normalizedEmail = email.toLowerCase();
      const login = (wpAuthor.authorLogin || '').trim();
      const displayName = (wpAuthor.authorDisplayName || `${wpAuthor.authorFirstName} ${wpAuthor.authorLastName}`.trim() || login || 'Imported Author').trim();
      const slugSource = login || normalizedEmail.split('@')[0] || displayName;
      const authorSlugBase = generateSlug(slugSource || 'author') || 'author';

      let statusMessage = `Imported author ${displayName}`;

      try {
        let authorId: string | null = null;

        const { data: existingAuthor, error: existingError } = await this.dbClient
          .from('authors')
          .select('id')
          .eq('email', normalizedEmail)
          .maybeSingle();

        if (existingError) {
          throw existingError;
        }

        if (existingAuthor) {
          authorId = existingAuthor.id;
        } else {
          const authorSlug = await this.ensureUniqueAuthorSlug(authorSlugBase);
          const { data: newAuthor, error: insertError } = await this.dbClient
            .from('authors')
            .insert({
              name: displayName,
              email: normalizedEmail,
              slug: authorSlug,
              bio: null
            })
            .select('id')
            .single();

          if (insertError) {
            throw insertError;
          }

          authorId = newAuthor.id;
          imported++;
          await hooks?.onArtifact?.({ type: 'author', id: authorId });
        }

        if (authorId) {
          this.authorEmailMap.set(normalizedEmail, authorId);
          if (login) {
            this.authorLoginMap.set(login, authorId);
            this.authorLoginMap.set(login.toLowerCase(), authorId);
          }
          if (displayName) {
            this.authorLoginMap.set(displayName.toLowerCase(), authorId);
          }
        }
      } catch (error) {
        this.errors.push({
          type: 'author',
          id: wpAuthor.authorId,
          message: `Author import failed: ${error.message}`
        });
        statusMessage = `Failed to import author ${displayName}`;
      }

      progressHandlers?.tick(index + 1, wpAuthors.length, statusMessage);
    }

    progressHandlers?.complete('Author import complete');

    return { imported };
  }

  /**
   * Import categories
   */
  private async importCategories(
    wpCategories: WordPressCategory[],
    progressHandlers?: StageProgressHandlers,
    hooks?: MigrationHooks
  ): Promise<{ imported: number }> {
    let imported = 0;

    // Sort categories to handle parent-child relationships
    const sortedCategories = this.sortCategoriesByHierarchy(wpCategories);

    progressHandlers?.start(
      sortedCategories.length,
      `Importing ${sortedCategories.length} categor${sortedCategories.length === 1 ? 'y' : 'ies'}`
    );

    for (let index = 0; index < sortedCategories.length; index++) {
      const wpCategory = sortedCategories[index];
      const slug = (wpCategory.categoryNicename || '').trim();
      let statusMessage = slug ? `Processed category ${slug}` : 'Skipped category without a slug';

      if (!slug) {
        progressHandlers?.tick(index + 1, sortedCategories.length, statusMessage);
        continue;
      }

      try {
        let categoryId: string | null = null;

        const { data: existingCategory, error: existingError } = await this.dbClient
          .from('categories')
          .select('id')
          .eq('slug', slug)
          .maybeSingle();

        if (existingError) {
          throw existingError;
        }

        if (existingCategory) {
          categoryId = existingCategory.id;
        } else {
          let parentId: string | null = null;
          if (wpCategory.categoryParent) {
            parentId = this.categorySlugMap.get(wpCategory.categoryParent) || null;

            if (!parentId) {
              const { data: parentCategory, error: parentError } = await this.dbClient
                .from('categories')
                .select('id')
                .eq('slug', wpCategory.categoryParent)
                .maybeSingle();

              if (parentError) {
                throw parentError;
              }

              parentId = parentCategory?.id || null;
            }
          }

          const { data: newCategory, error: insertError } = await this.dbClient
            .from('categories')
            .insert({
              name: wpCategory.catName || slug,
              slug,
              description: wpCategory.categoryDescription || null,
              parent_id: parentId
            })
            .select('id')
            .single();

          if (insertError) {
            throw insertError;
          }

          categoryId = newCategory.id;
          imported++;
          await hooks?.onArtifact?.({ type: 'category', id: categoryId });
        }

        if (categoryId) {
          this.categorySlugMap.set(slug, categoryId);
          statusMessage = existingCategory
            ? `Category ${slug} already exists`
            : `Imported category ${slug}`;
        }
      } catch (error) {
        this.errors.push({
          type: 'category',
          id: wpCategory.termId,
          message: `Category import failed: ${error.message}`
        });
        statusMessage = `Failed to import category ${slug}`;
      }

      progressHandlers?.tick(index + 1, sortedCategories.length, statusMessage);
    }

    progressHandlers?.complete('Category import complete');

    return { imported };
  }

  /**
   * Import tags
   */
  private async importTags(
    wpTags: WordPressTag[],
    progressHandlers?: StageProgressHandlers,
    hooks?: MigrationHooks
  ): Promise<{ imported: number }> {
    let imported = 0;

    progressHandlers?.start(
      wpTags.length,
      `Importing ${wpTags.length} tag${wpTags.length === 1 ? '' : 's'}`
    );

    for (let index = 0; index < wpTags.length; index++) {
      const wpTag = wpTags[index];
      const slug = (wpTag.tagSlug || '').trim();
      let statusMessage = slug ? `Processed tag ${slug}` : 'Skipped tag without a slug';

      if (!slug) {
        progressHandlers?.tick(index + 1, wpTags.length, statusMessage);
        continue;
      }

      try {
        let tagId: string | null = null;

        const { data: existingTag, error: existingError } = await this.dbClient
          .from('tags')
          .select('id')
          .eq('slug', slug)
          .maybeSingle();

        if (existingError) {
          throw existingError;
        }

        if (existingTag) {
          tagId = existingTag.id;
        } else {
          const { data: newTag, error: insertError } = await this.dbClient
            .from('tags')
            .insert({
              name: wpTag.tagName || slug,
              slug
            })
            .select('id')
            .single();

          if (insertError) {
            throw insertError;
          }

          tagId = newTag.id;
          imported++;
          await hooks?.onArtifact?.({ type: 'tag', id: tagId });
        }

        if (tagId) {
          this.tagSlugMap.set(slug, tagId);
          statusMessage = existingTag
            ? `Tag ${slug} already exists`
            : `Imported tag ${slug}`;
        }
      } catch (error) {
        this.errors.push({
          type: 'tag',
          id: wpTag.termId,
          message: `Tag import failed: ${error.message}`
        });
        statusMessage = `Failed to import tag ${slug}`;
      }

      progressHandlers?.tick(index + 1, wpTags.length, statusMessage);
    }

    progressHandlers?.complete('Tag import complete');

    return { imported };
  }

  /**
   * Import and optimize media
   */
  private async importMedia(
    wpAttachments: WordPressAttachment[],
    options: MigrationOptions,
    progressHandlers?: StageProgressHandlers,
    hooks?: MigrationHooks
  ): Promise<MediaImportResult> {
    let imported = 0;
    let totalSizeBefore = 0;
    let totalSizeAfter = 0;
    let oversizedImagesOptimized = 0;
    let missingAltTextGenerated = 0;
    const formatConversions: FormatConversionStats = {
      webpConversions: 0,
      avifConversions: 0,
      jpegOptimizations: 0,
      pngOptimizations: 0
    };
    const recommendations: OptimizationRecommendation[] = [];
    const attachmentIdMap = new Map<number, string>();
    const urlMap = new Map<string, string>();

    const shouldOptimizeMedia = options.optimizeImages !== false;
    const shouldGenerateAlt = options.generateAltText !== false;

    progressHandlers?.start(
      wpAttachments.length,
      `Processing ${wpAttachments.length} media item${wpAttachments.length === 1 ? '' : 's'}`
    );

    for (let index = 0; index < wpAttachments.length; index++) {
      const wpAttachment = wpAttachments[index];
      const title = wpAttachment.postTitle || wpAttachment.attachmentUrl || `attachment-${wpAttachment.postId}`;
      let statusMessage = `Processed media ${title}`;

      try {
        if (!wpAttachment.attachmentUrl) {
          this.warnings.push({
            type: 'media',
            id: wpAttachment.postId,
            message: 'Attachment has no URL, skipping'
          });
          statusMessage = `Skipped media ${title} (no URL)`;
          progressHandlers?.tick(index + 1, wpAttachments.length, statusMessage);
          continue;
        }

        // Determine usage context from filename or title
        const usageContext = this.determineMediaUsageContext(wpAttachment);
        const altText = wpAttachment.postExcerpt || (shouldGenerateAlt ? wpAttachment.postTitle : undefined);
        const generatedAlt = !wpAttachment.postExcerpt && shouldGenerateAlt && Boolean(altText);
        if (generatedAlt) {
          missingAltTextGenerated++;
        }

        const inferredMimeType = this.inferMimeTypeFromUrl(wpAttachment.attachmentUrl);
        const shouldOptimizeAsset = shouldOptimizeMedia && Boolean(inferredMimeType?.startsWith('image/'));

        if (shouldOptimizeAsset) {
          const filename = this.resolveAttachmentFilename(wpAttachment, inferredMimeType);
          const optimizationResult = await this.mediaOptimizer.optimizeMediaDuringMigration(
            wpAttachment.attachmentUrl,
            filename,
            usageContext,
            {
              optimizeImages: shouldOptimizeMedia,
              altText: altText || undefined,
              caption: wpAttachment.postContent || undefined
            }
          );

          totalSizeBefore += optimizationResult.originalSize;
          totalSizeAfter += optimizationResult.optimizedVersions.reduce((sum, v) => sum + v.fileSize, 0);

          // Count format conversions
          for (const version of optimizationResult.optimizedVersions) {
            if (version.format === 'webp') formatConversions.webpConversions++;
            if (version.format === 'avif') formatConversions.avifConversions++;
            if (version.format === 'jpeg') formatConversions.jpegOptimizations++;
          }

          if (optimizationResult.analysis.isOversized) {
            oversizedImagesOptimized++;
          }

          if (optimizationResult.primaryAssetId) {
            attachmentIdMap.set(wpAttachment.postId, optimizationResult.primaryAssetId);
          }
          if (optimizationResult.primaryUrl) {
            urlMap.set(wpAttachment.attachmentUrl, optimizationResult.primaryUrl);
          }

          const assetIds = new Set<string>();
          if (optimizationResult.primaryAssetId) {
            assetIds.add(optimizationResult.primaryAssetId);
          }
          for (const version of optimizationResult.optimizedVersions) {
            if (version.assetId) {
              assetIds.add(version.assetId);
            }
          }
          for (const assetId of assetIds) {
            await hooks?.onArtifact?.({ type: 'media', id: assetId });
          }

          imported++;
          statusMessage = `Optimized media ${title}`;
        } else {
          const { buffer, mimeType } = await this.downloadAttachment(
            wpAttachment.attachmentUrl,
            inferredMimeType
          );
          const filename = this.resolveAttachmentFilename(wpAttachment, mimeType);
          const uploadResult = await mediaManager.uploadMedia({
            file: new File([buffer], filename, { type: mimeType }),
            altText: altText || undefined,
            caption: wpAttachment.postContent || undefined
          });
          const primaryAsset = uploadResult.public ?? uploadResult.original;

          totalSizeBefore += buffer.length;
          totalSizeAfter += buffer.length;

          attachmentIdMap.set(wpAttachment.postId, primaryAsset.id);
          urlMap.set(wpAttachment.attachmentUrl, primaryAsset.url);
          await hooks?.onArtifact?.({ type: 'media', id: primaryAsset.id });

          imported++;
          statusMessage = shouldOptimizeMedia
            ? `Uploaded media ${title} (optimization skipped)`
            : `Imported media ${title}`;
        }

      } catch (error) {
        if (error instanceof MediaFetchError) {
          const suggestion = error.code === 'timeout'
            ? 'Check the source media host or try again; the request timed out.'
            : 'The media file may no longer exist on the source site.';
          this.warnings.push({
            type: 'media',
            id: wpAttachment.postId,
            message: `Skipped media: ${error.message}`,
            suggestion
          });
          statusMessage = `Skipped media ${title}`;
        } else {
          this.errors.push({
            type: 'media',
            id: wpAttachment.postId,
            message: `Media import failed: ${error.message}`
          });
          statusMessage = `Failed to import media ${title}`;
        }
      }

      progressHandlers?.tick(index + 1, wpAttachments.length, statusMessage);
    }

    const sizeSavings = totalSizeBefore - totalSizeAfter;
    const sizeSavingsPercentage = totalSizeBefore > 0 ? (sizeSavings / totalSizeBefore) * 100 : 0;

    // Generate optimization recommendations
    if (oversizedImagesOptimized > 0) {
      recommendations.push({
        type: 'size',
        severity: 'medium',
        message: `${oversizedImagesOptimized} oversized images were automatically optimized`,
        affectedFiles: oversizedImagesOptimized,
        potentialSavings: sizeSavings * 0.6
      });
    }

    if (formatConversions.webpConversions + formatConversions.avifConversions > 0) {
      recommendations.push({
        type: 'format',
        severity: 'low',
        message: `${formatConversions.webpConversions + formatConversions.avifConversions} images converted to modern formats`,
        affectedFiles: formatConversions.webpConversions + formatConversions.avifConversions,
        potentialSavings: sizeSavings * 0.4
      });
    }

    const optimizationReport: MediaOptimizationReport = {
      totalFilesProcessed: wpAttachments.length,
      totalSizeBefore,
      totalSizeAfter,
      sizeSavings,
      sizeSavingsPercentage,
      formatConversions,
      oversizedImagesOptimized,
      missingAltTextGenerated,
      recommendations
    };

    progressHandlers?.complete('Media import complete');

    return { imported, optimizationReport, attachmentIdMap, urlMap };
  }

  /**
   * Import posts
   */
  private async importPosts(
    wpPosts: WordPressPost[],
    options: MigrationOptions,
    attachmentIdMap: Map<number, string>,
    mediaUrlMap: Map<string, string>,
    progressHandlers?: StageProgressHandlers,
    hooks?: MigrationHooks
  ): Promise<{ imported: number }> {
    let imported = 0;

    progressHandlers?.start(
      wpPosts.length,
      `Importing ${wpPosts.length} post${wpPosts.length === 1 ? '' : 's'}`
    );

    for (let index = 0; index < wpPosts.length; index++) {
      const wpPost = wpPosts[index];
      let statusMessage = `Imported post ${wpPost.title || wpPost.postName || wpPost.postId}`;

      try {
        // Skip drafts if not requested
        if (wpPost.status === 'draft' && !options.includeDrafts) {
          statusMessage = `Skipped draft post ${wpPost.title || wpPost.postName || wpPost.postId}`;
          progressHandlers?.tick(index + 1, wpPosts.length, statusMessage);
          continue;
        }

        const authorId = await this.resolveAuthorId(wpPost);
        if (!authorId) {
          this.errors.push({
            type: 'post',
            id: wpPost.postId,
            message: `Author not found: ${wpPost.creator}`
          });
          statusMessage = `Failed to resolve author for post ${wpPost.title || wpPost.postName || wpPost.postId}`;
          progressHandlers?.tick(index + 1, wpPosts.length, statusMessage);
          continue;
        }

        const slug = this.ensureSlug(wpPost.postName, wpPost.title, wpPost.postId);

        const { data: existingPost, error: existingError } = await this.dbClient
          .from('posts')
          .select('id')
          .eq('slug', slug)
          .maybeSingle();

        if (existingError) {
          throw existingError;
        }

        if (existingPost && !options.overwriteExisting) {
          this.warnings.push({
            type: 'post',
            id: wpPost.postId,
            message: 'Post already exists, skipping',
            suggestion: 'Enable overwriteExisting option to update existing posts'
          });
          continue;
        }

        const featuredImageId = this.resolveFeaturedImageId(wpPost.postmeta, attachmentIdMap);
        const rewritten = this.rewriteMediaUrls(wpPost.content, mediaUrlMap);
        const mdxContent = this.convertContentToMDX(rewritten.content);
        const seoMetadata = this.extractSEOMetadata(wpPost.postmeta);

        const postData = {
          title: wpPost.title,
          slug,
          content: mdxContent,
          excerpt: wpPost.excerpt || null,
          author_id: authorId,
          featured_image_id: featuredImageId || null,
          status: this.mapWordPressStatus(wpPost.status),
          published_at: wpPost.status === 'publish' && wpPost.postDate ? new Date(wpPost.postDate) : null,
          seo_metadata: seoMetadata,
          custom_fields: this.extractCustomFields(wpPost.postmeta)
        };

        let postId: string;

        if (existingPost && options.overwriteExisting) {
          const { data: updatedPost, error: updateError } = await this.dbClient
            .from('posts')
            .update(postData)
            .eq('id', existingPost.id)
            .select('id')
            .single();

          if (updateError) throw updateError;
          postId = updatedPost.id;
        } else {
          const { data: newPost, error: insertError } = await this.dbClient
            .from('posts')
            .insert(postData)
            .select('id')
            .single();

          if (insertError) throw insertError;
          postId = newPost.id;
          await hooks?.onArtifact?.({ type: 'post', id: postId });
        }

        await this.associatePostTaxonomies(postId, wpPost.taxonomies, Boolean(options.overwriteExisting));

        imported++;
        statusMessage = `Imported post ${wpPost.title || slug}`;
      } catch (error) {
        this.errors.push({
          type: 'post',
          id: wpPost.postId,
          message: `Post import failed: ${error.message}`
        });
        statusMessage = `Failed to import post ${wpPost.title || wpPost.postName || wpPost.postId}`;
      }

      progressHandlers?.tick(index + 1, wpPosts.length, statusMessage);
    }

    progressHandlers?.complete('Post import complete');

    return { imported };
  }

  /**
   * Generate URL mappings for redirects
   */
  private async generateURLMappings(wpData: WordPressData, options: MigrationOptions): Promise<URLMapping[]> {
    const mappings: URLMapping[] = [];
    const baseUrl = options.newBaseUrl ? options.newBaseUrl.replace(/\/$/, '') : '';
    const preserveStructure = options.preserveURLStructure === true;
    const articleRouting = {
      basePath: normalizeArticleBasePath(options.articleBasePath),
      permalinkStyle: normalizeArticlePermalinkStyle(options.articlePermalinkStyle)
    };

    const buildNewUrl = (originalUrl: string | undefined, fallbackPath: string) => {
      if (preserveStructure && originalUrl) {
        try {
          const parsed = new URL(originalUrl);
          const preservedPath = `${parsed.pathname}${parsed.search || ''}`;
          return baseUrl ? `${baseUrl}${preservedPath}` : preservedPath;
        } catch {
          // fall through to fallback path
        }
      }

      const normalizedPath = fallbackPath.startsWith('/') ? fallbackPath : `/${fallbackPath}`;
      return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
    };

    // Map post URLs
    for (const wpPost of wpData.posts) {
      if (wpPost.status === 'publish') {
        const slug = this.ensureSlug(wpPost.postName, wpPost.title, wpPost.postId);
        const postDate = wpPost.postDate || wpPost.postDateGmt || wpPost.pubDate || null;
        mappings.push({
          originalUrl: wpPost.link,
          newUrl: buildNewUrl(wpPost.link, buildArticlePostPath(slug, postDate, articleRouting)),
          type: 'post',
          redirectStatus: 301
        });
      }
    }

    // Map category URLs
    for (const wpCategory of wpData.categories) {
      const originalUrl = `${wpData.site.baseBlogUrl}/category/${wpCategory.categoryNicename}`;
      mappings.push({
        originalUrl,
        newUrl: buildNewUrl(originalUrl, `/category/${wpCategory.categoryNicename}`),
        type: 'category',
        redirectStatus: 301
      });
    }

    // Map tag URLs
    for (const wpTag of wpData.tags) {
      const originalUrl = `${wpData.site.baseBlogUrl}/tag/${wpTag.tagSlug}`;
      mappings.push({
        originalUrl,
        newUrl: buildNewUrl(originalUrl, `/tag/${wpTag.tagSlug}`),
        type: 'tag',
        redirectStatus: 301
      });
    }

    return mappings;
  }

  /**
   * Utility methods
   */
  private sortCategoriesByHierarchy(categories: WordPressCategory[]): WordPressCategory[] {
    const sorted: WordPressCategory[] = [];
    const remaining = [...categories];

    // First add categories without parents
    const rootCategories = remaining.filter(cat => !cat.categoryParent);
    sorted.push(...rootCategories);
    remaining.splice(0, remaining.length, ...remaining.filter(cat => cat.categoryParent));

    // Then add child categories
    while (remaining.length > 0) {
      const added = [];
      for (const cat of remaining) {
        if (sorted.some(sortedCat => sortedCat.categoryNicename === cat.categoryParent)) {
          sorted.push(cat);
          added.push(cat);
        }
      }
      
      if (added.length === 0) break; // Prevent infinite loop
      
      for (const cat of added) {
        const index = remaining.indexOf(cat);
        if (index > -1) remaining.splice(index, 1);
      }
    }

    // Add any remaining categories
    sorted.push(...remaining);

    return sorted;
  }

  private determineMediaUsageContext(attachment: WordPressAttachment): 'featured' | 'inline' | 'thumbnail' | 'gallery' {
    const title = attachment.postTitle.toLowerCase();
    
    if (title.includes('featured') || title.includes('hero')) return 'featured';
    if (title.includes('thumb') || title.includes('avatar')) return 'thumbnail';
    if (title.includes('gallery')) return 'gallery';
    
    return 'inline';
  }

  private resolveAttachmentFilename(attachment: WordPressAttachment, mimeType?: string | null): string {
    const urlFilename = this.extractFilenameFromUrl(attachment.attachmentUrl);
    if (urlFilename) return urlFilename;

    const base = this.slugify(attachment.postTitle || `attachment-${attachment.postId}`) || `attachment-${attachment.postId}`;
    const extension = this.extensionFromMimeType(mimeType) || 'jpg';
    return `${base}.${extension}`;
  }

  private extractFilenameFromUrl(url: string): string | null {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      const filename = parsed.pathname.split('/').pop();
      return filename || null;
    } catch {
      return null;
    }
  }

  private normalizeMimeType(value: string | null): string | null {
    if (!value) return null;
    const normalized = value.split(';')[0]?.trim().toLowerCase() || null;
    if (!normalized) return null;
    if (normalized === 'image/jpg') return 'image/jpeg';
    if (normalized === 'audio/mp3') return 'audio/mpeg';
    return normalized;
  }

  private inferMimeTypeFromUrl(url: string): string | null {
    const filename = this.extractFilenameFromUrl(url);
    if (!filename) return null;
    const extension = filename.split('.').pop()?.toLowerCase();
    if (!extension) return null;

    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'avif':
        return 'image/avif';
      case 'svg':
        return 'image/svg+xml';
      case 'mp4':
        return 'video/mp4';
      case 'webm':
        return 'video/webm';
      case 'mp3':
        return 'audio/mpeg';
      case 'wav':
        return 'audio/wav';
      case 'ogg':
        return 'audio/ogg';
      case 'pdf':
        return 'application/pdf';
      default:
        return null;
    }
  }

  private extensionFromMimeType(mimeType?: string | null): string | null {
    if (!mimeType) return null;
    switch (mimeType) {
      case 'image/png':
        return 'png';
      case 'image/gif':
        return 'gif';
      case 'image/webp':
        return 'webp';
      case 'image/avif':
        return 'avif';
      case 'image/svg+xml':
        return 'svg';
      case 'video/mp4':
        return 'mp4';
      case 'video/webm':
        return 'webm';
      case 'audio/mpeg':
      case 'audio/mp3':
        return 'mp3';
      case 'audio/wav':
        return 'wav';
      case 'audio/ogg':
        return 'ogg';
      case 'application/pdf':
        return 'pdf';
      default:
        return 'jpg';
    }
  }

  private isSupportedMediaType(mimeType: string): boolean {
    const validTypes = new Set([
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/avif',
      'image/svg+xml',
      'video/mp4',
      'video/webm',
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'application/pdf'
    ]);

    return validTypes.has(mimeType);
  }

  private async downloadAttachment(
    url: string,
    fallbackMimeType?: string | null
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      const code = response.status === 404 || response.status === 410 ? 'not_found' : 'http_error';
      throw new MediaFetchError(`Failed to download media: ${response.status} ${response.statusText}`, response.status, code);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const headerType = this.normalizeMimeType(response.headers.get('content-type'));
    const resolvedMimeType = this.normalizeMimeType(
      headerType || fallbackMimeType || this.inferMimeTypeFromUrl(url)
    );

    if (!resolvedMimeType || !this.isSupportedMediaType(resolvedMimeType)) {
      throw new Error(`Unsupported media type for ${url}`);
    }

    return { buffer, mimeType: resolvedMimeType };
  }

  private rewriteMediaUrls(content: string, mediaUrlMap: Map<string, string>): { content: string; updated: number } {
    if (!mediaUrlMap.size || !content) {
      return { content, updated: 0 };
    }

    let updatedContent = content;
    let updated = 0;

    for (const [originalUrl, newUrl] of mediaUrlMap.entries()) {
      if (!originalUrl || !newUrl || originalUrl === newUrl) continue;
      if (updatedContent.includes(originalUrl)) {
        updatedContent = updatedContent.split(originalUrl).join(newUrl);
        updated++;
      }
    }

    return { content: updatedContent, updated };
  }

  private resolveFeaturedImageId(
    postmeta: WordPressPostMeta[],
    attachmentIdMap: Map<number, string>
  ): string | null {
    const thumbnailMeta = postmeta.find((meta) => meta.metaKey === '_thumbnail_id' || meta.metaKey === 'thumbnail_id');
    if (!thumbnailMeta?.metaValue) return null;
    const attachmentId = Number(thumbnailMeta.metaValue);
    if (!Number.isFinite(attachmentId)) return null;
    return attachmentIdMap.get(attachmentId) || null;
  }

  private convertContentToMDX(content: string): string {
    if (!content) return '';
    if (/<!--\s*wp:/i.test(content) || /\[[a-z0-9_-]+(?:\s+[^\]]*)?\]/i.test(content)) {
      return content.trim();
    }

    // Basic HTML to MDX conversion
    // This is a simplified implementation - you might want to use a proper HTML to Markdown converter
    return content
      .replace(/<p>/g, '\n')
      .replace(/<\/p>/g, '\n')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
      .replace(/<em>(.*?)<\/em>/g, '*$1*')
      .replace(/<h([1-6])>(.*?)<\/h[1-6]>/g, (match, level, text) => `${'#'.repeat(parseInt(level))} ${text}\n`)
      .replace(/<a href="([^"]*)"[^>]*>(.*?)<\/a>/g, '[$2]($1)')
      .replace(
        /<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/g,
        (_match, src: string, alt: string) => `![${alt || ''}](${src})`
      )
      .trim();
  }

  private mapWordPressStatus(wpStatus: string): 'draft' | 'published' | 'scheduled' {
    switch (wpStatus) {
      case 'publish': return 'published';
      case 'future': return 'scheduled';
      default: return 'draft';
    }
  }

  private extractSEOMetadata(postmeta: WordPressPostMeta[]): any {
    const seo: any = {};
    
    for (const meta of postmeta) {
      switch (meta.metaKey) {
        case '_yoast_wpseo_title':
          seo.metaTitle = meta.metaValue;
          break;
        case '_yoast_wpseo_metadesc':
          seo.metaDescription = meta.metaValue;
          break;
        case '_yoast_wpseo_canonical':
          seo.canonicalUrl = meta.metaValue;
          break;
        case '_yoast_wpseo_meta-robots-noindex':
          seo.noIndex = meta.metaValue === '1';
          break;
      }
    }
    
    return Object.keys(seo).length > 0 ? seo : null;
  }

  private extractCustomFields(postmeta: WordPressPostMeta[]): any {
    const customFields: any = {};
    
    for (const meta of postmeta) {
      // Skip WordPress internal meta and SEO plugin meta
      if (meta.metaKey.startsWith('_') || meta.metaKey.includes('yoast')) {
        continue;
      }
      
      customFields[meta.metaKey] = meta.metaValue;
    }
    
    return Object.keys(customFields).length > 0 ? customFields : null;
  }

  private async resolveAuthorId(wpPost: WordPressPost): Promise<string | null> {
    const creator = (wpPost.creator || '').trim();
    const lowerCreator = creator.toLowerCase();

    const potentialKeys = new Set<string>();
    if (creator) {
      potentialKeys.add(creator);
      potentialKeys.add(lowerCreator);
    }

    const displayNameMeta = wpPost.postmeta.find((meta) => meta.metaKey === 'author_display_name');
    if (displayNameMeta?.metaValue) {
      const displayName = displayNameMeta.metaValue.trim();
      if (displayName) {
        potentialKeys.add(displayName);
        potentialKeys.add(displayName.toLowerCase());
      }
    }

    for (const key of potentialKeys) {
      const authorId = this.authorLoginMap.get(key);
      if (authorId) {
        return authorId;
      }
    }

    for (const key of potentialKeys) {
      const authorId = this.authorEmailMap.get(key.toLowerCase());
      if (authorId) {
        return authorId;
      }
    }

    if (creator) {
      const placeholderEmail = `${this.slugify(creator)}-${wpPost.postId || Date.now()}@example.com`;
      const placeholderSlugBase = this.slugify(creator) || 'imported-author';
      const placeholderSlug = await this.ensureUniqueAuthorSlug(placeholderSlugBase);
      const { data: newAuthor, error: createError } = await this.dbClient
        .from('authors')
        .insert({
          name: creator,
          email: placeholderEmail,
          slug: placeholderSlug,
          bio: null
        })
        .select('id')
        .single();

      if (!createError && newAuthor) {
        this.authorLoginMap.set(creator, newAuthor.id);
        this.authorLoginMap.set(lowerCreator, newAuthor.id);
        this.authorEmailMap.set(placeholderEmail.toLowerCase(), newAuthor.id);
        return newAuthor.id;
      }
    }

    const fallbackEmail = this.authorEmailMap.values().next();
    if (!fallbackEmail.done) {
      return fallbackEmail.value;
    }

    const fallbackLogin = this.authorLoginMap.values().next();
    if (!fallbackLogin.done) {
      return fallbackLogin.value;
    }

    const { data: anyAuthor } = await this.dbClient
      .from('authors')
      .select('id')
      .limit(1)
      .maybeSingle();

    return anyAuthor?.id ?? null;
  }

  private ensureSlug(postName: string, title: string, fallbackId?: number): string {
    const trimmed = (postName || '').trim();
    if (trimmed) return trimmed;
    const slugified = this.slugify(title);
    if (slugified) return slugified;
    return `post-${fallbackId || Date.now()}`;
  }

  private slugify(value: string): string {
    return (value || '')
      .toString()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  private async ensureUniqueAuthorSlug(baseSlug: string): Promise<string> {
    const base = this.slugify(baseSlug) || 'author';
    let candidate = base;
    let suffix = 2;

    while (true) {
      const { data: existingAuthor, error } = await this.dbClient
        .from('authors')
        .select('id')
        .eq('slug', candidate)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!existingAuthor) {
        return candidate;
      }

      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
  }

  private async resolveCategoryId(slug: string): Promise<string | null> {
    if (!slug) return null;
    const cached = this.categorySlugMap.get(slug);
    if (cached) return cached;

    const { data, error } = await this.dbClient
      .from('categories')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      return null;
    }

    if (data?.id) {
      this.categorySlugMap.set(slug, data.id);
      return data.id;
    }

    return null;
  }

  private async resolveTagId(slug: string): Promise<string | null> {
    if (!slug) return null;
    const cached = this.tagSlugMap.get(slug);
    if (cached) return cached;

    const { data, error } = await this.dbClient
      .from('tags')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      return null;
    }

    if (data?.id) {
      this.tagSlugMap.set(slug, data.id);
      return data.id;
    }

    return null;
  }

  private async associatePostTaxonomies(
    postId: string,
    taxonomies: WordPressPostTaxonomy[],
    _overwrite: boolean
  ): Promise<void> {
    const { error: deleteCategoryError } = await this.dbClient
      .from('post_categories')
      .delete()
      .eq('post_id', postId);

    if (deleteCategoryError) {
      this.errors.push({
        type: 'category',
        id: postId,
        message: `Failed to clear existing category relations for post ${postId}: ${deleteCategoryError.message}`
      });
      return;
    }

    const { error: deleteTagError } = await this.dbClient
      .from('post_tags')
      .delete()
      .eq('post_id', postId);

    if (deleteTagError) {
      this.errors.push({
        type: 'tag',
        id: postId,
        message: `Failed to clear existing tag relations for post ${postId}: ${deleteTagError.message}`
      });
      return;
    }

    if (!taxonomies || taxonomies.length === 0) {
      return;
    }

    const categoryIds = new Set<string>();
    const tagIds = new Set<string>();

    for (const taxonomy of taxonomies) {
      const slug = taxonomy.slug?.trim();
      if (!slug) continue;

      const domain = (taxonomy.domain || '').toLowerCase();

      if (domain === 'category') {
        const categoryId = await this.resolveCategoryId(slug);
        if (categoryId) {
          categoryIds.add(categoryId);
        } else {
          this.warnings.push({
            type: 'category',
            id: slug,
            message: `Category for slug "${slug}" not found during post association`,
            suggestion: 'Verify category exists or rerun migration after importing categories.'
          });
        }
      } else if (domain === 'post_tag' || domain === 'tag') {
        const tagId = await this.resolveTagId(slug);
        if (tagId) {
          tagIds.add(tagId);
        } else {
          this.warnings.push({
            type: 'tag',
            id: slug,
            message: `Tag for slug "${slug}" not found during post association`,
            suggestion: 'Verify tag exists or rerun migration after importing tags.'
          });
        }
      }
    }

    if (categoryIds.size > 0) {
      const relationships = Array.from(categoryIds).map((categoryId) => ({
        post_id: postId,
        category_id: categoryId
      }));

      const { error } = await this.dbClient
        .from('post_categories')
        .insert(relationships);

      if (error) {
        this.errors.push({
          type: 'category',
          id: postId,
          message: `Failed to relate categories for post ${postId}: ${error.message}`
        });
      }
    }

    if (tagIds.size > 0) {
      const relationships = Array.from(tagIds).map((tagId) => ({
        post_id: postId,
        tag_id: tagId
      }));

      const { error } = await this.dbClient
        .from('post_tags')
        .insert(relationships);

      if (error) {
        this.errors.push({
          type: 'tag',
          id: postId,
          message: `Failed to relate tags for post ${postId}: ${error.message}`
        });
      }
    }
  }
}

// Export singleton instance
export const wordPressMigrationService = new WordPressMigrationService();

// Backwards-compatible exports from the legacy monolithic module path.
export * from './wordpress-migration/types.js';
export { WXRParser } from './wordpress-migration/parser.js';
export { AdvancedMediaOptimizer, ImageAnalysisService } from './wordpress-migration/media-optimizer.js';
