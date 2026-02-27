import { supabaseAdmin } from '../supabase.js';
import { mediaManager } from './media-manager.js';
import { getStorageBucketConfig } from '../storage/buckets.js';
import { getSiteContentRouting } from '../site-config.js';
import { buildArticlePostPath } from '../routing/articles.js';
import type { BlogPost, MediaAsset } from '../types/index.js';

function parseDimensionsValue(value: unknown): { width: number; height: number } | undefined {
  if (!value) return undefined;
  let parsed = value as any;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return undefined;
    }
  }
  if (!parsed || typeof parsed !== 'object') return undefined;
  const width = Number((parsed as any).width);
  const height = Number((parsed as any).height);
  return Number.isFinite(width) && Number.isFinite(height) ? { width, height } : undefined;
}

/**
 * Post-Migration Content Optimization Service
 * Handles content cleanup and optimization after WordPress migration
 */
export class PostMigrationOptimizer {
  /**
   * Run complete post-migration optimization
   */
  async runPostMigrationOptimization(): Promise<PostMigrationReport> {
    const startTime = Date.now();
    
    const report: PostMigrationReport = {
      contentScanned: 0,
      imageUrlsUpdated: 0,
      brokenLinksFixed: 0,
      altTextGenerated: 0,
      contentStructureOptimized: 0,
      seoIssuesFixed: 0,
      processingTime: 0,
      issues: [],
      recommendations: []
    };

    try {
      // Step 1: Scan and update image URLs in migrated posts
      const imageUrlResults = await this.scanAndUpdateImageUrls();
      report.contentScanned += imageUrlResults.postsScanned;
      report.imageUrlsUpdated += imageUrlResults.urlsUpdated;

      // Step 2: Detect and repair broken internal links
      const brokenLinkResults = await this.detectAndRepairBrokenLinks();
      report.brokenLinksFixed += brokenLinkResults.linksFixed;
      report.issues.push(...brokenLinkResults.issues);

      // Step 3: Generate alt text for images missing accessibility data
      const altTextResults = await this.generateMissingAltText();
      report.altTextGenerated += altTextResults.altTextGenerated;

      // Step 4: Optimize content structure
      const structureResults = await this.optimizeContentStructure();
      report.contentStructureOptimized += structureResults.postsOptimized;
      report.issues.push(...structureResults.issues);

      // Step 5: Generate SEO audit report
      const seoResults = await this.generateSEOAuditReport();
      report.seoIssuesFixed += seoResults.issuesFixed;
      report.recommendations.push(...seoResults.recommendations);

      report.processingTime = Date.now() - startTime;

      return report;

    } catch (error) {
      report.issues.push({
        type: 'system',
        severity: 'high',
        message: `Post-migration optimization failed: ${error.message}`,
        affectedContent: 'all'
      });
      
      report.processingTime = Date.now() - startTime;
      return report;
    }
  }

  /**
   * Scan content and update image URLs to use optimized versions
   */
  async scanAndUpdateImageUrls(): Promise<{ postsScanned: number; urlsUpdated: number }> {
    let postsScanned = 0;
    let urlsUpdated = 0;

    // Get all posts
    const { data: posts, error } = await supabaseAdmin
      .from('posts')
      .select('id, title, content');

    if (error) {
      throw new Error(`Failed to fetch posts: ${error.message}`);
    }

    for (const post of posts || []) {
      postsScanned++;
      
      // Find image URLs in content (Markdown + HTML)
      const markdownPattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
      const htmlPattern = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
      let updatedContent = post.content;
      let hasUpdates = false;

      for (const match of post.content.matchAll(markdownPattern)) {
        const [fullMatch, altText, imageUrl] = match;

        if (this.isWordPressMediaUrl(imageUrl)) {
          const optimizedUrl = await this.findOptimizedMediaUrl(imageUrl);

          if (optimizedUrl && optimizedUrl !== imageUrl) {
            updatedContent = updatedContent.replace(fullMatch, `![${altText}](${optimizedUrl})`);
            hasUpdates = true;
            urlsUpdated++;
          }
        }
      }

      for (const match of post.content.matchAll(htmlPattern)) {
        const [fullMatch, imageUrl] = match;

        if (this.isWordPressMediaUrl(imageUrl)) {
          const optimizedUrl = await this.findOptimizedMediaUrl(imageUrl);

          if (optimizedUrl && optimizedUrl !== imageUrl) {
            const updatedTag = fullMatch.replace(imageUrl, optimizedUrl);
            updatedContent = updatedContent.replace(fullMatch, updatedTag);
            hasUpdates = true;
            urlsUpdated++;
          }
        }
      }

      // Update post if changes were made
      if (hasUpdates) {
        const { error: updateError } = await supabaseAdmin
          .from('posts')
          .update({ content: updatedContent })
          .eq('id', post.id);

        if (updateError) {
          console.error(`Failed to update post ${post.id}:`, updateError);
        }
      }
    }

    return { postsScanned, urlsUpdated };
  }

