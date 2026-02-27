import { supabase, supabaseAdmin } from '../../supabase.js';
import { getStorageBucketConfig } from '../../storage/buckets.js';
import type { MediaAsset } from '../../types/index.js';
import type { Database } from '../../supabase.js';

export interface MediaAssetFilters {
  mimeType?: string;
  search?: string;
  limit?: number;
  offset?: number;
  uploadedBy?: string;
}

export class MediaRepository {
  constructor(private readonly useAdmin = false) {}

  private selectColumns(): string {
    return this.useAdmin
      ? '*'
      : 'id,filename,storage_path,alt_text,caption,mime_type,file_size,dimensions,created_at';
  }

  protected get supabase() {
    return this.useAdmin ? supabaseAdmin : supabase;
  }

  protected get supabaseAdmin() {
    return supabaseAdmin;
  }
  /**
   * Create a new media asset record
   */
  async create(mediaData: {
    filename: string;
    storagePath: string;
    altText?: string;
    caption?: string;
    mimeType: string;
    fileSize: number;
    dimensions?: { width: number; height: number };
    originalFilename?: string;
    originalStoragePath?: string;
    originalMimeType?: string;
    originalFileSize?: number;
    originalDimensions?: { width: number; height: number };
  }): Promise<MediaAsset> {
    const { data, error } = await this.supabaseAdmin
      .from('media_assets')
      .insert({
        filename: mediaData.filename,
        storage_path: mediaData.storagePath,
        alt_text: mediaData.altText,
        caption: mediaData.caption,
        mime_type: mediaData.mimeType,
        file_size: mediaData.fileSize,
        dimensions: mediaData.dimensions ? JSON.stringify(mediaData.dimensions) : null,
        original_filename: mediaData.originalFilename,
        original_storage_path: mediaData.originalStoragePath,
        original_mime_type: mediaData.originalMimeType,
        original_file_size: mediaData.originalFileSize,
        original_dimensions: mediaData.originalDimensions ? JSON.stringify(mediaData.originalDimensions) : null
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create media asset: ${error.message}`);
    }

    return this.mapToMediaAsset(data);
  }

  /**
   * Get media asset by ID
   */
  async findById(id: string): Promise<MediaAsset | null> {
    const { data, error } = await this.supabase
      .from('media_assets')
      .select(this.selectColumns())
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToMediaAsset(data);
  }

  /**
   * List media assets with filtering and pagination
   */
  async findMany(filters: MediaAssetFilters = {}): Promise<{ assets: MediaAsset[], total: number }> {
    const { limit = 20, offset = 0, mimeType, search, uploadedBy } = filters;

    let query = this.supabase
      .from('media_assets')
      .select(this.selectColumns(), { count: 'exact' });

    if (mimeType) {
      query = query.like('mime_type', `${mimeType}%`);
    }

    if (search) {
      query = query.or(`filename.ilike.%${search}%,alt_text.ilike.%${search}%,caption.ilike.%${search}%`);
    }

    if (uploadedBy) {
      query = query.eq('uploaded_by', uploadedBy);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to list media assets: ${error.message}`);
    }

    const assets = await Promise.all((data || []).map(item => this.mapToMediaAsset(item)));

    return { assets, total: count || 0 };
  }

  async findAll(limit = 20, offset = 0): Promise<MediaAsset[]> {
    const { assets } = await this.findMany({ limit, offset });
    return assets;
  }

  /**
   * Update media asset metadata
   */
  async update(id: string, updates: {
    altText?: string;
    caption?: string;
    filename?: string;
  }): Promise<MediaAsset> {
    const { data, error } = await this.supabaseAdmin
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

    return this.mapToMediaAsset(data);
  }

  /**
   * Delete media asset record
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.supabaseAdmin
      .from('media_assets')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete media asset: ${error.message}`);
    }
  }

  /**
   * Get media usage statistics
   */
  async getUsageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    formatDistribution: Record<string, number>;
    averageFileSize: number;
  }> {
    const { data, error } = await this.supabase
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

    return {
      totalFiles,
      totalSize,
      formatDistribution,
      averageFileSize
    };
  }

  /**
   * Find media assets that need optimization
   */
  async findOptimizationCandidates(): Promise<{
    oversized: MediaAsset[];
    unoptimizedFormats: MediaAsset[];
    missingAltText: MediaAsset[];
  }> {
    const { data, error } = await this.supabase
      .from('media_assets')
      .select(this.selectColumns());

    if (error) {
      throw new Error(`Failed to get media assets: ${error.message}`);
    }

    const oversized: MediaAsset[] = [];
    const unoptimizedFormats: MediaAsset[] = [];
    const missingAltText: MediaAsset[] = [];

    for (const item of data) {
      const asset = await this.mapToMediaAsset(item);

      // Check for oversized images (>2MB or >2000px width)
      if (asset.mimeType.startsWith('image/')) {
        if (asset.fileSize > 2 * 1024 * 1024 || 
            (asset.dimensions && asset.dimensions.width > 2000)) {
          oversized.push(asset);
        }

        // Check for unoptimized formats
        if (!asset.mimeType.includes('webp') && !asset.mimeType.includes('avif')) {
          unoptimizedFormats.push(asset);
        }
      }

      // Check for missing alt text
      if (!asset.altText || asset.altText.trim() === '') {
        missingAltText.push(asset);
      }
    }

    return {
      oversized,
      unoptimizedFormats,
      missingAltText
    };
  }

  /**
   * Map database row to MediaAsset interface
   */
  private async mapToMediaAsset(data: Database['public']['Tables']['media_assets']['Row']): Promise<MediaAsset> {
    const storagePath = typeof data.storage_path === 'string' ? data.storage_path : '';
    const isDirectPath = storagePath.startsWith('/') || storagePath.startsWith('http://') || storagePath.startsWith('https://');
    let url = storagePath;
    if (!isDirectPath) {
      const bucketName = await this.getMediaBucketName();
      const { data: urlData } = this.supabase.storage
        .from(bucketName)
        .getPublicUrl(storagePath);
      url = urlData.publicUrl;
    }

    return {
      id: data.id,
      filename: data.filename,
      url,
      storagePath,
      altText: data.alt_text,
      caption: data.caption,
      mimeType: data.mime_type,
      fileSize: data.file_size,
      dimensions: this.parseDimensions(data.dimensions),
      originalFilename: data.original_filename ?? undefined,
      originalStoragePath: data.original_storage_path ?? undefined,
      originalMimeType: data.original_mime_type ?? undefined,
      originalFileSize: data.original_file_size ?? undefined,
      originalDimensions: this.parseDimensions(data.original_dimensions),
      createdAt: new Date(data.created_at)
    };
  }

  private async getMediaBucketName(): Promise<string> {
    const config = await getStorageBucketConfig();
    return config.media;
  }

  private parseDimensions(value: Database['public']['Tables']['media_assets']['Row']['dimensions']): { width: number; height: number } | undefined {
    if (!value) return undefined;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        console.warn('Failed to parse media dimensions string:', error);
        return undefined;
      }
    }
    return value as { width: number; height: number };
  }
}

export const mediaRepository = new MediaRepository();
