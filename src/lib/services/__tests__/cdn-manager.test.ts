import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CDNManager, createCDNManager, detectDefaultCdnProvider, normalizeCdnProvider } from '../cdn-manager.js';
import type { MediaAsset } from '../../types/index.js';

describe('CDNManager', () => {
  let cdnManager: CDNManager;
  let mockMediaAsset: MediaAsset;

  beforeEach(() => {
    mockMediaAsset = {
      id: '123',
      filename: 'test-image.jpg',
      url: 'https://example.com/test-image.jpg',
      storagePath: 'uploads/test-image.jpg',
      altText: 'Test image',
      caption: null,
      mimeType: 'image/jpeg',
      fileSize: 1024 * 1024,
      dimensions: { width: 1920, height: 1080 },
      createdAt: new Date()
    };
  });

  describe('Vercel CDN', () => {
    beforeEach(() => {
      cdnManager = createCDNManager({ provider: 'vercel' });
    });

    it('should generate optimized URL with Vercel parameters', () => {
      const optimizedUrl = cdnManager.generateOptimizedUrl(mockMediaAsset, {
        width: 800,
        height: 600,
        quality: 85,
        format: 'webp'
      });

      expect(optimizedUrl).toBe('https://example.com/test-image.jpg?w=800&h=600&q=85&f=webp');
    });

    it('should return original URL when no options provided', () => {
      const optimizedUrl = cdnManager.generateOptimizedUrl(mockMediaAsset);
      expect(optimizedUrl).toBe('https://example.com/test-image.jpg');
    });

    it('should generate responsive URLs for different screen sizes', () => {
      const responsiveUrls = cdnManager.generateResponsiveUrls(mockMediaAsset);

      expect(responsiveUrls.thumbnail).toContain('w=150&h=150&fit=cover');
      expect(responsiveUrls.small).toContain('w=400&q=85');
      expect(responsiveUrls.medium).toContain('w=800&q=85');
      expect(responsiveUrls.large).toContain('w=1200&q=90');
      expect(responsiveUrls.xlarge).toContain('w=1920&q=90');
    });
  });

  describe('Netlify CDN', () => {
    beforeEach(() => {
      cdnManager = createCDNManager({ provider: 'netlify' });
    });

    it('should generate Netlify Image CDN URLs', () => {
      const optimizedUrl = cdnManager.generateOptimizedUrl(mockMediaAsset, {
        width: 800,
        height: 600,
        quality: 85,
        format: 'webp',
        fit: 'cover'
      });

      expect(optimizedUrl).toBe(
        '/.netlify/images?url=https%3A%2F%2Fexample.com%2Ftest-image.jpg&w=800&h=600&q=85&fm=webp&fit=cover'
      );
    });

    it('should generate responsive URLs through the Netlify image endpoint', () => {
      const responsiveUrls = cdnManager.generateResponsiveUrls(mockMediaAsset);

      expect(responsiveUrls.thumbnail).toContain('/.netlify/images?');
      expect(responsiveUrls.thumbnail).toContain('w=150');
      expect(responsiveUrls.thumbnail).toContain('fit=cover');
      expect(responsiveUrls.medium).toContain('w=800');
      expect(responsiveUrls.xlarge).toContain('w=1920');
    });
  });

  describe('Cloudflare CDN', () => {
    beforeEach(() => {
      cdnManager = createCDNManager({
        provider: 'cloudflare',
        baseUrl: 'https://cdn.example.com'
      });
    });

    it('should generate Cloudflare-optimized URL', () => {
      const optimizedUrl = cdnManager.generateOptimizedUrl(mockMediaAsset, {
        width: 800,
        quality: 85,
        format: 'webp'
      });

      expect(optimizedUrl).toBe(
        'https://cdn.example.com/cdn-cgi/image/w=800,q=85,f=webp/https://example.com/test-image.jpg'
      );
    });

    it('should return original URL when no base URL configured', () => {
      const cdnManagerNoBase = createCDNManager({ provider: 'cloudflare' });
      const optimizedUrl = cdnManagerNoBase.generateOptimizedUrl(mockMediaAsset, {
        width: 800
      });

      expect(optimizedUrl).toBe('https://example.com/test-image.jpg');
    });
  });

  describe('Custom CDN', () => {
    beforeEach(() => {
      cdnManager = createCDNManager({ provider: 'custom' });
    });

    it('should generate custom CDN URL with query parameters', () => {
      const optimizedUrl = cdnManager.generateOptimizedUrl(mockMediaAsset, {
        width: 800,
        height: 600,
        quality: 85,
        format: 'webp'
      });

      expect(optimizedUrl).toBe(
        'https://example.com/test-image.jpg?width=800&height=600&quality=85&format=webp'
      );
    });
  });

  describe('Picture element generation', () => {
    beforeEach(() => {
      cdnManager = createCDNManager({ provider: 'vercel' });
    });

    it('should generate complete picture element with multiple sources', () => {
      const pictureElement = cdnManager.generatePictureElement(mockMediaAsset, {
        alt: 'Test image',
        className: 'responsive-image',
        loading: 'lazy',
        sizes: '(max-width: 768px) 100vw, 50vw'
      });

      expect(pictureElement).toContain('<picture>');
      expect(pictureElement).toContain('type="image/avif"');
      expect(pictureElement).toContain('type="image/webp"');
      expect(pictureElement).toContain('type="image/jpeg"');
      expect(pictureElement).toContain('alt="Test image"');
      expect(pictureElement).toContain('class="responsive-image"');
      expect(pictureElement).toContain('loading="lazy"');
      expect(pictureElement).toContain('sizes="(max-width: 768px) 100vw, 50vw"');
    });

    it('should use default values when options not provided', () => {
      const pictureElement = cdnManager.generatePictureElement(mockMediaAsset, {
        alt: 'Test image'
      });

      expect(pictureElement).toContain('loading="lazy"');
      expect(pictureElement).toContain('sizes="100vw"');
      expect(pictureElement).toContain('class=""');
    });
  });

  describe('Preload links generation', () => {
    beforeEach(() => {
      cdnManager = createCDNManager({ provider: 'vercel' });
    });

    it('should generate preload links for critical images', () => {
      const preloadLinks = cdnManager.generatePreloadLinks([mockMediaAsset]);

      expect(preloadLinks).toHaveLength(2);
      expect(preloadLinks[0]).toContain('rel="preload"');
      expect(preloadLinks[0]).toContain('type="image/avif"');
      expect(preloadLinks[1]).toContain('type="image/webp"');
    });

    it('should handle multiple assets', () => {
      const secondAsset = { ...mockMediaAsset, id: '456', filename: 'second-image.jpg' };
      const preloadLinks = cdnManager.generatePreloadLinks([mockMediaAsset, secondAsset]);

      expect(preloadLinks).toHaveLength(4); // 2 links per asset
    });
  });

  describe('Cache purging', () => {
    it('should handle Cloudflare cache purging', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        statusText: 'OK'
      });

      const cdnManagerCF = createCDNManager({
        provider: 'cloudflare',
        apiKey: 'test-api-key',
        zoneId: 'test-zone-id'
      });

      await cdnManagerCF.purgeCacheUrls(['https://example.com/image1.jpg']);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/zones/test-zone-id/purge_cache',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ files: ['https://example.com/image1.jpg'] })
        })
      );
    });

    it('should throw error when Cloudflare credentials missing', async () => {
      const cdnManagerCF = createCDNManager({ provider: 'cloudflare' });

      await expect(cdnManagerCF.purgeCacheUrls(['https://example.com/image1.jpg']))
        .rejects.toThrow('Cloudflare API key and zone ID required for cache purging');
    });

    it('should handle Cloudflare API errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized'
      });

      const cdnManagerCF = createCDNManager({
        provider: 'cloudflare',
        apiKey: 'invalid-key',
        zoneId: 'test-zone-id'
      });

      await expect(cdnManagerCF.purgeCacheUrls(['https://example.com/image1.jpg']))
        .rejects.toThrow('Cloudflare cache purge failed: Unauthorized');

      consoleSpy.mockRestore();
    });

    it('should handle Vercel cache purging gracefully', async () => {
      const cdnManagerVercel = createCDNManager({ provider: 'vercel' });
      await expect(cdnManagerVercel.purgeCacheUrls(['https://example.com/image1.jpg']))
        .resolves.toBeUndefined();
    });

    it('should handle Netlify cache purging gracefully', async () => {
      const cdnManagerNetlify = createCDNManager({ provider: 'netlify' });
      await expect(cdnManagerNetlify.purgeCacheUrls(['https://example.com/image1.jpg']))
        .resolves.toBeUndefined();
    });
  });

  describe('CDN Analytics', () => {
    beforeEach(() => {
      cdnManager = createCDNManager({ provider: 'vercel' });
    });

    it('should return CDN analytics data', async () => {
      const analytics = await cdnManager.getCDNAnalytics('24h');

      expect(analytics).toHaveProperty('totalRequests');
      expect(analytics).toHaveProperty('cacheHitRate');
      expect(analytics).toHaveProperty('bandwidthSaved');
      expect(analytics).toHaveProperty('topFormats');
      expect(analytics).toHaveProperty('averageResponseTime');

      expect(analytics.cacheHitRate).toBeGreaterThan(0);
      expect(analytics.cacheHitRate).toBeLessThanOrEqual(1);
      expect(analytics.topFormats).toHaveProperty('webp');
    });

    it('should handle different time ranges', async () => {
      const analytics24h = await cdnManager.getCDNAnalytics('24h');
      const analytics7d = await cdnManager.getCDNAnalytics('7d');
      const analytics30d = await cdnManager.getCDNAnalytics('30d');

      expect(analytics24h).toBeDefined();
      expect(analytics7d).toBeDefined();
      expect(analytics30d).toBeDefined();
    });
  });

  describe('default provider detection', () => {
    beforeEach(() => {
      delete process.env.ASTRO_ADAPTER;
      delete process.env.NETLIFY;
      delete process.env.NETLIFY_IMAGES_CDN_DOMAIN;
      delete process.env.NETLIFY_LOCAL;
      delete process.env.SITE_ID;
      delete process.env.DEPLOY_ID;
      delete process.env.CONTEXT;
    });

    it('normalizes configured providers', () => {
      expect(normalizeCdnProvider('netlify')).toBe('netlify');
      expect(normalizeCdnProvider('VERCEL')).toBe('vercel');
      expect(normalizeCdnProvider('custom')).toBe('custom');
      expect(normalizeCdnProvider('')).toBeNull();
      expect(normalizeCdnProvider('unknown')).toBeNull();
    });

    it('defaults to Netlify when the adapter is forced to netlify', () => {
      process.env.ASTRO_ADAPTER = 'netlify';
      expect(detectDefaultCdnProvider()).toBe('netlify');
    });

    it('defaults to Netlify when Netlify runtime markers are present', () => {
      process.env.NETLIFY = 'true';
      expect(detectDefaultCdnProvider()).toBe('netlify');
    });

    it('defaults to Vercel when no Netlify markers are present', () => {
      expect(detectDefaultCdnProvider()).toBe('vercel');
    });
  });
});