  /**
   * Detect and repair broken internal links
   */
  async detectAndRepairBrokenLinks(): Promise<{ linksFixed: number; issues: ContentIssue[] }> {
    let linksFixed = 0;
    const issues: ContentIssue[] = [];
    const contentRouting = await getSiteContentRouting();

    // Get all posts
    const { data: posts, error } = await supabaseAdmin
      .from('posts')
      .select('id, title, content, slug, published_at, created_at');

    if (error) {
      throw new Error(`Failed to fetch posts: ${error.message}`);
    }

    // Create a map of slugs to new URLs for quick lookup
    const slugToUrlMap = new Map<string, string>();
    for (const post of posts || []) {
      slugToUrlMap.set(post.slug, buildArticlePostPath(post.slug, post.published_at || post.created_at, {
        basePath: contentRouting.articleBasePath,
        permalinkStyle: contentRouting.articlePermalinkStyle
      }));
    }

    for (const post of posts || []) {
      // Find internal links in content
      const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
      let updatedContent = post.content;
      let hasUpdates = false;

      let match;
      while ((match = linkPattern.exec(post.content)) !== null) {
        const [fullMatch, linkText, linkUrl] = match;
        
        // Check if this is an internal WordPress link
        if (this.isWordPressInternalLink(linkUrl)) {
          const slug = this.extractSlugFromWordPressUrl(linkUrl);
          
          if (slug && slugToUrlMap.has(slug)) {
            const newUrl = slugToUrlMap.get(slug)!;
            updatedContent = updatedContent.replace(fullMatch, `[${linkText}](${newUrl})`);
            hasUpdates = true;
            linksFixed++;
          } else {
            issues.push({
              type: 'broken-link',
              severity: 'medium',
              message: `Broken internal link found: ${linkUrl}`,
              affectedContent: post.title,
              suggestion: 'Update link to point to correct internal page or remove if no longer relevant'
            });
          }
        }
      }

      // Update post if changes were made
      if (hasUpdates) {
        const { error: updateError } = await supabaseAdmin
          .from('posts')
          .update({ content: updatedContent })
          .eq('id', post.id);

        if (updateError) {
          console.error(`Failed to update post ${post.id}:`, updateError);
        }
      }
    }

    return { linksFixed, issues };
  }

