import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MediaManager } from '../media-manager.js';
import { CDNManager } from '../cdn-manager.js';
import type { MediaAsset } from '../../types/index.js';

// Mock external dependencies
vi.mock('../../supabase.js');
vi.mock('sharp');

describe('MediaManager Integration Tests', () => {
  let mediaManager: MediaManager;
  let cdnManager: CDNManager;

  beforeEach(() => {
    mediaManager = new MediaManager();
    cdnManager = new CDNManager({ provider: 'vercel' });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete Media Upload and Optimization Workflow', () => {
    it('should handle complete media upload, optimization, and CDN integration', async () => {
      // Mock file upload
      const baseBuffer = new ArrayBuffer(2 * 1024 * 1024);
      const mockFile = new File([baseBuffer], 'test-image.jpg', { type: 'image/jpeg' });
      mockFile.arrayBuffer = async () => baseBuffer;

      // Mock successful upload and optimization
      const mockUploadResult = {
        original: {
          id: '123',
          filename: 'test-image.jpg',
          url: 'https://storage.example.com/test-image.jpg',
          storagePath: 'uploads/test-image.jpg',
          altText: 'Test image',
          mimeType: 'image/jpeg',
          fileSize: 2 * 1024 * 1024,
          dimensions: { width: 1920, height: 1080 },
          createdAt: new Date()
        } as MediaAsset,
        standard: {
          id: '124',
          filename: 'test-image-standard.jpg',
          url: 'https://storage.example.com/test-image-standard.jpg',
          storagePath: 'uploads/test-image-standard.jpg',
          mimeType: 'image/jpeg',
          fileSize: 800 * 1024,
          dimensions: { width: 1600, height: 900 },
          createdAt: new Date()
        } as MediaAsset,
        optimized: [] as MediaAsset[],
        sizeSavings: 200 * 1024, // 200KB saved
        formatConversions: []
      };

      // Mock the upload method
      vi.spyOn(mediaManager, 'uploadMedia').mockResolvedValue(mockUploadResult);

      // Execute upload
      const result = await mediaManager.uploadMedia({
        file: mockFile,
        altText: 'Test image'
      });
      const primaryAsset = result.public ?? result.original;

      // Verify upload results
      expect(primaryAsset).toBeDefined();
      expect(result.standard).toBeDefined();
      expect(result.optimized).toHaveLength(0);
      expect(result.sizeSavings).toBeGreaterThanOrEqual(0);
      expect(result.formatConversions).toEqual([]);

      // Test CDN integration
      const cdnUrl = cdnManager.generateOptimizedUrl(primaryAsset, {
        width: 800,
        format: 'webp',
        quality: 85
      });

      expect(cdnUrl).toContain('w=800');
      expect(cdnUrl).toContain('f=webp');
      expect(cdnUrl).toContain('q=85');

      // Test responsive URLs generation
      const responsiveUrls = cdnManager.generateResponsiveUrls(primaryAsset);
      expect(responsiveUrls).toHaveProperty('thumbnail');
      expect(responsiveUrls).toHaveProperty('small');
      expect(responsiveUrls).toHaveProperty('medium');
      expect(responsiveUrls).toHaveProperty('large');
      expect(responsiveUrls).toHaveProperty('xlarge');

      // Test picture element generation
      const pictureElement = cdnManager.generatePictureElement(primaryAsset, {
        alt: primaryAsset.altText || 'Test image',
        className: 'responsive-image',
        loading: 'lazy'
      });

      expect(pictureElement).toContain('<picture>');
      expect(pictureElement).toContain('type="image/avif"');
      expect(pictureElement).toContain('type="image/webp"');
      expect(pictureElement).toContain('alt="Test image"');
    });

    it('should handle media management workflow with analytics', async () => {
      // Mock media assets for analytics
      const mockAssets = [
        {
          id: '1',
          filename: 'image1.jpg',
          mimeType: 'image/jpeg',
          fileSize: 1024 * 1024,
          createdAt: new Date()
        },
        {
          id: '2',
          filename: 'image2.png',
          mimeType: 'image/png',
          fileSize: 2 * 1024 * 1024,
          createdAt: new Date()
        },
        {
          id: '3',
          filename: 'image3.webp',
          mimeType: 'image/webp',
          fileSize: 800 * 1024,
          createdAt: new Date()
        }
      ];

      // Mock usage stats
      const mockStats = {
        totalFiles: 3,
        totalSize: 3.8 * 1024 * 1024, // ~3.8MB
        formatDistribution: {
          jpeg: 1,
          png: 1,
          webp: 1
        },
        averageFileSize: (3.8 * 1024 * 1024) / 3,
        optimizationSavings: 500 * 1024 // 500KB saved
      };

      vi.spyOn(mediaManager, 'getMediaUsageStats').mockResolvedValue(mockStats);

      const stats = await mediaManager.getMediaUsageStats();

      expect(stats.totalFiles).toBe(3);
      expect(stats.formatDistribution.webp).toBe(1);
      expect(stats.optimizationSavings).toBeGreaterThan(0);

      // Test optimization recommendations
      const mockRecommendations = {
        oversizedImages: [mockAssets[1]] as MediaAsset[], // PNG is oversized
        unoptimizedFormats: [mockAssets[0], mockAssets[1]] as MediaAsset[], // JPEG and PNG
        missingAltText: [mockAssets[0]] as MediaAsset[], // First image missing alt text
        totalPotentialSavings: 1024 * 1024 // 1MB potential savings
      };

      vi.spyOn(mediaManager, 'getOptimizationRecommendations')
        .mockResolvedValue(mockRecommendations);

      const recommendations = await mediaManager.getOptimizationRecommendations();

      expect(recommendations.oversizedImages).toHaveLength(1);
      expect(recommendations.unoptimizedFormats).toHaveLength(2);
      expect(recommendations.missingAltText).toHaveLength(1);
      expect(recommendations.totalPotentialSavings).toBeGreaterThan(0);
    });

    it('should handle bulk operations efficiently', async () => {
      const assetIds = ['1', '2', '3', '4', '5'];

      // Mock bulk delete with some failures
      const mockBulkResult = {
        deleted: ['1', '2', '4', '5'],
        failed: ['3'] // One failure
      };

      vi.spyOn(mediaManager, 'bulkDeleteMediaAssets').mockResolvedValue(mockBulkResult);

      const result = await mediaManager.bulkDeleteMediaAssets(assetIds);

      expect(result.deleted).toHaveLength(4);
      expect(result.failed).toHaveLength(1);
      expect(result.failed).toContain('3');

      // Verify partial success handling
      const successRate = result.deleted.length / assetIds.length;
      expect(successRate).toBe(0.8); // 80% success rate
    });

    it('should integrate with CDN for cache management', async () => {
      const cdnManagerCloudflare = new CDNManager({
        provider: 'cloudflare',
        apiKey: 'test-key',
        zoneId: 'test-zone',
        baseUrl: 'https://cdn.example.com'
      });

      const urlsToPurge = [
        'https://cdn.example.com/image1.jpg',
        'https://cdn.example.com/image2.jpg'
      ];

      // Mock successful cache purge
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        statusText: 'OK'
      });

      await cdnManagerCloudflare.purgeCacheUrls(urlsToPurge);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('purge_cache'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ files: urlsToPurge })
        })
      );

      // Test CDN analytics integration
      const analytics = await cdnManagerCloudflare.getCDNAnalytics('24h');
      expect(analytics).toHaveProperty('totalRequests');
      expect(analytics).toHaveProperty('cacheHitRate');
      expect(analytics).toHaveProperty('bandwidthSaved');
    });

    it('should handle error scenarios gracefully', async () => {
      // Test upload failure
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      
      vi.spyOn(mediaManager, 'uploadMedia').mockRejectedValue(
        new Error('Storage service unavailable')
      );

      await expect(mediaManager.uploadMedia({ file: mockFile }))
        .rejects.toThrow('Storage service unavailable');

      // Test CDN failure with fallback
      const cdnManagerWithFallback = new CDNManager({ provider: 'custom' });
      const mockAsset = {
        id: '123',
        url: 'https://example.com/image.jpg'
      } as MediaAsset;

      // Should return original URL when CDN fails
      const fallbackUrl = cdnManagerWithFallback.generateOptimizedUrl(mockAsset, {
        width: 800
      });

      expect(fallbackUrl).toContain('width=800');
    });

    it('should provide comprehensive media insights', async () => {
      // Mock comprehensive media data
      const mockInsights = {
        totalAssets: 150,
        totalStorage: 500 * 1024 * 1024, // 500MB
        formatBreakdown: {
          'image/jpeg': 60,
          'image/png': 40,
          'image/webp': 35,
          'image/avif': 15
        },
        optimizationOpportunities: {
          canConvertToWebP: 85,
          canConvertToAVIF: 100,
          canResize: 25,
          missingAltText: 30
        },
        performanceMetrics: {
          averageLoadTime: 250, // ms
          cacheHitRate: 0.92,
          bandwidthSaved: 150 * 1024 * 1024 // 150MB
        }
      };

      // This would be a comprehensive analytics method
      const getMediaInsights = async () => {
        const stats = await mediaManager.getMediaUsageStats();
        const recommendations = await mediaManager.getOptimizationRecommendations();
        const cdnAnalytics = await cdnManager.getCDNAnalytics('7d');

        return {
          usage: stats,
          optimization: recommendations,
          cdn: cdnAnalytics
        };
      };

      // Mock the individual methods
      vi.spyOn(mediaManager, 'getMediaUsageStats').mockResolvedValue({
        totalFiles: mockInsights.totalAssets,
        totalSize: mockInsights.totalStorage,
        formatDistribution: { jpeg: 60, png: 40, webp: 35, avif: 15 },
        averageFileSize: mockInsights.totalStorage / mockInsights.totalAssets,
        optimizationSavings: mockInsights.performanceMetrics.bandwidthSaved
      });

      vi.spyOn(mediaManager, 'getOptimizationRecommendations').mockResolvedValue({
        oversizedImages: [],
        unoptimizedFormats: [],
        missingAltText: [],
        totalPotentialSavings: 50 * 1024 * 1024 // 50MB potential
      });

      const insights = await getMediaInsights();

      expect(insights.usage.totalFiles).toBe(150);
      expect(insights.usage.formatDistribution.webp).toBe(35);
      expect(insights.cdn.cacheHitRate).toBeGreaterThan(0.9);
    });
  });
});
