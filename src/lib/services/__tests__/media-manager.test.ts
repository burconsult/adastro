import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MediaManager } from '../media-manager.js';
import type { MediaAsset } from '../../types/index.js';

// Mock Supabase
vi.mock('../../supabase.js', () => ({
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn()
    }
  },
  supabaseAdmin: {
    from: vi.fn(),
    storage: {
      from: vi.fn()
    }
  }
}));

// Mock Sharp
vi.mock('sharp', () => {
  const mockSharp = vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({
      width: 1920,
      height: 1080,
      format: 'jpeg'
    }),
    resize: vi.fn().mockReturnThis(),
    toFormat: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    avif: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('optimized-image-data'))
  }));
  
  return { default: mockSharp };
});

describe('MediaManager', () => {
  let mediaManager: MediaManager;
  let mockFile: File;
  let mockSupabase: any;
  let mockSupabaseAdmin: any;

  beforeEach(async () => {
    // Import the mocked modules
    const supabaseModule = await import('../../supabase.js');
    mockSupabase = supabaseModule.supabase;
    mockSupabaseAdmin = supabaseModule.supabaseAdmin;
    
    mediaManager = new MediaManager();
    
    // Create mock file
    const buffer = new ArrayBuffer(1024 * 1024); // 1MB
    const baseFile = new File([buffer], 'test-image.jpg', { type: 'image/jpeg' });
    baseFile.arrayBuffer = async () => buffer;
    mockFile = baseFile;

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('uploadMedia', () => {
    it('should upload and process media file successfully', async () => {
      const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
      const expectedFilename = '1700000000000-test-image.webp';

      // Mock successful upload
      const mockStorageFrom = vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: { path: 'uploads/test-image.jpg' },
          error: null
        }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: `https://example.com/${expectedFilename}` }
        })
      });

      mockSupabaseAdmin.storage.from.mockReturnValue(mockStorageFrom());

      // Mock database insert
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: '123',
                filename: expectedFilename,
                storage_path: `uploads/${expectedFilename}`,
                alt_text: 'Test image',
                caption: null,
                mime_type: 'image/webp',
                file_size: 1024 * 512,
                dimensions: JSON.stringify({ width: 1920, height: 1080 }),
                original_filename: '1700000000000-test-image.jpg',
                original_storage_path: 'originals/1700000000000-test-image.jpg',
                original_mime_type: 'image/jpeg',
                original_file_size: 1024 * 1024,
                original_dimensions: JSON.stringify({ width: 1920, height: 1080 }),
                created_at: new Date().toISOString()
              },
              error: null
            })
          })
        })
      });

      mockSupabaseAdmin.from.mockReturnValue(mockFrom());

      const result = await mediaManager.uploadMedia({
        file: mockFile,
        altText: 'Test image'
      });
      const primary = result.public ?? result.original;

      expect(result.public).toBeDefined();
      expect(primary).toBeDefined();
      expect(primary.filename).toBe(expectedFilename);
      expect(primary.altText).toBe('Test image');
      expect(result.optimized).toBeInstanceOf(Array);
      expect(result.standard || result.optimized.length === 0).toBeTruthy();
      expect(result.formatConversions).toContain('image/jpeg -> image/webp');
      expect(result.sizeSavings).toBeGreaterThanOrEqual(0);

      nowSpy.mockRestore();
    });

    it('should reject invalid file types', async () => {
      const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain' });

      await expect(mediaManager.uploadMedia({ file: invalidFile }))
        .rejects.toThrow('Unsupported file type: text/plain');
    });

    it('should handle upload errors gracefully', async () => {
      const mockStorageFrom = vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Upload failed' }
        })
      });

      mockSupabaseAdmin.storage.from.mockReturnValue(mockStorageFrom());

      await expect(mediaManager.uploadMedia({ file: mockFile }))
        .rejects.toThrow('Upload failed: Upload failed');
    });

    it('should retry insert with stringified dimensions for legacy text columns', async () => {
      const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
      const expectedFilename = '1700000000000-test-image.webp';

      const mockStorageFrom = vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: { path: 'uploads/test-image.jpg' },
          error: null
        }),
        remove: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: `https://example.com/${expectedFilename}` }
        })
      });
      mockSupabaseAdmin.storage.from.mockReturnValue(mockStorageFrom());

      const insertResult = (data: any, error: any) => ({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data, error })
        })
      });

      const insert = vi
        .fn()
        .mockReturnValueOnce(
          insertResult(null, {
            message: 'column "dimensions" is of type text but expression is of type jsonb'
          })
        )
        .mockReturnValueOnce(
          insertResult(
            {
              id: 'legacy-1',
              filename: expectedFilename,
              storage_path: `uploads/${expectedFilename}`,
              alt_text: 'Legacy image',
              caption: null,
              mime_type: 'image/webp',
              file_size: 1024 * 512,
              dimensions: JSON.stringify({ width: 1920, height: 1080 }),
              original_filename: '1700000000000-test-image.jpg',
              original_storage_path: 'originals/1700000000000-test-image.jpg',
              original_mime_type: 'image/jpeg',
              original_file_size: 1024 * 1024,
              original_dimensions: JSON.stringify({ width: 1920, height: 1080 }),
              created_at: new Date().toISOString()
            },
            null
          )
        );

      mockSupabaseAdmin.from.mockReturnValue({ insert });

      const result = await mediaManager.uploadMedia({
        file: mockFile,
        altText: 'Legacy image'
      });
      const primary = result.public ?? result.original;

      expect(primary?.id).toBe('legacy-1');
      expect(insert).toHaveBeenCalledTimes(2);
      expect(insert.mock.calls[1]?.[0]).toEqual(
        expect.objectContaining({
          dimensions: JSON.stringify({ width: 1920, height: 1080 }),
          original_dimensions: JSON.stringify({ width: 1920, height: 1080 })
        })
      );

      nowSpy.mockRestore();
    });

    it('should retry insert without optional original columns when schema is missing them', async () => {
      const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
      const expectedFilename = '1700000000000-test-image.webp';

      const mockStorageFrom = vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: { path: 'uploads/test-image.jpg' },
          error: null
        }),
        remove: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: `https://example.com/${expectedFilename}` }
        })
      });
      mockSupabaseAdmin.storage.from.mockReturnValue(mockStorageFrom());

      const insertResult = (data: any, error: any) => ({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data, error })
        })
      });

      const insert = vi
        .fn()
        .mockReturnValueOnce(
          insertResult(null, {
            message: "Could not find the 'original_dimensions' column of 'media_assets' in the schema cache"
          })
        )
        .mockReturnValueOnce(
          insertResult(null, {
            message: "Could not find the 'original_filename' column of 'media_assets' in the schema cache"
          })
        )
        .mockReturnValueOnce(
          insertResult(
            {
              id: 'legacy-core-only',
              filename: expectedFilename,
              storage_path: `uploads/${expectedFilename}`,
              alt_text: 'Core only image',
              caption: null,
              mime_type: 'image/webp',
              file_size: 1024 * 512,
              dimensions: JSON.stringify({ width: 1920, height: 1080 }),
              created_at: new Date().toISOString()
            },
            null
          )
        );

      mockSupabaseAdmin.from.mockReturnValue({ insert });

      const result = await mediaManager.uploadMedia({
        file: mockFile,
        altText: 'Core only image'
      });

      expect(result.public?.id).toBe('legacy-core-only');
      expect(insert).toHaveBeenCalledTimes(3);
      expect(insert.mock.calls[2]?.[0]).not.toHaveProperty('original_dimensions');
      expect(insert.mock.calls[2]?.[0]).not.toHaveProperty('original_filename');

      nowSpy.mockRestore();
    });
  });

  describe('getMediaAsset', () => {
    it('should retrieve media asset by ID', async () => {
      const mockAssetData = {
        id: '123',
        filename: 'test-image.jpg',
        storage_path: 'uploads/test-image.jpg',
        alt_text: 'Test image',
        caption: null,
        mime_type: 'image/jpeg',
        file_size: 1024 * 1024,
        dimensions: JSON.stringify({ width: 1920, height: 1080 }),
        created_at: new Date().toISOString()
      };

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockAssetData,
              error: null
            })
          })
        })
      });

      const mockStorageFrom = vi.fn().mockReturnValue({
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/test-image.jpg' }
        })
      });

      mockSupabase.from.mockReturnValue(mockFrom());
      mockSupabase.storage.from.mockReturnValue(mockStorageFrom());

      const result = await mediaManager.getMediaAsset('123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('123');
      expect(result?.filename).toBe('test-image.jpg');
      expect(result?.url).toBe('https://example.com/test-image.jpg');
    });

    it('should return null for non-existent asset', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' }
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue(mockFrom());

      const result = await mediaManager.getMediaAsset('non-existent');
      expect(result).toBeNull();
    });

    it('should parse object dimensions from jsonb columns', async () => {
      const mockAssetData = {
        id: '456',
        filename: 'jsonb-image.jpg',
        storage_path: 'uploads/jsonb-image.jpg',
        alt_text: 'JSONB image',
        caption: null,
        mime_type: 'image/jpeg',
        file_size: 2048,
        dimensions: { width: 1200, height: 800 },
        original_dimensions: { width: 2400, height: 1600 },
        created_at: new Date().toISOString()
      };

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockAssetData,
              error: null
            })
          })
        })
      });

      const mockStorageFrom = vi.fn().mockReturnValue({
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/jsonb-image.jpg' }
        })
      });

      mockSupabase.from.mockReturnValue(mockFrom());
      mockSupabase.storage.from.mockReturnValue(mockStorageFrom());

      const result = await mediaManager.getMediaAsset('456');
      expect(result?.dimensions).toEqual({ width: 1200, height: 800 });
      expect(result?.originalDimensions).toEqual({ width: 2400, height: 1600 });
    });
  });

  describe('listMediaAssets', () => {
    it('should list media assets with pagination', async () => {
      const mockAssets = [
        {
          id: '1',
          filename: 'image1.jpg',
          storage_path: 'uploads/image1.jpg',
          alt_text: 'Image 1',
          caption: null,
          mime_type: 'image/jpeg',
          file_size: 1024,
          dimensions: null,
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          filename: 'image2.png',
          storage_path: 'uploads/image2.png',
          alt_text: 'Image 2',
          caption: null,
          mime_type: 'image/png',
          file_size: 2048,
          dimensions: null,
          created_at: new Date().toISOString()
        }
      ];

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({
              data: mockAssets,
              error: null,
              count: 2
            })
          })
        })
      });

      const mockStorageFrom = vi.fn().mockReturnValue({
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/image.jpg' }
        })
      });

      mockSupabase.from.mockReturnValue(mockFrom());
      mockSupabase.storage.from.mockReturnValue(mockStorageFrom());

      const result = await mediaManager.listMediaAssets({ limit: 10, offset: 0 });

      expect(result.assets).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.assets[0].id).toBe('1');
      expect(result.assets[1].id).toBe('2');
    });

    it('should filter by mime type', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          like: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({
                data: [],
                error: null,
                count: 0
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue(mockFrom());

      await mediaManager.listMediaAssets({ mimeType: 'image' });

      expect(mockFrom().select().like).toHaveBeenCalledWith('mime_type', 'image%');
    });
  });

  describe('updateMediaAsset', () => {
    it('should update media asset metadata', async () => {
      const updatedAsset = {
        id: '123',
        filename: 'updated-image.jpg',
        storage_path: 'uploads/test-image.jpg',
        alt_text: 'Updated alt text',
        caption: 'Updated caption',
        mime_type: 'image/jpeg',
        file_size: 1024,
        dimensions: null,
        created_at: new Date().toISOString()
      };

      const mockFrom = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: updatedAsset,
                error: null
              })
            })
          })
        })
      });

      const mockStorageFrom = vi.fn().mockReturnValue({
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/test-image.jpg' }
        })
      });

      mockSupabaseAdmin.from.mockReturnValue(mockFrom());
      mockSupabase.storage.from.mockReturnValue(mockStorageFrom());

      const result = await mediaManager.updateMediaAsset('123', {
        altText: 'Updated alt text',
        caption: 'Updated caption',
        filename: 'updated-image.jpg'
      });

      expect(result.altText).toBe('Updated alt text');
      expect(result.caption).toBe('Updated caption');
      expect(result.filename).toBe('updated-image.jpg');
    });
  });

  describe('deleteMediaAsset', () => {
    it('should delete media asset and clean up storage', async () => {
      // Mock getMediaAsset
      const mockAsset: MediaAsset = {
        id: '123',
        filename: 'test-image.jpg',
        url: 'https://example.com/test-image.jpg',
        storagePath: 'uploads/test-image.jpg',
        altText: 'Test image',
        caption: null,
        mimeType: 'image/jpeg',
        fileSize: 1024,
        dimensions: { width: 800, height: 600 },
        createdAt: new Date()
      };

      vi.spyOn(mediaManager, 'getMediaAsset').mockResolvedValue(mockAsset);

      const mockStorageFrom = vi.fn().mockReturnValue({
        remove: vi.fn().mockResolvedValue({ error: null })
      });

      const mockFrom = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      });

      mockSupabaseAdmin.storage.from.mockReturnValue(mockStorageFrom());
      mockSupabaseAdmin.from.mockReturnValue(mockFrom());

      await mediaManager.deleteMediaAsset('123');

      expect(mockStorageFrom().remove).toHaveBeenCalledWith(['uploads/test-image.jpg']);
      expect(mockFrom().delete().eq).toHaveBeenCalledWith('id', '123');
    });
  });

  describe('getMediaUsageStats', () => {
    it('should calculate media usage statistics', async () => {
      const mockData = [
        { mime_type: 'image/jpeg', file_size: 1024 },
        { mime_type: 'image/png', file_size: 2048 },
        { mime_type: 'image/jpeg', file_size: 1536 }
      ];

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: mockData,
          error: null
        })
      });

      mockSupabase.from.mockReturnValue(mockFrom());

      const stats = await mediaManager.getMediaUsageStats();

      expect(stats.totalFiles).toBe(3);
      expect(stats.totalSize).toBe(4608);
      expect(stats.formatDistribution.jpeg).toBe(2);
      expect(stats.formatDistribution.png).toBe(1);
      expect(stats.averageFileSize).toBe(1536);
    });
  });

  describe('generateAltTextSuggestion', () => {
    it('should generate alt text suggestions based on filename', async () => {
      const mockAsset: MediaAsset = {
        id: '123',
        filename: 'company-logo.png',
        url: 'https://example.com/logo.png',
        storagePath: 'uploads/logo.png',
        mimeType: 'image/png',
        fileSize: 1024,
        createdAt: new Date()
      };

      const suggestion = await mediaManager.generateAltTextSuggestion(mockAsset);
      expect(suggestion).toBe('Company or brand logo');
    });

    it('should generate suggestions based on dimensions', async () => {
      const mockAsset: MediaAsset = {
        id: '123',
        filename: 'image.jpg',
        url: 'https://example.com/image.jpg',
        storagePath: 'uploads/image.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024,
        dimensions: { width: 1920, height: 1080 },
        createdAt: new Date()
      };

      const suggestion = await mediaManager.generateAltTextSuggestion(mockAsset);
      expect(suggestion).toBe('Landscape image');
    });
  });

  describe('bulkDeleteMediaAssets', () => {
    it('should delete multiple assets and report results', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(mediaManager, 'deleteMediaAsset')
        .mockResolvedValueOnce(undefined) // Success for first ID
        .mockRejectedValueOnce(new Error('Delete failed')) // Failure for second ID
        .mockResolvedValueOnce(undefined); // Success for third ID

      const result = await mediaManager.bulkDeleteMediaAssets(['1', '2', '3']);

      expect(result.deleted).toEqual(['1', '3']);
      expect(result.failed).toEqual(['2']);

      consoleSpy.mockRestore();
    });
  });
});