  /**
   * Generate alt text for images missing accessibility data
   */
  async generateMissingAltText(): Promise<{ altTextGenerated: number }> {
    let altTextGenerated = 0;

    // Get media assets without alt text
    const { data: mediaAssets, error } = await supabaseAdmin
      .from('media_assets')
      .select('*')
      .or('alt_text.is.null,alt_text.eq.');

    if (error) {
      throw new Error(`Failed to fetch media assets: ${error.message}`);
    }

    for (const asset of mediaAssets || []) {
      try {
        // Generate AI-assisted alt text suggestion
        const suggestedAltText = await mediaManager.generateAltTextSuggestion({
          id: asset.id,
          filename: asset.filename,
          url: '', // Not needed for alt text generation
          storagePath: asset.storage_path,
          altText: asset.alt_text,
          caption: asset.caption,
          mimeType: asset.mime_type,
          fileSize: asset.file_size,
          dimensions: parseDimensionsValue(asset.dimensions),
          createdAt: new Date(asset.created_at)
        });

        // Update the asset with generated alt text
        const { error: updateError } = await supabaseAdmin
          .from('media_assets')
          .update({ alt_text: suggestedAltText })
          .eq('id', asset.id);

        if (updateError) {
          console.error(`Failed to update alt text for asset ${asset.id}:`, updateError);
        } else {
          altTextGenerated++;
        }

      } catch (error) {
        console.error(`Failed to generate alt text for asset ${asset.id}:`, error);
      }
    }

    return { altTextGenerated };
  }

  /**
   * Optimize content structure (heading hierarchy, paragraph spacing)
   */
  async optimizeContentStructure(): Promise<{ postsOptimized: number; issues: ContentIssue[] }> {
    let postsOptimized = 0;
    const issues: ContentIssue[] = [];

    // Get all posts
    const { data: posts, error } = await supabaseAdmin
      .from('posts')
      .select('id, title, content');

    if (error) {
      throw new Error(`Failed to fetch posts: ${error.message}`);
    }

    for (const post of posts || []) {
      let updatedContent = post.content;
      let hasUpdates = false;
      const postIssues: string[] = [];

      // Fix heading hierarchy
      const headingFixes = this.fixHeadingHierarchy(updatedContent);
      if (headingFixes.hasChanges) {
        updatedContent = headingFixes.content;
        hasUpdates = true;
        postIssues.push(...headingFixes.issues);
      }

      // Fix paragraph spacing
      const paragraphFixes = this.fixParagraphSpacing(updatedContent);
      if (paragraphFixes.hasChanges) {
        updatedContent = paragraphFixes.content;
        hasUpdates = true;
      }

      // Remove excessive line breaks
      const lineBreakFixes = this.removeExcessiveLineBreaks(updatedContent);
      if (lineBreakFixes.hasChanges) {
        updatedContent = lineBreakFixes.content;
        hasUpdates = true;
      }

      // Update post if changes were made
      if (hasUpdates) {
        const { error: updateError } = await supabaseAdmin
          .from('posts')
          .update({ content: updatedContent })
          .eq('id', post.id);

        if (updateError) {
          console.error(`Failed to update post ${post.id}:`, updateError);
        } else {
          postsOptimized++;
        }
      }

      // Add issues to report
      if (postIssues.length > 0) {
        issues.push({
          type: 'content-structure',
          severity: 'low',
          message: `Content structure issues found: ${postIssues.join(', ')}`,
          affectedContent: post.title,
          suggestion: 'Review heading hierarchy and content structure for better readability'
        });
      }
    }

    return { postsOptimized, issues };
  }

