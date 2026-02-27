import { supabase, supabaseAdmin } from '../supabase.js';
import { getStorageBucketConfig } from '../storage/buckets.js';
import { MAX_MEDIA_UPLOAD_BYTES } from '../config/media.js';
import sharp from 'sharp';
import type { MediaAsset, MediaOptimizationResult } from '../types/index.js';

export type { MediaOptimizationResult } from '../types/index.js';

export interface MediaUploadOptions {
  file: File;
  altText?: string;
  caption?: string;
  uploadedBy?: string;
}

export interface MediaUsageStats {
  totalFiles: number;
  totalSize: number;
  formatDistribution: Record<string, number>;
  averageFileSize: number;
  optimizationSavings: number;
}

const STANDARD_DERIVATIVE_WIDTH = 1600;
const PUBLIC_FOLDER = 'uploads';
const ORIGINALS_FOLDER = 'originals';
export { MAX_MEDIA_UPLOAD_BYTES };

type OriginalMediaInfo = {
  filename: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  dimensions?: { width: number; height: number };
};

export class MediaManager {
  /**
   * Upload and process a media file
   */
  async uploadMedia(options: MediaUploadOptions): Promise<MediaOptimizationResult> {
    const { file, altText, caption, uploadedBy } = options;
    const bucketName = await this.getMediaBucketName();

    if (typeof file.size === 'number' && file.size > MAX_MEDIA_UPLOAD_BYTES) {
      throw new Error(`File is too large. Maximum upload size is ${Math.round(MAX_MEDIA_UPLOAD_BYTES / (1024 * 1024))}MB.`);
    }
    
    // Validate file type
    if (!this.isValidMediaType(file.type)) {
      throw new Error(`Unsupported file type: ${file.type}`);
    }
    
    const timestamp = Date.now();
    const normalizedAltText = this.normalizeAltText(altText, caption, file.name);
    const baseName = this.buildOptimizedBaseName(normalizedAltText, file.name, timestamp);

    const buffer = Buffer.from(await file.arrayBuffer());
    let publicBuffer = buffer;
    let publicMimeType = file.type;
    let totalSizeSavings = 0;
    const formatConversions: string[] = [];
    let originalInfo: OriginalMediaInfo | undefined;

    if (this.isImageType(file.type)) {
      const originalFilename = `${timestamp}-${this.sanitizeFilename(file.name)}`;
      const originalStoragePath = this.buildStoragePath(originalFilename, ORIGINALS_FOLDER);
      const originalDimensions = await this.getImageDimensions(buffer);

      await this.uploadBufferToStorage(buffer, originalStoragePath, file.type, bucketName);

      originalInfo = {
        filename: originalFilename,
        storagePath: originalStoragePath,
        mimeType: file.type,
        fileSize: buffer.length,
        dimensions: originalDimensions
      };

      if (this.shouldOptimizeImage(file.type)) {
        try {
          const optimized = await this.createOptimizedImageBuffer(buffer, file.type);
          publicBuffer = optimized.buffer;
          publicMimeType = optimized.mimeType;
          totalSizeSavings = Math.max(0, buffer.length - publicBuffer.length);
          if (publicMimeType !== file.type) {
            formatConversions.push(`${file.type} -> ${publicMimeType}`);
          }
        } catch (error) {
          console.warn('Failed to optimize image, using original for public asset:', error);
          publicBuffer = buffer;
          publicMimeType = file.type;
        }
      }
    }

    const publicFilename = `${baseName}.${this.getExtensionForMimeType(publicMimeType)}`;
    const publicAsset = await this.uploadToStorage(
      publicBuffer,
      publicFilename,
      publicMimeType,
      normalizedAltText,
      caption,
      uploadedBy,
      originalInfo,
      bucketName
    );

    return {
      original: publicAsset,
      public: publicAsset,
      standard: this.isImageType(file.type) ? publicAsset : undefined,
      optimized: this.isImageType(file.type) ? [publicAsset] : [],
      sizeSavings: totalSizeSavings,
      formatConversions
    };
  }
  
