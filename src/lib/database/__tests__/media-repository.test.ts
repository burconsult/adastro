import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaRepository } from '../repositories/media-repository.js';
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

describe('MediaRepository', () => {
  let mediaRepository: MediaRepository;
  let mockSupabase: any;
  let mockSupabaseAdmin: any;

  beforeEach(async () => {
    // Import the mocked modules
    const supabaseModule = await import('../../supabase.js');
    mockSupabase = supabaseModule.supabase;
    mockSupabaseAdmin = supabaseModule.supabaseAdmin;
    
    mediaRepository = new MediaRepository();
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new media asset record', async () => {
      const mockMediaData = {
        filename: 'test-image.jpg',
        storagePath: 'uploads/test-image.jpg',
        altText: 'Test image',
        caption: 'Test caption',
        mimeType: 'image/jpeg',
        fileSize: 1024 * 1024,
        dimensions: { width: 1920, height: 1080 }
      };

      const mockDbResponse = {
        id: '123',
        filename: 'test-image.jpg',
        storage_path: 'uploads/test-image.jpg',
        alt_text: 'Test image',
        caption: 'Test caption',
        mime_type: 'image/jpeg',
        file_size: 1024 * 1024,
        dimensions: JSON.stringify({ width: 1920, height: 1080 }),
        created_at: new Date().toISOString()
      };

      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockDbResponse,
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

      mockSupabaseAdmin.from.mockReturnValue(mockFrom());
      mockSupabase.storage.from.mockReturnValue(mockStorageFrom());

      const result = await mediaRepository.create(mockMediaData);

      expect(result).toBeDefined();
      expect(result.id).toBe('123');
      expect(result.filename).toBe('test-image.jpg');
      expect(result.url).toBe('https://example.com/test-image.jpg');
      expect(result.dimensions).toEqual({ width: 1920, height: 1080 });

      expect(mockFrom().insert).toHaveBeenCalledWith(expect.objectContaining({
        filename: 'test-image.jpg',
        storage_path: 'uploads/test-image.jpg',
        alt_text: 'Test image',
        caption: 'Test caption',
        mime_type: 'image/jpeg',
        file_size: 1024 * 1024,
        dimensions: JSON.stringify({ width: 1920, height: 1080 })
      }));
    });

    it('should handle creation errors', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Insert failed' }
            })
          })
        })
      });

      mockSupabaseAdmin.from.mockReturnValue(mockFrom());

      await expect(mediaRepository.create({
        filename: 'test.jpg',
        storagePath: 'uploads/test.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024
      })).rejects.toThrow('Failed to create media asset: Insert failed');
    });
  });

  describe('findById', () => {
    it('should find media asset by ID', async () => {
      const mockDbResponse = {
        id: '123',
        filename: 'test-image.jpg',
        storage_path: 'uploads/test-image.jpg',
        alt_text: 'Test image',
        caption: null,
        mime_type: 'image/jpeg',
        file_size: 1024,
        dimensions: null,
        created_at: new Date().toISOString()
      };

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockDbResponse,
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

      const result = await mediaRepository.findById('123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('123');
      expect(result?.filename).toBe('test-image.jpg');
      expect(mockFrom().select().eq).toHaveBeenCalledWith('id', '123');
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

      const result = await mediaRepository.findById('non-existent');
      expect(result).toBeNull();
    });

    it('preserves direct local image paths without generating bucket URLs', async () => {
      const mockDbResponse = {
        id: '124',
        filename: 'article_image_01.webp',
        storage_path: '/images/article_image_01.webp',
        alt_text: 'Demo image',
        caption: null,
        mime_type: 'image/webp',
        file_size: 12000,
        dimensions: null,
        created_at: new Date().toISOString()
      };

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockDbResponse,
              error: null
            })
          })
        })
      });

      const storageFromSpy = vi.fn();
      mockSupabase.from.mockReturnValue(mockFrom());
      mockSupabase.storage.from.mockImplementation(storageFromSpy);

      const result = await mediaRepository.findById('124');

      expect(result?.url).toBe('/images/article_image_01.webp');
      expect(storageFromSpy).not.toHaveBeenCalled();
    });
  });

  describe('findMany', () => {
    it('should list media assets with default pagination', async () => {
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
        }
      ];

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({
              data: mockAssets,
              error: null,
              count: 1
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

      const result = await mediaRepository.findMany();

      expect(result.assets).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockFrom().select().order().range).toHaveBeenCalledWith(0, 19); // Default limit 20
    });

    it('should apply mime type filter', async () => {
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

      await mediaRepository.findMany({ mimeType: 'image' });

      expect(mockFrom().select().like).toHaveBeenCalledWith('mime_type', 'image%');
    });

    it('should apply search filter', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
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

      await mediaRepository.findMany({ search: 'test' });

      expect(mockFrom().select().or).toHaveBeenCalledWith(
        'filename.ilike.%test%,alt_text.ilike.%test%,caption.ilike.%test%'
      );
    });

    it('should apply custom pagination', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({
              data: [],
              error: null,
              count: 0
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue(mockFrom());

      await mediaRepository.findMany({ limit: 10, offset: 20 });

      expect(mockFrom().select().order().range).toHaveBeenCalledWith(20, 29);
    });
  });

  describe('update', () => {
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

      const result = await mediaRepository.update('123', {
        altText: 'Updated alt text',
        caption: 'Updated caption',
        filename: 'updated-image.jpg'
      });

      expect(result.altText).toBe('Updated alt text');
      expect(result.caption).toBe('Updated caption');
      expect(result.filename).toBe('updated-image.jpg');

      expect(mockFrom().update).toHaveBeenCalledWith({
        alt_text: 'Updated alt text',
        caption: 'Updated caption',
        filename: 'updated-image.jpg'
      });
    });
  });

  describe('delete', () => {
    it('should delete media asset record', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      });

      mockSupabaseAdmin.from.mockReturnValue(mockFrom());

      await mediaRepository.delete('123');

      expect(mockFrom().delete().eq).toHaveBeenCalledWith('id', '123');
    });

    it('should handle deletion errors', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } })
        })
      });

      mockSupabaseAdmin.from.mockReturnValue(mockFrom());

      await expect(mediaRepository.delete('123'))
        .rejects.toThrow('Failed to delete media asset: Delete failed');
    });
  });

  describe('getUsageStats', () => {
    it('should calculate usage statistics', async () => {
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

      const stats = await mediaRepository.getUsageStats();

      expect(stats.totalFiles).toBe(3);
      expect(stats.totalSize).toBe(4608);
      expect(stats.formatDistribution.jpeg).toBe(2);
      expect(stats.formatDistribution.png).toBe(1);
      expect(stats.averageFileSize).toBe(1536);
    });
  });

  describe('findOptimizationCandidates', () => {
    it('should identify optimization candidates', async () => {
      const mockData = [
        {
          id: '1',
          filename: 'large-image.jpg',
          storage_path: 'uploads/large-image.jpg',
          alt_text: null,
          caption: null,
          mime_type: 'image/jpeg',
          file_size: 3 * 1024 * 1024, // 3MB - oversized
          dimensions: JSON.stringify({ width: 3000, height: 2000 }),
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          filename: 'unoptimized.png',
          storage_path: 'uploads/unoptimized.png',
          alt_text: 'Has alt text',
          caption: null,
          mime_type: 'image/png', // Unoptimized format
          file_size: 1024,
          dimensions: JSON.stringify({ width: 800, height: 600 }),
          created_at: new Date().toISOString()
        },
        {
          id: '3',
          filename: 'no-alt.jpg',
          storage_path: 'uploads/no-alt.jpg',
          alt_text: null, // Missing alt text
          caption: null,
          mime_type: 'image/jpeg',
          file_size: 1024,
          dimensions: JSON.stringify({ width: 800, height: 600 }),
          created_at: new Date().toISOString()
        }
      ];

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: mockData,
          error: null
        })
      });

      const mockStorageFrom = vi.fn().mockReturnValue({
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/image.jpg' }
        })
      });

      mockSupabase.from.mockReturnValue(mockFrom());
      mockSupabase.storage.from.mockReturnValue(mockStorageFrom());

      const candidates = await mediaRepository.findOptimizationCandidates();

      expect(candidates.oversized).toHaveLength(1);
      expect(candidates.oversized[0].id).toBe('1');

      expect(candidates.unoptimizedFormats).toHaveLength(3); // All 3 images (JPEG, PNG, JPEG - none are WebP/AVIF)
      expect(candidates.unoptimizedFormats.map(a => a.id)).toContain('1');
      expect(candidates.unoptimizedFormats.map(a => a.id)).toContain('2');
      expect(candidates.unoptimizedFormats.map(a => a.id)).toContain('3');

      expect(candidates.missingAltText).toHaveLength(2);
      expect(candidates.missingAltText.map(a => a.id)).toContain('1');
      expect(candidates.missingAltText.map(a => a.id)).toContain('3');
    });
  });
});