  /**
   * Generate SEO audit report with improvement recommendations
   */
  async generateSEOAuditReport(): Promise<{ issuesFixed: number; recommendations: SEORecommendation[] }> {
    let issuesFixed = 0;
    const recommendations: SEORecommendation[] = [];
    const contentRouting = await getSiteContentRouting();

    // Get all posts with SEO metadata
    const { data: posts, error } = await supabaseAdmin
      .from('posts')
      .select('id, title, content, excerpt, slug, published_at, created_at, seo_metadata');

    if (error) {
      throw new Error(`Failed to fetch posts: ${error.message}`);
    }

    for (const post of posts || []) {
      const seoMetadata = post.seo_metadata || {};
      const postRecommendations: string[] = [];
      let postIssuesFixed = 0;

      // Check meta title
      if (!seoMetadata.metaTitle) {
        seoMetadata.metaTitle = post.title;
        issuesFixed++;
        postIssuesFixed++;
        postRecommendations.push('Generated meta title from post title');
      } else if (seoMetadata.metaTitle.length > 60) {
        postRecommendations.push('Meta title is too long (>60 characters)');
      }

      // Check meta description
      if (!seoMetadata.metaDescription) {
        if (post.excerpt) {
          seoMetadata.metaDescription = post.excerpt.substring(0, 155);
          issuesFixed++;
          postIssuesFixed++;
          postRecommendations.push('Generated meta description from excerpt');
        } else {
          postRecommendations.push('Missing meta description - consider adding one');
        }
      } else if (seoMetadata.metaDescription.length > 155) {
        postRecommendations.push('Meta description is too long (>155 characters)');
      }

      // Check canonical URL
      if (!seoMetadata.canonicalUrl) {
        seoMetadata.canonicalUrl = buildArticlePostPath(post.slug, post.published_at || post.created_at, {
          basePath: contentRouting.articleBasePath,
          permalinkStyle: contentRouting.articlePermalinkStyle
        });
        issuesFixed++;
        postIssuesFixed++;
        postRecommendations.push('Generated canonical URL');
      }

      // Analyze content for SEO
      const contentAnalysis = this.analyzeContentForSEO(post.content, post.title);
      postRecommendations.push(...contentAnalysis.recommendations);

      // Update SEO metadata if changes were made
      if (postIssuesFixed > 0) {
        const { error: updateError } = await supabaseAdmin
          .from('posts')
          .update({ seo_metadata: seoMetadata })
          .eq('id', post.id);

        if (updateError) {
          console.error(`Failed to update SEO metadata for post ${post.id}:`, updateError);
        }
      }

      // Add recommendations
      if (postRecommendations.length > 0) {
        recommendations.push({
          postId: post.id,
          postTitle: post.title,
          priority: this.calculateSEOPriority(postRecommendations),
          recommendations: postRecommendations
        });
      }
    }

    return { issuesFixed, recommendations };
  }