  /**
   * Upload file to Supabase Storage and save metadata to database
   */
  private async uploadToStorage(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    altText?: string,
    caption?: string,
    uploadedBy?: string,
    originalInfo?: OriginalMediaInfo,
    bucketName?: string
  ): Promise<MediaAsset> {
    const resolvedBucketName = bucketName || await this.getMediaBucketName();
    const storagePath = this.buildStoragePath(filename, PUBLIC_FOLDER);

    await this.uploadBufferToStorage(buffer, storagePath, mimeType, resolvedBucketName);

    const { data: urlData } = supabaseAdmin.storage
      .from(resolvedBucketName)
      .getPublicUrl(storagePath);
    
    // Get image dimensions if it's an image
    let dimensions: { width: number; height: number } | undefined;
    if (this.isImageType(mimeType)) {
      try {
        const metadata = await sharp(buffer).metadata();
        if (metadata.width && metadata.height) {
          dimensions = { width: metadata.width, height: metadata.height };
        }
      } catch (error) {
        console.warn('Failed to get image dimensions:', error);
      }
    }
    
    // Save metadata to database.
    // New schema expects JSONB for dimensions, but legacy installs may still use TEXT.
    const insertPayload = {
      filename,
      storage_path: storagePath,
      alt_text: altText,
      caption,
      mime_type: mimeType,
      file_size: buffer.length,
      dimensions: dimensions ?? null,
      uploaded_by: uploadedBy || null,
      original_filename: originalInfo?.filename || null,
      original_storage_path: originalInfo?.storagePath || null,
      original_mime_type: originalInfo?.mimeType || null,
      original_file_size: originalInfo?.fileSize || null,
      original_dimensions: originalInfo?.dimensions ?? null
    };

    let mediaData: any;
    try {
      mediaData = await this.insertMediaAssetRow(insertPayload);
    } catch (error) {
      // Clean up uploaded file if database insert fails
      await supabaseAdmin.storage.from(resolvedBucketName).remove([storagePath]);
      if (originalInfo?.storagePath) {
        await supabaseAdmin.storage.from(resolvedBucketName).remove([originalInfo.storagePath]);
      }
      throw error;
    }
    
    return {
      id: mediaData.id,
      filename: mediaData.filename,
      url: urlData.publicUrl,
      storagePath: mediaData.storage_path,
      altText: mediaData.alt_text,
      caption: mediaData.caption,
      mimeType: mediaData.mime_type,
      fileSize: mediaData.file_size,
      dimensions: this.parseDimensionsValue(mediaData.dimensions),
      originalFilename: mediaData.original_filename ?? undefined,
      originalStoragePath: mediaData.original_storage_path ?? undefined,
      originalMimeType: mediaData.original_mime_type ?? undefined,
      originalFileSize: mediaData.original_file_size ?? undefined,
      originalDimensions: this.parseDimensionsValue(mediaData.original_dimensions),
      createdAt: new Date(mediaData.created_at)
    };
  } 
 /**
   * Get media asset by ID
   */
  async getMediaAsset(id: string): Promise<MediaAsset | null> {
    const bucketName = await this.getMediaBucketName();
    const { data, error } = await supabase
      .from('media_assets')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.storage_path);
    
