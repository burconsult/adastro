import type { MediaAsset } from '../types/index.js';

export interface CDNConfig {
  provider: 'vercel' | 'cloudflare' | 'custom';
  baseUrl?: string;
  apiKey?: string;
  zoneId?: string;
}

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

export interface CDNAnalytics {
  totalRequests: number;
  cacheHitRate: number;
  bandwidthSaved: number;
  topFormats: Record<string, number>;
  averageResponseTime: number;
}

export class CDNManager {
  private config: CDNConfig;

  constructor(config: CDNConfig) {
    this.config = config;
  }

  /**
   * Generate optimized CDN URL for media asset
   */
  generateOptimizedUrl(
    mediaAsset: MediaAsset, 
    options: ImageTransformOptions = {}
  ): string {
    const baseUrl = mediaAsset.url;

    switch (this.config.provider) {
      case 'vercel':
        return this.generateVercelUrl(baseUrl, options);
      case 'cloudflare':
        return this.generateCloudflareUrl(baseUrl, options);
      case 'custom':
        return this.generateCustomUrl(baseUrl, options);
      default:
        return baseUrl;
    }
  }

  /**
   * Generate responsive image URLs for different screen sizes
   */
  generateResponsiveUrls(mediaAsset: MediaAsset): {
    thumbnail: string;
    small: string;
    medium: string;
    large: string;
    xlarge: string;
  } {
    return {
      thumbnail: this.generateOptimizedUrl(mediaAsset, { width: 150, height: 150, fit: 'cover' }),
      small: this.generateOptimizedUrl(mediaAsset, { width: 400, quality: 85 }),
      medium: this.generateOptimizedUrl(mediaAsset, { width: 800, quality: 85 }),
      large: this.generateOptimizedUrl(mediaAsset, { width: 1200, quality: 90 }),
      xlarge: this.generateOptimizedUrl(mediaAsset, { width: 1920, quality: 90 })
    };
  }

  /**
   * Generate picture element with multiple sources
   */
  generatePictureElement(
    mediaAsset: MediaAsset,
    options: {
      alt: string;
      className?: string;
      loading?: 'lazy' | 'eager';
      sizes?: string;
    }
  ): string {
    const { alt, className = '', loading = 'lazy', sizes = '100vw' } = options;
    
    const responsiveUrls = this.generateResponsiveUrls(mediaAsset);
    
    // Generate AVIF sources
    const avifSources = Object.entries(responsiveUrls)
      .map(([size, url]) => {
        const avifUrl = this.generateOptimizedUrl(mediaAsset, { 
          ...this.getSizeOptions(size), 
          format: 'avif' 
        });
        return `${avifUrl} ${this.getSizeOptions(size).width}w`;
      })
      .join(', ');

    // Generate WebP sources
    const webpSources = Object.entries(responsiveUrls)
      .map(([size, url]) => {
        const webpUrl = this.generateOptimizedUrl(mediaAsset, { 
          ...this.getSizeOptions(size), 
          format: 'webp' 
        });
        return `${webpUrl} ${this.getSizeOptions(size).width}w`;
      })
      .join(', ');

    // Generate JPEG fallback sources
    const jpegSources = Object.entries(responsiveUrls)
      .map(([size, url]) => {
        const jpegUrl = this.generateOptimizedUrl(mediaAsset, { 
          ...this.getSizeOptions(size), 
          format: 'jpeg' 
        });
        return `${jpegUrl} ${this.getSizeOptions(size).width}w`;
      })
      .join(', ');

    return `
      <picture>
        <source type="image/avif" srcset="${avifSources}" sizes="${sizes}">
        <source type="image/webp" srcset="${webpSources}" sizes="${sizes}">
        <source type="image/jpeg" srcset="${jpegSources}" sizes="${sizes}">
        <img 
          src="${responsiveUrls.medium}" 
          alt="${alt}" 
          class="${className}"
          loading="${loading}"
          sizes="${sizes}"
        >
      </picture>
    `.trim();
  }

  /**
   * Preload critical images
   */
  generatePreloadLinks(mediaAssets: MediaAsset[]): string[] {
    return mediaAssets.map(asset => {
      const webpUrl = this.generateOptimizedUrl(asset, { format: 'webp', quality: 85 });
      const avifUrl = this.generateOptimizedUrl(asset, { format: 'avif', quality: 75 });
      
      return [
        `<link rel="preload" as="image" href="${avifUrl}" type="image/avif">`,
        `<link rel="preload" as="image" href="${webpUrl}" type="image/webp">`
      ];
    }).flat();
  }