  /**
   * Utility methods
   */
  private isWordPressMediaUrl(url: string): boolean {
    return url.includes('/wp-content/uploads/') || 
           url.includes('/uploads/') ||
           url.match(/\/\d{4}\/\d{2}\//); // WordPress date-based upload structure
  }

  private async findOptimizedMediaUrl(originalUrl: string): Promise<string | null> {
    // Extract filename from URL
    const filename = originalUrl.split('/').pop();
    if (!filename) return null;

    // Look for optimized version in our media assets
    const { data: asset, error } = await supabaseAdmin
      .from('media_assets')
      .select('*')
      .ilike('filename', `%${filename}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !asset) return null;

    // Return the public URL from Supabase Storage
    const { media: mediaBucket } = await getStorageBucketConfig();
    const { data: urlData } = supabaseAdmin.storage
      .from(mediaBucket)
      .getPublicUrl(asset.storage_path);

    return urlData.publicUrl;
  }

  private isWordPressInternalLink(url: string): boolean {
    return url.includes('/?p=') || 
           url.includes('/archives/') ||
           url.match(/\/\d{4}\/\d{2}\/\d{2}\//); // WordPress permalink structure
  }

  private extractSlugFromWordPressUrl(url: string): string | null {
    // Extract slug from various WordPress URL formats
    const patterns = [
      /\/([^\/]+)\/?$/, // Standard permalink
      /\/\d{4}\/\d{2}\/\d{2}\/([^\/]+)\/?$/, // Date-based permalink
      /\?p=(\d+)/ // Query-based permalink (would need additional lookup)
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  private fixHeadingHierarchy(content: string): { content: string; hasChanges: boolean; issues: string[] } {
    const issues: string[] = [];
    let hasChanges = false;
    let updatedContent = content;

    // Find all headings
    const headingPattern = /^(#{1,6})\s+(.+)$/gm;
    const headings: { level: number; text: string; line: number }[] = [];
    
    let match;
    let lineNumber = 0;
    const lines = content.split('\n');
    
    for (const line of lines) {
      lineNumber++;
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        headings.push({
          level: headingMatch[1].length,
          text: headingMatch[2],
          line: lineNumber
        });
      }
    }

    // Check for heading hierarchy issues
    for (let i = 1; i < headings.length; i++) {
      const current = headings[i];
      const previous = headings[i - 1];
      
      // Check if heading level jumps more than 1
      if (current.level > previous.level + 1) {
        issues.push(`Heading level jumps from H${previous.level} to H${current.level} at line ${current.line}`);
      }
    }

    // Check if first heading is not H1 (but allow H2 for blog posts)
    if (headings.length > 0 && headings[0].level > 2) {
      issues.push('First heading should be H1 or H2');
    }

    return { content: updatedContent, hasChanges, issues };
  }

  private fixParagraphSpacing(content: string): { content: string; hasChanges: boolean } {
    // Ensure proper spacing between paragraphs
    const originalContent = content;
    
    // Fix multiple consecutive line breaks
    let updatedContent = content.replace(/\n{3,}/g, '\n\n');
    
    // Ensure line breaks after headings
    updatedContent = updatedContent.replace(/(^#{1,6}\s+.+)(\n)([^\n#])/gm, '$1\n\n$3');
    
    return {
      content: updatedContent,
      hasChanges: updatedContent !== originalContent
    };
  }

  private removeExcessiveLineBreaks(content: string): { content: string; hasChanges: boolean } {
    const originalContent = content;
    
    // Remove excessive line breaks (more than 2 consecutive)
    const updatedContent = content.replace(/\n{4,}/g, '\n\n\n');
    
    return {
      content: updatedContent,
      hasChanges: updatedContent !== originalContent
    };
  }

  private analyzeContentForSEO(content: string, title: string): { recommendations: string[] } {
    const recommendations: string[] = [];
    
    // Check content length
    const wordCount = content.split(/\s+/).length;
    if (wordCount < 300) {
      recommendations.push('Content is quite short (<300 words) - consider expanding for better SEO');
    }

    // Check for headings
    const headingCount = (content.match(/^#{1,6}\s+/gm) || []).length;
    if (headingCount === 0) {
      recommendations.push('No headings found - add H2/H3 headings to improve content structure');
    }

    // Check for images
    const imageCount = (content.match(/!\[.*?\]\(.*?\)/g) || []).length;
    if (imageCount === 0 && wordCount > 500) {
      recommendations.push('Consider adding images to break up long text content');
    }

    // Check for internal links
    const internalLinkCount = (content.match(/\[.*?\]\(\/.*?\)/g) || []).length;
    if (internalLinkCount === 0) {
      recommendations.push('Consider adding internal links to related content');
    }

    return { recommendations };
  }

  private calculateSEOPriority(recommendations: string[]): 'high' | 'medium' | 'low' {
    const highPriorityKeywords = ['missing meta', 'too long', 'too short'];
    const mediumPriorityKeywords = ['heading', 'structure'];
    
    const hasHighPriority = recommendations.some(rec => 
      highPriorityKeywords.some(keyword => rec.toLowerCase().includes(keyword))
    );
    
    const hasMediumPriority = recommendations.some(rec => 
      mediumPriorityKeywords.some(keyword => rec.toLowerCase().includes(keyword))
    );

    if (hasHighPriority) return 'high';
    if (hasMediumPriority) return 'medium';
    return 'low';
  }
}

// Interfaces
export interface PostMigrationReport {
  contentScanned: number;
  imageUrlsUpdated: number;
  brokenLinksFixed: number;
  altTextGenerated: number;
  contentStructureOptimized: number;
  seoIssuesFixed: number;
  processingTime: number;
  issues: ContentIssue[];
  recommendations: SEORecommendation[];
}

export interface ContentIssue {
  type: 'broken-link' | 'content-structure' | 'accessibility' | 'system';
  severity: 'low' | 'medium' | 'high';
  message: string;
  affectedContent: string;
  suggestion?: string;
}

export interface SEORecommendation {
  postId: string;
  postTitle: string;
  priority: 'high' | 'medium' | 'low';
  recommendations: string[];
}

// Export singleton instance
export const postMigrationOptimizer = new PostMigrationOptimizer();