    return {
      id: data.id,
      filename: data.filename,
      url: urlData.publicUrl,
      storagePath: data.storage_path,
      altText: data.alt_text,
      caption: data.caption,
      mimeType: data.mime_type,
      fileSize: data.file_size,
      dimensions: this.parseDimensionsValue(data.dimensions),
      originalFilename: data.original_filename ?? undefined,
      originalStoragePath: data.original_storage_path ?? undefined,
      originalMimeType: data.original_mime_type ?? undefined,
      originalFileSize: data.original_file_size ?? undefined,
      originalDimensions: this.parseDimensionsValue(data.original_dimensions),
      createdAt: new Date(data.created_at)
    };
  }
  
  /**
   * List media assets with pagination and filtering
   */
  async listMediaAssets(options: {
    limit?: number;
    offset?: number;
    mimeType?: string;
    search?: string;
  } = {}): Promise<{ assets: MediaAsset[], total: number }> {
    const { limit = 20, offset = 0, mimeType, search } = options;
    const bucketName = await this.getMediaBucketName();
    
    let query = supabase
      .from('media_assets')
      .select('*', { count: 'exact' });
    
    if (mimeType) {
      query = query.like('mime_type', `${mimeType}%`);
    }
    
    if (search) {
      query = query.or(`filename.ilike.%${search}%,alt_text.ilike.%${search}%,caption.ilike.%${search}%`);
    }
    
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      throw new Error(`Failed to list media assets: ${error.message}`);
    }
    
    const assets = await Promise.all(
      (data || []).map(async (item) => {
        const { data: urlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(item.storage_path);
        
        return {
          id: item.id,
          filename: item.filename,
          url: urlData.publicUrl,
          storagePath: item.storage_path,
          altText: item.alt_text,
          caption: item.caption,
          mimeType: item.mime_type,
          fileSize: item.file_size,
          dimensions: this.parseDimensionsValue(item.dimensions),
          originalFilename: item.original_filename ?? undefined,
          originalStoragePath: item.original_storage_path ?? undefined,
          originalMimeType: item.original_mime_type ?? undefined,
          originalFileSize: item.original_file_size ?? undefined,
          originalDimensions: this.parseDimensionsValue(item.original_dimensions),
          createdAt: new Date(item.created_at)
        };
      })
    );
    
    return { assets, total: count || 0 };
  }
  
  /**
   * Update media asset metadata
   */
  async updateMediaAsset(
    id: string,
    updates: {
      altText?: string;
      caption?: string;
      filename?: string;
    }
  ): Promise<MediaAsset> {
    const bucketName = await this.getMediaBucketName();
    const { data, error } = await supabaseAdmin
      .from('media_assets')
      .update({
        alt_text: updates.altText,
        caption: updates.caption,
        filename: updates.filename
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update media asset: ${error.message}`);
    }
    
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.storage_path);
    
    return {
      id: data.id,
      filename: data.filename,
      url: urlData.publicUrl,
      storagePath: data.storage_path,
      altText: data.alt_text,
      caption: data.caption,
      mimeType: data.mime_type,
      fileSize: data.file_size,
      dimensions: this.parseDimensionsValue(data.dimensions),
      originalFilename: data.original_filename ?? undefined,
      originalStoragePath: data.original_storage_path ?? undefined,
      originalMimeType: data.original_mime_type ?? undefined,
      originalFileSize: data.original_file_size ?? undefined,
      originalDimensions: this.parseDimensionsValue(data.original_dimensions),
      createdAt: new Date(data.created_at)
    };
  }
  
  /**
   * Delete media asset
   */
  async deleteMediaAsset(id: string): Promise<void> {
    const bucketName = await this.getMediaBucketName();
    // Get asset info first
    const asset = await this.getMediaAsset(id);
    if (!asset) {
      throw new Error('Media asset not found');
    }
    
    // Delete from storage
    const { error: storageError } = await supabaseAdmin.storage
      .from(bucketName)
      .remove([asset.storagePath]);
    
    if (storageError) {
      console.warn('Failed to delete from storage:', storageError);
    }

    if (asset.originalStoragePath) {
      const { error: originalDeleteError } = await supabaseAdmin.storage
        .from(bucketName)
        .remove([asset.originalStoragePath]);

      if (originalDeleteError) {
        console.warn('Failed to delete original media from storage:', originalDeleteError);
      }
    }
    
    // Delete from database
    const { error: dbError } = await supabaseAdmin
      .from('media_assets')
      .delete()
      .eq('id', id);
    
    if (dbError) {
      throw new Error(`Failed to delete media asset: ${dbError.message}`);
    }
  }  /**

   * Bulk delete media assets
   */
  async bulkDeleteMediaAssets(ids: string[]): Promise<{ deleted: string[], failed: string[] }> {
    const deleted: string[] = [];
    const failed: string[] = [];
    
    for (const id of ids) {
      try {
        await this.deleteMediaAsset(id);
        deleted.push(id);
      } catch (error) {
        console.error(`Failed to delete media asset ${id}:`, error);
        failed.push(id);
      }
    }
    
    return { deleted, failed };
  }
  
  /**
   * Get media usage statistics
   */
  async getMediaUsageStats(): Promise<MediaUsageStats> {
    const { data, error } = await supabase
      .from('media_assets')
      .select('mime_type, file_size');
    
    if (error) {
      throw new Error(`Failed to get media stats: ${error.message}`);
    }
    
    const totalFiles = data.length;
    const totalSize = data.reduce((sum, item) => sum + item.file_size, 0);
    const formatDistribution: Record<string, number> = {};
    
    data.forEach(item => {
      const format = item.mime_type.split('/')[1] || 'unknown';
      formatDistribution[format] = (formatDistribution[format] || 0) + 1;
    });
    
    const averageFileSize = totalFiles > 0 ? totalSize / totalFiles : 0;
    
    // Calculate optimization savings (simplified estimation)
    const imageFiles = data.filter(item => item.mime_type.startsWith('image/'));
    const estimatedOriginalSize = imageFiles.reduce((sum, item) => sum + (item.file_size * 1.5), 0);
    const actualImageSize = imageFiles.reduce((sum, item) => sum + item.file_size, 0);
    const optimizationSavings = Math.max(0, estimatedOriginalSize - actualImageSize);
    
    return {
      totalFiles,
      totalSize,
      formatDistribution,
      averageFileSize,
      optimizationSavings
    };
  }
  
  /**
   * Generate AI-assisted alt text suggestions (placeholder implementation)
   */
  async generateAltTextSuggestion(mediaAsset: MediaAsset): Promise<string> {
    // This is a placeholder implementation
    // In a real application, you would integrate with an AI service like OpenAI Vision API
    
    if (!this.isImageType(mediaAsset.mimeType)) {
      return `${mediaAsset.filename} file`;
    }
    
    // Simple heuristic-based suggestions
    const filename = mediaAsset.filename.toLowerCase();
    
    if (filename.includes('screenshot')) {
      return 'Screenshot showing application interface';
    } else if (filename.includes('logo')) {
      return 'Company or brand logo';
    } else if (filename.includes('profile') || filename.includes('avatar')) {
      return 'Profile picture or avatar image';
    } else if (filename.includes('banner') || filename.includes('hero')) {
      return 'Banner or hero image';
    } else if (mediaAsset.dimensions) {
      const { width, height } = mediaAsset.dimensions;
      const aspectRatio = width / height;
      
      if (aspectRatio > 2) {
        return 'Wide landscape image';
      } else if (aspectRatio < 0.5) {
        return 'Tall portrait image';
      } else if (Math.abs(aspectRatio - 1) < 0.1) {
        return 'Square image';
      } else {
        return aspectRatio > 1 ? 'Landscape image' : 'Portrait image';
      }
    }
    
    return 'Image';
  }
  
  /**
   * Get optimization recommendations for media assets
   */
  async getOptimizationRecommendations(): Promise<{
    oversizedImages: MediaAsset[];
    unoptimizedFormats: MediaAsset[];
    missingAltText: MediaAsset[];
    totalPotentialSavings: number;
  }> {
    const bucketName = await this.getMediaBucketName();
    const { data, error } = await supabase
      .from('media_assets')
      .select('*');
    
    if (error) {
      throw new Error(`Failed to get media assets: ${error.message}`);
    }
    
    const oversizedImages: MediaAsset[] = [];
    const unoptimizedFormats: MediaAsset[] = [];
    const missingAltText: MediaAsset[] = [];
    let totalPotentialSavings = 0;
    
    for (const item of data) {
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(item.storage_path);
      
      const asset: MediaAsset = {
        id: item.id,
        filename: item.filename,
        url: urlData.publicUrl,
        storagePath: item.storage_path,
        altText: item.alt_text,
        caption: item.caption,
        mimeType: item.mime_type,
        fileSize: item.file_size,
        dimensions: this.parseDimensionsValue(item.dimensions),
        originalFilename: item.original_filename ?? undefined,
        originalStoragePath: item.original_storage_path ?? undefined,
        originalMimeType: item.original_mime_type ?? undefined,
        originalFileSize: item.original_file_size ?? undefined,
        originalDimensions: this.parseDimensionsValue(item.original_dimensions),
        createdAt: new Date(item.created_at)
      };
      
      // Check for oversized images (>2MB or >2000px width)
      if (this.isImageType(asset.mimeType)) {
        if (asset.fileSize > 2 * 1024 * 1024 || 
            (asset.dimensions && asset.dimensions.width > 2000)) {
          oversizedImages.push(asset);
          totalPotentialSavings += asset.fileSize * 0.3; // Estimate 30% savings
        }
        
        // Check for unoptimized formats
        if (!asset.mimeType.includes('webp') && !asset.mimeType.includes('avif')) {
          unoptimizedFormats.push(asset);
          totalPotentialSavings += asset.fileSize * 0.2; // Estimate 20% savings
        }
      }
      
      // Check for missing alt text
      if (!asset.altText || asset.altText.trim() === '') {
        missingAltText.push(asset);
      }
    }
    
    return {
      oversizedImages,
      unoptimizedFormats,
      missingAltText,
      totalPotentialSavings
    };
  }
  
  /**
   * Utility methods
   */
  private isValidMediaType(mimeType: string): boolean {
    const validTypes = [
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
    ];
    
    return validTypes.includes(mimeType);
  }
  
  private isImageType(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  private getExtensionForMimeType(mimeType: string): string {
    switch (mimeType) {
      case 'image/png':
        return 'png';
      case 'image/jpg':
      case 'image/jpeg':
        return 'jpg';
      case 'image/svg+xml':
        return 'svg';
      case 'image/webp':
        return 'webp';
      case 'image/avif':
        return 'avif';
      case 'image/gif':
        return 'gif';
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
        return 'bin';
    }
  }

  private getSharpFormat(mimeType: string): 'jpeg' | 'png' | 'webp' | 'avif' {
    switch (mimeType) {
      case 'image/png':
      case 'image/gif':
        return 'png';
      case 'image/webp':
        return 'webp';
      case 'image/avif':
        return 'avif';
      default:
        return 'jpeg';
    }
  }

  private getFormatOptions(mimeType: string): Record<string, any> {
    switch (mimeType) {
      case 'image/png':
      case 'image/gif':
        return { compressionLevel: 8 };
      case 'image/webp':
        return { quality: 80 };
      case 'image/avif':
        return { quality: 65 };
      default:
        return { quality: 85 };
    }
  }

  private buildStoragePath(filename: string, folder: string): string {
    return `${folder}/${filename}`;
  }

  private async uploadBufferToStorage(
    buffer: Buffer,
    storagePath: string,
    mimeType: string,
    bucketName: string
  ): Promise<void> {
    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }
  }

  private async getMediaBucketName(): Promise<string> {
    const config = await getStorageBucketConfig();
    return config.media;
  }

  private async getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number } | undefined> {
    try {
      const metadata = await sharp(buffer).metadata();
      if (metadata.width && metadata.height) {
        return { width: metadata.width, height: metadata.height };
      }
    } catch (error) {
      console.warn('Failed to get image dimensions:', error);
    }
    return undefined;
  }

  private shouldOptimizeImage(mimeType: string): boolean {
    return !['image/svg+xml', 'image/gif'].includes(mimeType);
  }

  private getOptimizedImageMimeType(original: string): string {
    if (original === 'image/webp' || original === 'image/avif') {
      return original;
    }
    if (original === 'image/png' || original === 'image/jpeg' || original === 'image/jpg') {
      return 'image/webp';
    }
    return original;
  }

  private async createOptimizedImageBuffer(
    buffer: Buffer,
    mimeType: string
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const targetMime = this.getOptimizedImageMimeType(mimeType);
    const sharpFormat = this.getSharpFormat(targetMime);
    const formatOptions = this.getFormatOptions(targetMime);

    const processedBuffer = await sharp(buffer)
      .resize(STANDARD_DERIVATIVE_WIDTH, STANDARD_DERIVATIVE_WIDTH, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toFormat(sharpFormat as any, formatOptions as any)
      .toBuffer();

    return { buffer: processedBuffer, mimeType: targetMime };
  }

  private normalizeAltText(altText: string | undefined, caption: string | undefined, filename: string): string {
    const candidate = (altText || caption || this.filenameToText(filename) || 'Uploaded media').trim();
    if (!candidate) {
      return 'Uploaded media';
    }
    return candidate.charAt(0).toUpperCase() + candidate.slice(1);
  }

  private filenameToText(filename: string): string {
    return filename
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private buildOptimizedBaseName(altText: string, filename: string, timestamp: number): string {
    const slugSource = altText || this.filenameToText(filename) || 'media';
    const slug = this.slugify(slugSource);
    return `${timestamp}-${slug || 'media'}`;
  }

  private parseDimensionsValue(value: unknown): { width: number; height: number } | undefined {
    if (!value) return undefined;

    let parsed = value as any;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return undefined;
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      return undefined;
    }

    const width = Number((parsed as any).width);
    const height = Number((parsed as any).height);

    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      return undefined;
    }

    return { width, height };
  }

  private normalizeDimensionsForLegacyColumn(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }

  private isDimensionsColumnTypeError(message: string): boolean {
    const normalized = message.toLowerCase();
    return normalized.includes('dimensions')
      && normalized.includes('type')
      && (
        normalized.includes('json')
        || normalized.includes('jsonb')
        || normalized.includes('text')
      );
  }

  private extractMissingColumnName(message: string): string | null {
    const quotedMatch = message.match(/'([^']+)' column/i);
    if (quotedMatch?.[1]) return quotedMatch[1];

    const postgresMatch = message.match(/column\s+"([^"]+)"\s+of\s+relation/i);
    if (postgresMatch?.[1]) return postgresMatch[1];

    return null;
  }

  private isOptionalOriginalColumn(columnName: string): boolean {
    return [
      'original_filename',
      'original_storage_path',
      'original_mime_type',
      'original_file_size',
      'original_dimensions'
    ].includes(columnName);
  }

  private async insertMediaAssetRow(payload: Record<string, any>): Promise<any> {
    let workingPayload: Record<string, any> = { ...payload };
    let usedLegacyDimensionsFallback = false;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const result = await supabaseAdmin
        .from('media_assets')
        .insert(workingPayload)
        .select()
        .single();

      if (!result.error) {
        return result.data;
      }

      const message = String(result.error.message || '');
      const missingColumn = this.extractMissingColumnName(message);

      if (missingColumn && this.isOptionalOriginalColumn(missingColumn) && Object.prototype.hasOwnProperty.call(workingPayload, missingColumn)) {
        const { [missingColumn]: _removed, ...remainingPayload } = workingPayload;
        workingPayload = remainingPayload;
        continue;
      }

      if (!usedLegacyDimensionsFallback && this.isDimensionsColumnTypeError(message)) {
        workingPayload = {
          ...workingPayload,
          dimensions: this.normalizeDimensionsForLegacyColumn(workingPayload.dimensions),
          original_dimensions: this.normalizeDimensionsForLegacyColumn(workingPayload.original_dimensions)
        };
        usedLegacyDimensionsFallback = true;
        continue;
      }

      throw new Error(`Database insert failed: ${message}`);
    }

    throw new Error('Database insert failed: exceeded retry attempts.');
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  }

  private slugify(value: string): string {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const trimmed = slug.slice(0, 80);
    return trimmed.replace(/-+$/g, '');
  }
}

// Export singleton instance
export const mediaManager = new MediaManager();
