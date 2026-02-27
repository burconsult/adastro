import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  WXRParser, 
  ImageAnalysisService,
  AdvancedMediaOptimizer,
  WordPressMigrationService
} from '../wordpress-migration.js';

const { uploadMediaMock } = vi.hoisted(() => ({
  uploadMediaMock: vi.fn()
}));

vi.mock('../media-manager.js', () => ({
  mediaManager: {
    uploadMedia: uploadMediaMock
  }
}));

describe('WordPress Migration Unit Tests', () => {
  describe('WXRParser', () => {
    let parser: WXRParser;

    beforeEach(() => {
      parser = new WXRParser();
    });

    it('should extract site information correctly', async () => {
      const simpleWXR = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/">
<channel>
  <title>Test Site</title>
  <link>https://test.com</link>
  <description>Test Description</description>
  <language>en-US</language>
  <wp:base_site_url>https://test.com</wp:base_site_url>
  <wp:base_blog_url>https://test.com</wp:base_blog_url>
</channel>
</rss>`;

      const result = await parser.parseWXR(simpleWXR);

      expect(result.site.title).toBe('Test Site');
      expect(result.site.link).toBe('https://test.com');
      expect(result.site.description).toBe('Test Description');
      expect(result.site.language).toBe('en-US');
    });

    it('should handle empty or missing elements gracefully', async () => {
      const minimalWXR = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/">
<channel>
  <title></title>
  <link></link>
</channel>
</rss>`;

      const result = await parser.parseWXR(minimalWXR);

      expect(result.site.title).toBe('');
      expect(result.site.link).toBe('');
      expect(result.authors).toHaveLength(0);
      expect(result.categories).toHaveLength(0);
      expect(result.tags).toHaveLength(0);
      expect(result.posts).toHaveLength(0);
      expect(result.attachments).toHaveLength(0);
    });

    it('should parse multiple authors correctly', async () => {
      const multiAuthorWXR = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/">
<channel>
  <title>Test</title>
  <wp:author>
    <wp:author_id>1</wp:author_id>
    <wp:author_login>admin</wp:author_login>
    <wp:author_email>admin@test.com</wp:author_email>
    <wp:author_display_name>Admin</wp:author_display_name>
  </wp:author>
  <wp:author>
    <wp:author_id>2</wp:author_id>
    <wp:author_login>editor</wp:author_login>
    <wp:author_email>editor@test.com</wp:author_email>
    <wp:author_display_name>Editor</wp:author_display_name>
  </wp:author>
</channel>
</rss>`;

      const result = await parser.parseWXR(multiAuthorWXR);

      expect(result.authors).toHaveLength(2);
      expect(result.authors[0].authorDisplayName).toBe('Admin');
      expect(result.authors[1].authorDisplayName).toBe('Editor');
    });

    it('should parse hierarchical categories correctly', async () => {
      const hierarchicalWXR = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/">
<channel>
  <title>Test</title>
  <wp:category>
    <wp:term_id>1</wp:term_id>
    <wp:category_nicename>parent</wp:category_nicename>
    <wp:category_parent></wp:category_parent>
    <wp:cat_name>Parent Category</wp:cat_name>
  </wp:category>
  <wp:category>
    <wp:term_id>2</wp:term_id>
    <wp:category_nicename>child</wp:category_nicename>
    <wp:category_parent>parent</wp:category_parent>
    <wp:cat_name>Child Category</wp:cat_name>
  </wp:category>
</channel>
</rss>`;

      const result = await parser.parseWXR(hierarchicalWXR);

      expect(result.categories).toHaveLength(2);
      expect(result.categories[0].categoryParent).toBe('');
      expect(result.categories[1].categoryParent).toBe('parent');
    });

    it('should extract post metadata correctly', async () => {
      const postWithMetaWXR = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>Test</title>
  <item>
    <title>Test Post</title>
    <dc:creator>Admin</dc:creator>
    <content:encoded><![CDATA[Post content]]></content:encoded>
    <excerpt:encoded><![CDATA[Post excerpt]]></excerpt:encoded>
    <wp:post_id>1</wp:post_id>
    <wp:post_name>test-post</wp:post_name>
    <wp:status>publish</wp:status>
    <wp:post_type>post</wp:post_type>
    <wp:postmeta>
      <wp:meta_key>custom_field</wp:meta_key>
      <wp:meta_value>custom_value</wp:meta_value>
    </wp:postmeta>
    <wp:postmeta>
      <wp:meta_key>_yoast_wpseo_title</wp:meta_key>
      <wp:meta_value>SEO Title</wp:meta_value>
    </wp:postmeta>
  </item>
</channel>
</rss>`;

      const result = await parser.parseWXR(postWithMetaWXR);

      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].postmeta).toHaveLength(2);
      expect(result.posts[0].postmeta[0].metaKey).toBe('custom_field');
      expect(result.posts[0].postmeta[0].metaValue).toBe('custom_value');
      expect(result.posts[0].taxonomies).toEqual([]);
    });
  });

  describe('ImageAnalysisService', () => {
    let analyzer: ImageAnalysisService;

    beforeEach(() => {
      analyzer = new ImageAnalysisService();
    });

    it('should detect oversized images correctly', () => {
      const metadata = { width: 3000, height: 2000, format: 'jpeg' as const };
      const fileSize = 5 * 1024 * 1024; // 5MB

      // Use private method through type assertion for testing
      const isOversized = (analyzer as any).isOversized(metadata, fileSize);

      expect(isOversized).toBe(true);
    });

    it('should not flag appropriately sized images as oversized', () => {
      const metadata = { width: 1200, height: 800, format: 'jpeg' as const };
      const fileSize = 500 * 1024; // 500KB

      const isOversized = (analyzer as any).isOversized(metadata, fileSize);

      expect(isOversized).toBe(false);
    });

    it('should estimate quality based on entropy', () => {
      const highEntropyStats = { entropy: 7.5 };
      const lowEntropyStats = { entropy: 3.0 };

      const highQuality = (analyzer as any).estimateQuality(highEntropyStats);
      const lowQuality = (analyzer as any).estimateQuality(lowEntropyStats);

      expect(highQuality).toBeGreaterThan(lowQuality);
      expect(highQuality).toBeGreaterThanOrEqual(85);
      expect(lowQuality).toBeLessThanOrEqual(65);
    });

    it('should generate size optimization recommendations', () => {
      const metadata = { width: 4000, height: 3000, format: 'jpeg' as const };
      const fileSize = 3 * 1024 * 1024; // 3MB

      const recommendation = (analyzer as any).analyzeSizeOptimization(metadata, fileSize);

      expect(recommendation.type).toBe('size');
      expect(recommendation.severity).toBe('high');
      expect(recommendation.estimatedSavings).toBeGreaterThan(0);
      expect(recommendation.message).toContain('Resize from');
    });

    it('should generate format optimization recommendations', () => {
      const pngMetadata = { width: 1200, height: 800, format: 'png' as const, hasAlpha: false };
      const fileSize = 1024 * 1024; // 1MB

      const recommendation = (analyzer as any).analyzeFormatOptimization(pngMetadata, fileSize);

      expect(recommendation).not.toBeNull();
      expect(recommendation.type).toBe('format');
      expect(recommendation.message).toContain('Convert PNG to JPEG');
    });

    it('should generate contextual sizing recommendations', () => {
      const dimensions = { width: 2000, height: 1500 };

      const featuredSizes = analyzer.generateContextualSizes(dimensions, 'featured');
      const thumbnailSizes = analyzer.generateContextualSizes(dimensions, 'thumbnail');

      expect(featuredSizes.length).toBeGreaterThan(0);
      expect(thumbnailSizes.length).toBeGreaterThan(0);
      
      // Featured images should have larger sizes
      expect(featuredSizes[0].width).toBeGreaterThan(thumbnailSizes[0].width);
      
      // All recommendations should be smaller than original
      featuredSizes.forEach(size => {
        expect(size.width).toBeLessThan(dimensions.width);
      });
    });

    it('should not recommend sizes larger than original', () => {
      const smallDimensions = { width: 300, height: 200 };

      const featuredSizes = analyzer.generateContextualSizes(smallDimensions, 'featured');

      // Should return empty array or only smaller sizes
      featuredSizes.forEach(size => {
        expect(size.width).toBeLessThanOrEqual(smallDimensions.width);
        expect(size.height).toBeLessThanOrEqual(smallDimensions.height);
      });
    });
  });

  describe('AdvancedMediaOptimizer', () => {
    let optimizer: AdvancedMediaOptimizer;

    beforeEach(() => {
      optimizer = new AdvancedMediaOptimizer();
      
      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024 * 100)) // 100KB
      });

      // Mock sharp
      const mockSharp = {
        metadata: vi.fn().mockResolvedValue({
          width: 1200,
          height: 800,
          format: 'jpeg'
        }),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        webp: vi.fn().mockReturnThis(),
        avif: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('optimized-data'))
      };

      vi.doMock('sharp', () => vi.fn(() => mockSharp));
    });

    it('should determine media usage context correctly', async () => {
      const featuredAttachment = { 
        postTitle: 'Featured Hero Image',
        postId: 1,
        attachmentUrl: 'test.jpg',
        postExcerpt: '',
        postContent: ''
      };

      const thumbnailAttachment = { 
        postTitle: 'Profile Thumbnail',
        postId: 2,
        attachmentUrl: 'thumb.jpg',
        postExcerpt: '',
        postContent: ''
      };

      // Test the method exists in the migration service instead
      const migrationService = new (await import('../wordpress-migration.js')).WordPressMigrationService();
      const featuredContext = (migrationService as any).determineMediaUsageContext(featuredAttachment);
      const thumbnailContext = (migrationService as any).determineMediaUsageContext(thumbnailAttachment);

      expect(featuredContext).toBe('featured');
      expect(thumbnailContext).toBe('thumbnail');
    });

    it('should generate CDN-optimized URLs correctly', () => {
      const mockVersions = [
        {
          variant: 'original',
          url: 'https://example.com/original.jpg',
          filename: 'original.jpg',
          fileSize: 1024,
          dimensions: { width: 1200, height: 800 },
          format: 'jpeg',
          purpose: 'Original'
        },
        {
          variant: '800x600',
          url: 'https://example.com/800x600.jpg',
          filename: '800x600.jpg',
          fileSize: 512,
          dimensions: { width: 800, height: 600 },
          format: 'jpeg',
          purpose: 'Responsive'
        },
        {
          variant: 'webp',
          url: 'https://example.com/image.webp',
          filename: 'image.webp',
          fileSize: 400,
          dimensions: { width: 1200, height: 800 },
          format: 'webp',
          purpose: 'Modern format'
        }
      ];

      const cdnUrls = (optimizer as any).generateCDNOptimizedUrls(mockVersions);

      expect(cdnUrls.original).toBeDefined();
      expect(cdnUrls.responsive['800x600']).toBeDefined();
      expect(cdnUrls.modernFormats.webp).toBeDefined();
    });

    it('should generate optimization recommendations', () => {
      const analysis = {
        filename: 'test.jpg',
        originalSize: 2 * 1024 * 1024, // 2MB
        dimensions: { width: 3000, height: 2000 },
        format: 'jpeg',
        quality: 95,
        isOversized: true,
        recommendedOptimizations: [
          {
            type: 'size' as const,
            severity: 'high' as const,
            message: 'Resize image',
            estimatedSavings: 500 * 1024
          }
        ],
        potentialSavings: 500 * 1024
      };

      const recommendations = (optimizer as any).generateOptimizationRecommendations(analysis);

      expect(recommendations).toHaveLength(3); // Oversized + potential savings + optimization
      expect(recommendations[0]).toContain('oversized');
      expect(recommendations[1]).toContain('500KB');
      expect(recommendations[2]).toContain('SIZE: Resize image');
    });
  });

  describe('Content Conversion Utilities', () => {
    it('should convert HTML to MDX correctly', () => {
      const htmlContent = `
        <h2>Test Heading</h2>
        <p>This is a <strong>bold</strong> paragraph with <em>italic</em> text.</p>
        <p>Another paragraph with a <a href="https://example.com">link</a>.</p>
        <img src="image.jpg" alt="Test Image" />
      `;

      // This would be part of the migration service
      const convertContentToMDX = (content: string): string => {
        return content
          .replace(/<p>/g, '\n')
          .replace(/<\/p>/g, '\n')
          .replace(/<br\s*\/?>/g, '\n')
          .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
          .replace(/<em>(.*?)<\/em>/g, '*$1*')
          .replace(/<h([1-6])>(.*?)<\/h[1-6]>/g, (match, level, text) => `${'#'.repeat(parseInt(level))} ${text}\n`)
          .replace(/<a href="([^"]*)"[^>]*>(.*?)<\/a>/g, '[$2]($1)')
          .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/g, '![$2]($1)')
          .trim();
      };

      const mdxContent = convertContentToMDX(htmlContent);

      expect(mdxContent).toContain('## Test Heading');
      expect(mdxContent).toContain('**bold**');
      expect(mdxContent).toContain('*italic*');
      expect(mdxContent).toContain('[link](https://example.com)');
      expect(mdxContent).toContain('![Test Image](image.jpg)');
    });

    it('should map WordPress status correctly', () => {
      const mapWordPressStatus = (wpStatus: string): 'draft' | 'published' | 'scheduled' => {
        switch (wpStatus) {
          case 'publish': return 'published';
          case 'future': return 'scheduled';
          default: return 'draft';
        }
      };

      expect(mapWordPressStatus('publish')).toBe('published');
      expect(mapWordPressStatus('future')).toBe('scheduled');
      expect(mapWordPressStatus('draft')).toBe('draft');
      expect(mapWordPressStatus('private')).toBe('draft');
    });

    it('should extract SEO metadata from post meta', () => {
      const postmeta = [
        { metaKey: '_yoast_wpseo_title', metaValue: 'Custom Title' },
        { metaKey: '_yoast_wpseo_metadesc', metaValue: 'Custom Description' },
        { metaKey: '_yoast_wpseo_canonical', metaValue: 'https://example.com/canonical' },
        { metaKey: '_yoast_wpseo_meta-robots-noindex', metaValue: '1' },
        { metaKey: 'custom_field', metaValue: 'custom_value' }
      ];

      const extractSEOMetadata = (postmeta: Array<{metaKey: string, metaValue: string}>): any => {
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
      };

      const seoMetadata = extractSEOMetadata(postmeta);

      expect(seoMetadata.metaTitle).toBe('Custom Title');
      expect(seoMetadata.metaDescription).toBe('Custom Description');
      expect(seoMetadata.canonicalUrl).toBe('https://example.com/canonical');
      expect(seoMetadata.noIndex).toBe(true);
    });

    it('normalizes mp3 media types to audio/mpeg', () => {
      const service = new WordPressMigrationService();
      expect((service as any).normalizeMimeType('audio/mp3; charset=utf-8')).toBe('audio/mpeg');
      expect((service as any).inferMimeTypeFromUrl('https://example.com/audio/test.mp3')).toBe('audio/mpeg');
    });
  });

  class MockSupabaseClient {
    private tables = new Map<string, any[]>();
    private idCounter = 1;

    from(table: string) {
      if (!this.tables.has(table)) {
        this.tables.set(table, []);
      }

      const store = this;
      const filters: Array<{ column: string; value: any }> = [];
      let selectedColumns: string | undefined;
      let mode: 'select' | 'insert' | 'update' = 'select';
      let pendingRows: any[] = [];
      let pendingUpdate: Record<string, any> | null = null;

      const applyFilters = () =>
        store.getTable(table).filter((row) => filters.every((filter) => row[filter.column] === filter.value));

      const pickColumns = (row: Record<string, any>) => {
        if (!selectedColumns || selectedColumns === '*') {
          return { ...row };
        }

        const columns = selectedColumns.split(',').map((column) => column.trim());
        const result: Record<string, any> = {};
        for (const column of columns) {
          if (column in row) {
            result[column] = row[column];
          }
        }
        return result;
      };

      const query: any = {
        select(columns?: string) {
          selectedColumns = columns;
          return query;
        },
        eq(column: string, value: any) {
          filters.push({ column, value });

          if (mode === 'update' && pendingUpdate) {
            const rows = applyFilters();
            rows.forEach((row) => Object.assign(row, pendingUpdate));
            pendingRows = rows.map((row) => ({ ...row }));
            store.setTable(table, store.getTable(table));
          }

          return query;
        },
        maybeSingle() {
          const rows = mode === 'insert' || mode === 'update' ? pendingRows : applyFilters();
          if (rows.length === 0) {
            return Promise.resolve({ data: null, error: null });
          }
          if (rows.length === 1) {
            return Promise.resolve({ data: pickColumns(rows[0]), error: null });
          }
          return Promise.resolve({ data: null, error: new Error('Multiple rows found') });
        },
        single() {
          const rows = mode === 'insert' || mode === 'update' ? pendingRows : applyFilters();
          if (rows.length !== 1) {
            return Promise.resolve({
              data: rows[0] ? pickColumns(rows[0]) : null,
              error: rows.length === 1 ? null : new Error('Expected a single row')
            });
          }
          return Promise.resolve({ data: pickColumns(rows[0]), error: null });
        },
        insert(payload: any) {
          const records = Array.isArray(payload) ? payload : [payload];
          const inserted = records.map((record) => {
            const newRecord = { ...record };
            if (!newRecord.id) {
              newRecord.id = store.generateId();
            }
            store.getTable(table).push(newRecord);
            return { ...newRecord };
          });

          pendingRows = inserted;
          mode = 'insert';
          return query;
        },
        update(payload: Record<string, any>) {
          mode = 'update';
          pendingUpdate = payload;
          pendingRows = [];
          return query;
        },
        delete() {
          return {
            eq(column: string, value: any) {
              const remaining = store.getTable(table).filter((row) => row[column] !== value);
              store.setTable(table, remaining);
              return Promise.resolve({ error: null });
            }
          };
        }
      };

      return query;
    }

    tableData(table: string) {
      return this.tables.get(table) ?? [];
    }

    private getTable(table: string) {
      if (!this.tables.has(table)) {
        this.tables.set(table, []);
      }
      return this.tables.get(table)!;
    }

    private setTable(table: string, data: any[]) {
      this.tables.set(table, data);
    }

    private generateId() {
      return `id-${this.idCounter++}`;
    }
  }

  describe('WordPressMigrationService integration', () => {
    let uploadCounter = 1;

    beforeEach(() => {
      uploadCounter = 1;
      uploadMediaMock.mockReset();
      uploadMediaMock.mockImplementation(async () => ({
        original: {
          id: `media-${uploadCounter++}`,
          url: 'https://cdn.example.com/media.jpg'
        },
        standard: null,
        optimized: [],
        sizeSavings: 0,
        formatConversions: []
      }));

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: () => 'image/jpeg'
        },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
      });
    });

    it('imports sample WXR data into a mock database', async () => {
      const testDir = dirname(fileURLToPath(import.meta.url));
      const fixturePath = resolve(testDir, '../../../../tests/fixtures/sample-wordpress-export.xml');
      const xmlContent = readFileSync(fixturePath, 'utf-8');
      const wxrFile = {
        name: 'sample-wordpress-export.xml',
        text: async () => xmlContent
      } as unknown as File;

      const mockDb = new MockSupabaseClient();
      const optimizeSpy = vi.fn();
      const migrationService = new WordPressMigrationService({
        parser: new WXRParser(),
        mediaOptimizer: {
          optimizeMediaDuringMigration: optimizeSpy
        } as any,
        dbClient: mockDb as any
      });

      const result = await migrationService.importFromWXR(wxrFile, {
        includeDrafts: true,
        optimizeImages: false,
        generateAltText: true
      });

      expect(result.success).toBe(true);
      expect(result.summary.postsImported).toBe(2);
      expect(result.summary.categoriesImported).toBe(2);
      expect(result.summary.tagsImported).toBe(2);
      expect(result.summary.mediaImported).toBe(2);
      expect(optimizeSpy).not.toHaveBeenCalled();

      const posts = mockDb.tableData('posts');
      expect(posts).toHaveLength(2);
      expect(posts[0].slug).toBe('perseverance-captures-sunrise');
      expect(posts[0].content).toContain('![Sunrise on Mars]');

      const categories = mockDb.tableData('categories');
      expect(categories).toHaveLength(2);

      const tags = mockDb.tableData('tags');
      expect(tags).toHaveLength(2);

      const postCategories = mockDb.tableData('post_categories');
      expect(postCategories.length).toBeGreaterThanOrEqual(1);

      const urlMappings = result.urlMappings || [];
      expect(Array.isArray(urlMappings)).toBe(true);
    });

    it('limits imported posts and media when trial import is enabled', async () => {
      const posts = Array.from({ length: 15 }, (_, index) => ({
        title: `Post ${index + 1}`,
        link: '',
        pubDate: '',
        creator: 'Author One',
        guid: `guid-${index + 1}`,
        description: '',
        content: '<p>Example content</p>',
        excerpt: '',
        postId: index + 1,
        postDate: '2024-01-01 00:00:00',
        postDateGmt: '2024-01-01 00:00:00',
        commentStatus: 'closed',
        pingStatus: 'closed',
        postName: `post-${index + 1}`,
        status: index < 5 ? 'draft' : 'publish',
        postParent: 0,
        menuOrder: 0,
        postType: 'post',
        postPassword: '',
        isSticky: 0,
        taxonomies: [],
        postmeta: []
      }));

      const attachments = Array.from({ length: 15 }, (_, index) => ({
        attachmentUrl: `https://example.com/media-${index + 1}.jpg`,
        postId: 1000 + index,
        postTitle: `Media ${index + 1}`,
        postExcerpt: '',
        postContent: '',
        postParent: index + 1
      }));

      const mockParser = {
        parseWXR: vi.fn().mockResolvedValue({
          site: {
            title: 'Trial Site',
            link: 'https://example.com',
            description: '',
            language: 'en',
            baseSiteUrl: 'https://example.com',
            baseBlogUrl: 'https://example.com/blog'
          },
          authors: [
            {
              authorId: 1,
              authorLogin: 'author1',
              authorEmail: 'author1@example.com',
              authorDisplayName: 'Author One',
              authorFirstName: 'Author',
              authorLastName: 'One'
            }
          ],
          categories: [],
          tags: [],
          posts,
          attachments
        })
      };

      const mockDb = new MockSupabaseClient();

      const mockOptimizationResult = {
        originalUrl: 'https://example.com/media.jpg',
        originalSize: 1000,
        optimizedVersions: [
          {
            variant: 'original',
            filename: 'media.jpg',
            url: 'https://cdn.example.com/media.jpg',
            fileSize: 800,
            dimensions: { width: 100, height: 100 },
            format: 'jpeg',
            purpose: 'Optimized original'
          }
        ],
        cdnUrls: { original: 'https://cdn.example.com/media.jpg', responsive: {}, modernFormats: {} },
        totalSizeSavings: 200,
        sizeSavingsPercentage: 20,
        analysis: {
          filename: 'media.jpg',
          originalSize: 1000,
          dimensions: { width: 100, height: 100 },
          format: 'jpeg',
          quality: 80,
          isOversized: false,
          recommendedOptimizations: [],
          potentialSavings: 0
        },
        recommendations: []
      };

      const optimizeSpy = vi.fn().mockResolvedValue(mockOptimizationResult);

      const migrationService = new WordPressMigrationService({
        parser: mockParser as any,
        mediaOptimizer: { optimizeMediaDuringMigration: optimizeSpy } as any,
        dbClient: mockDb as any
      });

      const file = { text: async () => '<xml />' } as unknown as File;

      const result = await migrationService.importFromWXR(file, {
        includeDrafts: true,
        optimizeImages: true,
        trialImport: true
      });

      expect(result.summary.postsImported).toBe(10);
      expect(result.summary.postsProcessed).toBe(10);
      expect(result.summary.mediaImported).toBe(10);
      expect(result.summary.mediaProcessed).toBe(10);
      expect(mockDb.tableData('posts')).toHaveLength(10);
      expect(optimizeSpy).toHaveBeenCalledTimes(10);
      expect(result.warnings.some((warning) => warning.id === 'trial-mode')).toBe(true);
    });

    it('uses configured article routing when generating redirect mappings', async () => {
      const mockParser = {
        parseWXR: vi.fn().mockResolvedValue({
          site: {
            title: 'Routing Site',
            link: 'https://legacy.example.com',
            description: '',
            language: 'en',
            baseSiteUrl: 'https://legacy.example.com',
            baseBlogUrl: 'https://legacy.example.com/blog'
          },
          authors: [
            {
              authorId: 1,
              authorLogin: 'author',
              authorEmail: 'author@example.com',
              authorDisplayName: 'Author',
              authorFirstName: 'Author',
              authorLastName: ''
            }
          ],
          categories: [],
          tags: [],
          posts: [
            {
              title: 'Hello World',
              link: 'https://legacy.example.com/2024/02/14/hello-world/',
              pubDate: 'Wed, 14 Feb 2024 12:00:00 +0000',
              creator: 'Author',
              guid: 'guid-1',
              description: '',
              content: '<p>Hello</p>',
              excerpt: '',
              postId: 1,
              postDate: '2024-02-14 12:00:00',
              postDateGmt: '2024-02-14 12:00:00',
              commentStatus: 'closed',
              pingStatus: 'closed',
              postName: 'hello-world',
              status: 'publish',
              postParent: 0,
              menuOrder: 0,
              postType: 'post',
              postPassword: '',
              isSticky: 0,
              taxonomies: [],
              postmeta: []
            }
          ],
          attachments: []
        })
      };

      const migrationService = new WordPressMigrationService({
        parser: mockParser as any,
        dbClient: new MockSupabaseClient() as any
      });

      const file = { text: async () => '<xml />' } as unknown as File;
      const result = await migrationService.importFromWXR(file, {
        includeDrafts: true,
        optimizeImages: false,
        articleBasePath: 'articles',
        articlePermalinkStyle: 'wordpress'
      });

      expect(result.urlMappings[0]?.newUrl).toBe('/2024/02/14/hello-world/');
    });

    it('creates unique author slugs when imports collide on the same base slug', async () => {
      const mockParser = {
        parseWXR: vi.fn().mockResolvedValue({
          site: {
            title: 'Author Collision Site',
            link: 'https://example.com',
            description: '',
            language: 'en',
            baseSiteUrl: 'https://example.com',
            baseBlogUrl: 'https://example.com/blog'
          },
          authors: [
            {
              authorId: 1,
              authorLogin: 'Admin',
              authorEmail: 'admin-a@example.com',
              authorDisplayName: 'Admin',
              authorFirstName: 'Admin',
              authorLastName: 'A'
            },
            {
              authorId: 2,
              authorLogin: 'admin',
              authorEmail: 'admin-b@example.com',
              authorDisplayName: 'Admin',
              authorFirstName: 'Admin',
              authorLastName: 'B'
            }
          ],
          categories: [],
          tags: [],
          posts: [],
          attachments: []
        })
      };

      const mockDb = new MockSupabaseClient();
      const migrationService = new WordPressMigrationService({
        parser: mockParser as any,
        dbClient: mockDb as any
      });

      const file = { text: async () => '<xml />' } as unknown as File;
      const result = await migrationService.importFromWXR(file, {
        includeDrafts: true,
        optimizeImages: false
      });

      expect(result.summary.authorsImported).toBe(2);
      const slugs = mockDb.tableData('authors').map((author) => author.slug);
      expect(slugs).toContain('admin');
      expect(slugs).toContain('admin-2');
    });
  });
});
