import sharp from 'sharp';
import { mediaManager } from '../media-manager.js';
import { cdnManager } from '../cdn-manager.js';
import type {
  CDNOptimizedUrls,
  ImageAnalysisResult,
  MediaMigrationSettings,
  MediaOptimizationResult,
  OptimizedMediaVersion,
  OptimizationSuggestion,
  ResizingRecommendation
} from './types.js';

const MEDIA_FETCH_TIMEOUT_MS = 15000;

export class MediaFetchError extends Error {
  status?: number;
  code?: 'not_found' | 'timeout' | 'http_error';

  constructor(message: string, status?: number, code?: 'not_found' | 'timeout' | 'http_error') {
    super(message);
    this.name = 'MediaFetchError';
    this.status = status;
    this.code = code;
  }
}

export const fetchWithTimeout = async (url: string, timeoutMs = MEDIA_FETCH_TIMEOUT_MS): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new MediaFetchError(`Timed out fetching media: ${url}`, undefined, 'timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

// Image analysis service for advanced media optimization
export class ImageAnalysisService {
  /**
   * Analyze image and detect optimization opportunities
   */
  async analyzeImage(buffer: Buffer, filename: string): Promise<ImageAnalysisResult> {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const stats = await image.stats();

    const analysis: ImageAnalysisResult = {
      filename,
      originalSize: buffer.length,
      dimensions: {
        width: metadata.width || 0,
        height: metadata.height || 0
      },
      format: metadata.format || 'unknown',
      quality: this.estimateQuality(stats),
      isOversized: this.isOversized(metadata, buffer.length),
      recommendedOptimizations: [],
      potentialSavings: 0
    };

    // Analyze for size optimization
    if (analysis.isOversized) {
      const sizeRecommendation = this.analyzeSizeOptimization(metadata, buffer.length);
      analysis.recommendedOptimizations.push(sizeRecommendation);
      analysis.potentialSavings += sizeRecommendation.estimatedSavings;
    }

    // Analyze for format optimization
    const formatRecommendation = this.analyzeFormatOptimization(metadata, buffer.length);
    if (formatRecommendation) {
      analysis.recommendedOptimizations.push(formatRecommendation);
      analysis.potentialSavings += formatRecommendation.estimatedSavings;
    }

    // Analyze for quality optimization
    const qualityRecommendation = this.analyzeQualityOptimization(analysis.quality, buffer.length);
    if (qualityRecommendation) {
      analysis.recommendedOptimizations.push(qualityRecommendation);
      analysis.potentialSavings += qualityRecommendation.estimatedSavings;
    }

    return analysis;
  }

  /**
   * Detect oversized images based on dimensions and file size
   */
  private isOversized(metadata: sharp.Metadata, fileSize: number): boolean {
    const maxWidth = 2000;
    const maxHeight = 2000;
    const maxFileSize = 2 * 1024 * 1024; // 2MB

    return (
      (metadata.width && metadata.width > maxWidth) ||
      (metadata.height && metadata.height > maxHeight) ||
      fileSize > maxFileSize
    );
  }

  /**
   * Estimate image quality based on file size and dimensions
   */
  private estimateQuality(stats: sharp.Stats): number {
    // Simplified quality estimation based on entropy and file characteristics
    const entropy = stats.entropy || 0;

    // Higher entropy typically indicates higher quality/detail
    if (entropy > 7) return 95;
    if (entropy > 6) return 85;
    if (entropy > 5) return 75;
    if (entropy > 4) return 65;
    return 55;
  }

  /**
   * Analyze size optimization opportunities
   */
  private analyzeSizeOptimization(metadata: sharp.Metadata, fileSize: number): OptimizationSuggestion {
    const maxRecommendedWidth = 1920;
    const maxRecommendedHeight = 1080;

    let estimatedSavings = 0;
    let recommendation = '';

    if (metadata.width && metadata.width > maxRecommendedWidth) {
      const scaleFactor = maxRecommendedWidth / metadata.width;
      estimatedSavings = fileSize * (1 - scaleFactor * scaleFactor);
      recommendation = `Resize from ${metadata.width}x${metadata.height} to ${maxRecommendedWidth}x${Math.round((metadata.height || 0) * scaleFactor)}`;
    } else if (fileSize > 1024 * 1024) {
      estimatedSavings = fileSize * 0.3;
      recommendation = 'Optimize compression to reduce file size';
    }

    return {
      type: 'size',
      severity: estimatedSavings > 500 * 1024 ? 'high' : 'medium',
      message: recommendation,
      estimatedSavings
    };
  }

  /**
   * Analyze format optimization opportunities
   */
  private analyzeFormatOptimization(metadata: sharp.Metadata, fileSize: number): OptimizationSuggestion | null {
    const format = metadata.format;

    if (format === 'png' && !metadata.hasAlpha) {
      return {
        type: 'format',
        severity: 'medium',
        message: 'Convert PNG to JPEG (no transparency detected)',
        estimatedSavings: fileSize * 0.4
      };
    }

    if (format === 'jpeg' || format === 'png') {
      return {
        type: 'format',
        severity: 'low',
        message: 'Convert to WebP/AVIF for better compression',
        estimatedSavings: fileSize * 0.25
      };
    }

    return null;
  }

  /**
   * Analyze quality optimization opportunities
   */
  private analyzeQualityOptimization(estimatedQuality: number, fileSize: number): OptimizationSuggestion | null {
    if (estimatedQuality > 90 && fileSize > 500 * 1024) {
      return {
        type: 'quality',
        severity: 'low',
        message: 'Reduce quality from 90+ to 85 for web optimization',
        estimatedSavings: fileSize * 0.15
      };
    }

    return null;
  }

  /**
   * Generate intelligent resizing recommendations based on usage context
   */
  generateContextualSizes(
    originalDimensions: { width: number; height: number },
    usageContext: 'featured' | 'inline' | 'thumbnail' | 'gallery'
  ): ResizingRecommendation[] {
    const { width, height } = originalDimensions;
    const aspectRatio = width / height;

    const recommendations: ResizingRecommendation[] = [];

    switch (usageContext) {
      case 'featured':
        recommendations.push(
          { width: 1200, height: Math.round(1200 / aspectRatio), purpose: 'Desktop featured image' },
          { width: 800, height: Math.round(800 / aspectRatio), purpose: 'Tablet featured image' },
          { width: 400, height: Math.round(400 / aspectRatio), purpose: 'Mobile featured image' }
        );
        break;
      case 'inline':
        recommendations.push(
          { width: 800, height: Math.round(800 / aspectRatio), purpose: 'Desktop inline image' },
          { width: 600, height: Math.round(600 / aspectRatio), purpose: 'Tablet inline image' },
          { width: 400, height: Math.round(400 / aspectRatio), purpose: 'Mobile inline image' }
        );
        break;
      case 'thumbnail':
        recommendations.push(
          { width: 300, height: 300, purpose: 'Large thumbnail' },
          { width: 150, height: 150, purpose: 'Standard thumbnail' },
          { width: 75, height: 75, purpose: 'Small thumbnail' }
        );
        break;
      case 'gallery':
        recommendations.push(
          { width: 600, height: Math.round(600 / aspectRatio), purpose: 'Gallery preview' },
          { width: 300, height: Math.round(300 / aspectRatio), purpose: 'Gallery thumbnail' }
        );
        break;
    }

    return recommendations.filter(rec => rec.width < width || rec.height < height);
  }
}

/**
 * Advanced Media Optimizer for WordPress Migration
 */
export class AdvancedMediaOptimizer {
  private imageAnalyzer: ImageAnalysisService;

  constructor() {
    this.imageAnalyzer = new ImageAnalysisService();
  }

  async optimizeMediaDuringMigration(
    mediaUrl: string,
    filename: string,
    usageContext: 'featured' | 'inline' | 'thumbnail' | 'gallery' = 'inline',
    settings: MediaMigrationSettings = {}
  ): Promise<MediaOptimizationResult> {
    try {
      const response = await fetchWithTimeout(mediaUrl);
      if (!response.ok) {
        const code = response.status === 404 || response.status === 410 ? 'not_found' : 'http_error';
        throw new MediaFetchError(`Failed to download media: ${response.status} ${response.statusText}`, response.status, code);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const analysis = await this.imageAnalyzer.analyzeImage(buffer, filename);
      const { optimizeImages = true, altText, caption } = settings;
      const shouldOptimize = optimizeImages !== false;

      const optimizedVersions: OptimizedMediaVersion[] = [];
      let totalSizeSavings = 0;

      const optimizedOriginal = await this.createOptimizedVersion(
        buffer,
        filename,
        'original',
        shouldOptimize ? analysis.recommendedOptimizations : [],
        altText,
        caption
      );
      optimizedVersions.push(optimizedOriginal);
      if (shouldOptimize) {
        totalSizeSavings = Math.max(0, analysis.originalSize - optimizedOriginal.fileSize);
      }

      const cdnUrls = this.generateCDNOptimizedUrls(optimizedVersions);
      const primaryVersion = optimizedVersions.find((version) => version.variant === 'original') || optimizedVersions[0];
      const primaryUrl = cdnUrls.original || primaryVersion?.url || mediaUrl;

      return {
        originalUrl: mediaUrl,
        originalSize: analysis.originalSize,
        optimizedVersions,
        cdnUrls,
        totalSizeSavings,
        sizeSavingsPercentage: (totalSizeSavings / analysis.originalSize) * 100,
        analysis,
        recommendations: this.generateOptimizationRecommendations(analysis),
        primaryAssetId: primaryVersion?.assetId,
        primaryUrl
      };
    } catch (error) {
      if (error instanceof MediaFetchError) {
        throw error;
      }
      throw new Error(`Media optimization failed for ${filename}: ${error.message}`);
    }
  }

  private async createOptimizedVersion(
    buffer: Buffer,
    filename: string,
    variant: string,
    optimizations: OptimizationSuggestion[],
    altText?: string,
    caption?: string
  ): Promise<OptimizedMediaVersion> {
    let processedBuffer = buffer;
    const image = sharp(buffer);

    const sizeOpt = optimizations.find(opt => opt.type === 'size');
    if (sizeOpt) {
      processedBuffer = await image
        .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
        .toBuffer();
    }

    const qualityOpt = optimizations.find(opt => opt.type === 'quality');
    if (qualityOpt) {
      const qualityImage = sharp(processedBuffer);
      processedBuffer = await qualityImage
        .jpeg({ quality: 85 })
        .toBuffer();
    }

    const optimizedFilename = `${variant}-${filename}`;
    const uploadResult = await mediaManager.uploadMedia({
      file: new File([processedBuffer], optimizedFilename, { type: 'image/jpeg' }),
      altText,
      caption
    });
    const primaryAsset = uploadResult.public ?? uploadResult.original;

    return {
      variant,
      filename: optimizedFilename,
      url: primaryAsset.url,
      assetId: primaryAsset.id,
      fileSize: processedBuffer.length,
      dimensions: await this.getImageDimensions(processedBuffer),
      format: 'jpeg',
      purpose: 'Optimized original'
    };
  }

  private async createResizedVersion(
    buffer: Buffer,
    filename: string,
    sizeRec: ResizingRecommendation,
    altText?: string,
    caption?: string
  ): Promise<OptimizedMediaVersion> {
    const image = sharp(buffer);
    const resizedBuffer = await image
      .resize(sizeRec.width, sizeRec.height, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const resizedFilename = `${sizeRec.width}x${sizeRec.height}-${filename}`;
    const uploadResult = await mediaManager.uploadMedia({
      file: new File([resizedBuffer], resizedFilename, { type: 'image/jpeg' }),
      altText,
      caption
    });
    const primaryAsset = uploadResult.public ?? uploadResult.original;

    return {
      variant: `${sizeRec.width}x${sizeRec.height}`,
      filename: resizedFilename,
      url: primaryAsset.url,
      assetId: primaryAsset.id,
      fileSize: resizedBuffer.length,
      dimensions: { width: sizeRec.width, height: sizeRec.height },
      format: 'jpeg',
      purpose: sizeRec.purpose
    };
  }

  private async createModernFormatVersions(
    buffer: Buffer,
    filename: string,
    altText?: string,
    caption?: string
  ): Promise<OptimizedMediaVersion[]> {
    const versions: OptimizedMediaVersion[] = [];
    const image = sharp(buffer);

    try {
      const webpBuffer = await image.webp({ quality: 85 }).toBuffer();
      const webpFilename = filename.replace(/\.[^.]+$/, '.webp');
      const webpUpload = await mediaManager.uploadMedia({
        file: new File([webpBuffer], webpFilename, { type: 'image/webp' }),
        altText,
        caption
      });
      const webpAsset = webpUpload.public ?? webpUpload.original;

      versions.push({
        variant: 'webp',
        filename: webpFilename,
        url: webpAsset.url,
        assetId: webpAsset.id,
        fileSize: webpBuffer.length,
        dimensions: await this.getImageDimensions(webpBuffer),
        format: 'webp',
        purpose: 'Modern format optimization'
      });
    } catch (error) {
      console.warn('WebP conversion failed:', error);
    }

    try {
      const avifBuffer = await image.avif({ quality: 65 }).toBuffer();
      const avifFilename = filename.replace(/\.[^.]+$/, '.avif');
      const avifUpload = await mediaManager.uploadMedia({
        file: new File([avifBuffer], avifFilename, { type: 'image/avif' }),
        altText,
        caption
      });
      const avifAsset = avifUpload.public ?? avifUpload.original;

      versions.push({
        variant: 'avif',
        filename: avifFilename,
        url: avifAsset.url,
        assetId: avifAsset.id,
        fileSize: avifBuffer.length,
        dimensions: await this.getImageDimensions(avifBuffer),
        format: 'avif',
        purpose: 'Next-gen format optimization'
      });
    } catch (error) {
      console.warn('AVIF conversion failed:', error);
    }

    return versions;
  }

  private generateCDNOptimizedUrls(versions: OptimizedMediaVersion[]): CDNOptimizedUrls {
    const urls: CDNOptimizedUrls = {
      original: '',
      responsive: {},
      modernFormats: {}
    };

    for (const version of versions) {
      if (version.variant === 'original') {
        urls.original = cdnManager.generateOptimizedUrl(
          { url: version.url } as any,
          { quality: 90 }
        );
      } else if (version.variant.includes('x')) {
        urls.responsive[version.variant] = cdnManager.generateOptimizedUrl(
          { url: version.url } as any,
          { quality: 85 }
        );
      } else if (version.format === 'webp' || version.format === 'avif') {
        urls.modernFormats[version.format] = cdnManager.generateOptimizedUrl(
          { url: version.url } as any,
          { quality: version.format === 'avif' ? 65 : 85 }
        );
      }
    }

    return urls;
  }

  private generateOptimizationRecommendations(analysis: ImageAnalysisResult): string[] {
    const recommendations: string[] = [];

    if (analysis.isOversized) {
      recommendations.push(`Image is oversized (${analysis.dimensions.width}x${analysis.dimensions.height}). Consider resizing for web use.`);
    }

    if (analysis.potentialSavings > 100 * 1024) {
      recommendations.push(`Potential file size savings: ${Math.round(analysis.potentialSavings / 1024)}KB (${Math.round((analysis.potentialSavings / analysis.originalSize) * 100)}%)`);
    }

    for (const opt of analysis.recommendedOptimizations) {
      recommendations.push(`${opt.type.toUpperCase()}: ${opt.message}`);
    }

    return recommendations;
  }

  private async getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0
    };
  }
}