  /**
   * Purge CDN cache for specific URLs
   */
  async purgeCacheUrls(urls: string[]): Promise<void> {
    switch (this.config.provider) {
      case 'cloudflare':
        await this.purgeCloudflareCache(urls);
        break;
      case 'vercel':
        // Vercel doesn't have a direct cache purge API for images
        break;
      case 'custom':
        await this.purgeCustomCache(urls);
        break;
    }
  }

  /**
   * Get CDN analytics (placeholder implementation)
   */
  async getCDNAnalytics(timeRange: '24h' | '7d' | '30d' = '24h'): Promise<CDNAnalytics> {
    // This would integrate with actual CDN analytics APIs
    return {
      totalRequests: 10000,
      cacheHitRate: 0.95,
      bandwidthSaved: 500 * 1024 * 1024, // 500MB
      topFormats: {
        'webp': 60,
        'avif': 25,
        'jpeg': 15
      },
      averageResponseTime: 150
    };
  }

  /**
   * Generate Vercel-optimized URL
   */
  private generateVercelUrl(baseUrl: string, options: ImageTransformOptions): string {
    const params = new URLSearchParams();
    
    if (options.width) params.set('w', options.width.toString());
    if (options.height) params.set('h', options.height.toString());
    if (options.quality) params.set('q', options.quality.toString());
    if (options.format) params.set('f', options.format);
    if (options.fit) params.set('fit', options.fit);

    const queryString = params.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }

  /**
   * Generate Cloudflare-optimized URL
   */
  private generateCloudflareUrl(baseUrl: string, options: ImageTransformOptions): string {
    // Cloudflare Images URL format
    const params = [];
    
    if (options.width) params.push(`w=${options.width}`);
    if (options.height) params.push(`h=${options.height}`);
    if (options.quality) params.push(`q=${options.quality}`);
    if (options.format) params.push(`f=${options.format}`);
    if (options.fit) params.push(`fit=${options.fit}`);

    const transformString = params.join(',');
    
    if (this.config.baseUrl && transformString) {
      // Use Cloudflare Images transform URL
      return `${this.config.baseUrl}/cdn-cgi/image/${transformString}/${baseUrl}`;
    }
    
    return baseUrl;
  }

  /**
   * Generate custom CDN URL
   */
  private generateCustomUrl(baseUrl: string, options: ImageTransformOptions): string {
    // Implement custom CDN URL generation based on your CDN provider
    const params = new URLSearchParams();
    
    if (options.width) params.set('width', options.width.toString());
    if (options.height) params.set('height', options.height.toString());
    if (options.quality) params.set('quality', options.quality.toString());
    if (options.format) params.set('format', options.format);

    const queryString = params.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }

  /**
   * Get size options for responsive breakpoints
   */
  private getSizeOptions(size: string): ImageTransformOptions {
    const sizeMap: Record<string, ImageTransformOptions> = {
      thumbnail: { width: 150, height: 150 },
      small: { width: 400 },
      medium: { width: 800 },
      large: { width: 1200 },
      xlarge: { width: 1920 }
    };

    return sizeMap[size] || { width: 800 };
  }

  /**
   * Purge Cloudflare cache
   */
  private async purgeCloudflareCache(urls: string[]): Promise<void> {
    if (!this.config.apiKey || !this.config.zoneId) {
      throw new Error('Cloudflare API key and zone ID required for cache purging');
    }

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.config.zoneId}/purge_cache`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ files: urls })
        }
      );

      if (!response.ok) {
        throw new Error(`Cloudflare cache purge failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to purge Cloudflare cache:', error);
      throw error;
    }
  }

  /**
   * Purge custom CDN cache
   */
  private async purgeCustomCache(urls: string[]): Promise<void> {
    // Implement custom CDN cache purging logic
    void urls;
  }
}

// Export factory function for different CDN providers
export function createCDNManager(config: CDNConfig): CDNManager {
  return new CDNManager(config);
}

const envProvider = (process.env.IMAGE_CDN_PROVIDER as CDNConfig['provider']) || 'vercel';
const envBaseUrl = process.env.IMAGE_CDN_BASE_URL;
const envApiKey = process.env.IMAGE_CDN_API_KEY;
const envZoneId = process.env.IMAGE_CDN_ZONE_ID;

export const cdnManager = createCDNManager({
  provider: envProvider,
  baseUrl: envBaseUrl,
  apiKey: envApiKey,
  zoneId: envZoneId
});
