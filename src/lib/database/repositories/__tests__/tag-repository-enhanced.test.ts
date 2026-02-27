import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TagRepository } from '../tag-repository';
import { ValidationError } from '../../connection';

// Mock the database connection
vi.mock('../../connection', () => ({
  DatabaseConnection: vi.fn().mockImplementation(() => ({
    executeQuery: vi.fn(),
    executeArrayQuery: vi.fn(),
    executeOptionalQuery: vi.fn(),
  })),
  ValidationError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ValidationError';
    }
  },
  ConflictError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ConflictError';
    }
  }
}));

describe('TagRepository Enhanced Features', () => {
  let tagRepo: TagRepository;
  let mockDb: any;

  beforeEach(() => {
    tagRepo = new TagRepository(true);
    mockDb = (tagRepo as any).db;
    vi.clearAllMocks();
  });

  describe('findAllWithStats', () => {
    it('should return tags with post counts', async () => {
      const mockData = [
        {
          id: '1',
          name: 'JavaScript',
          slug: 'javascript',
          created_at: '2023-01-01T00:00:00Z',
          post_tags: [{ id: '1' }, { id: '2' }]
        },
        {
          id: '2',
          name: 'React',
          slug: 'react',
          created_at: '2023-01-01T00:00:00Z',
          post_tags: []
        }
      ];

      mockDb.executeArrayQuery.mockResolvedValue(mockData.map((row: any) => ({
        ...row,
        postCount: row.post_tags?.length || 0
      })));

      const result = await tagRepo.findAllWithStats(10, 0);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: '1',
        name: 'JavaScript',
        slug: 'javascript',
        postCount: 2
      });
      expect(result[1]).toMatchObject({
        id: '2',
        name: 'React',
        slug: 'react',
        postCount: 0
      });
    });
  });

  describe('getTagStats', () => {
    it('should return comprehensive tag statistics', async () => {
      const mockTotalResult = { count: 5 };
      const mockStatsData = [
        {
          id: '1',
          name: 'JavaScript',
          slug: 'javascript',
          created_at: '2023-01-01T00:00:00Z',
          post_tags: [{ id: '1' }, { id: '2' }, { id: '3' }]
        },
        {
          id: '2',
          name: 'React',
          slug: 'react',
          created_at: '2023-01-01T00:00:00Z',
          post_tags: [{ id: '4' }]
        },
        {
          id: '3',
          name: 'Unused',
          slug: 'unused',
          created_at: '2023-01-01T00:00:00Z',
          post_tags: []
        }
      ];

      mockDb.executeQuery.mockImplementation(async (callback) => {
        const mockClient = {
          from: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis()
        };

        // First call for total count
        mockClient.select.mockReturnValueOnce({
          ...mockClient,
          count: 'exact',
          head: true
        });

        const result = await callback(mockClient);
        
        return {
          data: {
            totalTags: 5,
            usedTags: 2,
            unusedTags: 3,
            averagePostsPerTag: 2,
            mostUsedTag: {
              id: '1',
              name: 'JavaScript',
              slug: 'javascript',
              postCount: 3
            }
          }
        };
      });

      const result = await tagRepo.getTagStats();

      expect(result.data).toMatchObject({
        totalTags: 5,
        usedTags: 2,
        unusedTags: 3,
        averagePostsPerTag: 2,
        mostUsedTag: expect.objectContaining({
          name: 'JavaScript',
          postCount: 3
        })
      });
    });
  });

  describe('bulkDelete', () => {
    it('should delete multiple tags and return results', async () => {
      const tagIds = ['1', '2', '3'];
      
      // Mock successful deletion for first two, failure for third
      vi.spyOn(tagRepo, 'delete')
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Tag not found'));

      const result = await tagRepo.bulkDelete(tagIds);

      expect(result.success).toEqual(['1', '2']);
      expect(result.failed).toEqual([
        { id: '3', error: 'Tag not found' }
      ]);
    });
  });

  describe('bulkUpdate', () => {
    it('should update multiple tags and return results', async () => {
      const updates = [
        { id: '1', data: { name: 'Updated Tag 1' } },
        { id: '2', data: { name: 'Updated Tag 2' } },
        { id: '3', data: { name: 'Updated Tag 3' } }
      ];
      
      // Mock successful update for first two, failure for third
      vi.spyOn(tagRepo, 'update')
        .mockResolvedValueOnce({ id: '1', name: 'Updated Tag 1', slug: 'tag1', createdAt: new Date() })
        .mockResolvedValueOnce({ id: '2', name: 'Updated Tag 2', slug: 'tag2', createdAt: new Date() })
        .mockRejectedValueOnce(new Error('Tag not found'));

      const result = await tagRepo.bulkUpdate(updates);

      expect(result.success).toEqual(['1', '2']);
      expect(result.failed).toEqual([
        { id: '3', error: 'Tag not found' }
      ]);
    });
  });

  describe('mergeTags', () => {
    it('should merge tags successfully', async () => {
      const targetTagId = '1';
      const sourceTagIds = ['2', '3'];

      // Mock target tag exists
      vi.spyOn(tagRepo, 'findById').mockResolvedValue({
        id: '1',
        name: 'Target Tag',
        slug: 'target-tag',
        createdAt: new Date()
      });

      // Mock post_tags queries
      mockDb.executeArrayQuery
        .mockResolvedValueOnce([{ post_id: 'post1' }, { post_id: 'post2' }]) // For tag 2
        .mockResolvedValueOnce([{ post_id: 'post3' }]); // For tag 3

      // Mock post_tag association checks and operations
      mockDb.executeOptionalQuery
        .mockResolvedValue(null) // No existing associations
        .mockResolvedValue(null)
        .mockResolvedValue(null);

      mockDb.executeQuery.mockResolvedValue({ data: null });

      // Mock tag deletion
      vi.spyOn(tagRepo, 'delete')
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      const result = await tagRepo.mergeTags(targetTagId, sourceTagIds);

      expect(result.mergedPosts).toBe(3);
      expect(result.deletedTags).toEqual(['2', '3']);
      expect(result.errors).toEqual([]);
    });

    it('should throw error if target tag not found', async () => {
      vi.spyOn(tagRepo, 'findById').mockResolvedValue(null);

      await expect(tagRepo.mergeTags('nonexistent', ['2', '3']))
        .rejects.toThrow(ValidationError);
    });

    it('should handle errors during merge', async () => {
      const targetTagId = '1';
      const sourceTagIds = ['2', '3'];

      // Mock target tag exists
      vi.spyOn(tagRepo, 'findById').mockResolvedValue({
        id: '1',
        name: 'Target Tag',
        slug: 'target-tag',
        createdAt: new Date()
      });

      // Mock successful merge for first tag, error for second
      mockDb.executeArrayQuery
        .mockResolvedValueOnce([{ post_id: 'post1' }]) // For tag 2
        .mockRejectedValueOnce(new Error('Database error')); // For tag 3

      mockDb.executeOptionalQuery.mockResolvedValue(null);
      mockDb.executeQuery.mockResolvedValue({ data: null });

      vi.spyOn(tagRepo, 'delete').mockResolvedValue(undefined);

      const result = await tagRepo.mergeTags(targetTagId, sourceTagIds);

      expect(result.mergedPosts).toBe(1);
      expect(result.deletedTags).toEqual(['2']);
      expect(result.errors).toEqual([
        { tagId: '3', error: 'Database error' }
      ]);
    });
  });

  describe('findUnused', () => {
    it('should return tags with no posts', async () => {
      const mockData = [
        {
          id: '1',
          name: 'Used Tag',
          slug: 'used-tag',
          created_at: '2023-01-01T00:00:00Z',
          post_tags: [{ id: '1' }]
        },
        {
          id: '2',
          name: 'Unused Tag',
          slug: 'unused-tag',
          created_at: '2023-01-01T00:00:00Z',
          post_tags: []
        }
      ];

      mockDb.executeArrayQuery.mockResolvedValue(mockData);

      const result = await tagRepo.findUnused(10, 0);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: '1',
        name: 'Used Tag'
      });
      expect(result[1]).toMatchObject({
        id: '2',
        name: 'Unused Tag'
      });
    });
  });

  describe('update slug handling', () => {
    it('allows updating a tag when slug is unchanged', async () => {
      const dbRow = {
        id: '1',
        name: 'Updated Tag',
        slug: 'tag-slug',
        created_at: '2023-01-01T00:00:00Z',
      };

      mockDb.executeQuery.mockResolvedValue({
        id: dbRow.id,
        name: dbRow.name,
        slug: dbRow.slug,
        createdAt: new Date(dbRow.created_at),
      });

      vi.spyOn(tagRepo, 'findBySlug').mockResolvedValue({
        id: '1',
        name: 'Original Tag',
        slug: 'tag-slug',
        createdAt: new Date('2023-01-01T00:00:00Z'),
      });

      const result = await tagRepo.update('1', { name: 'Updated Tag', slug: 'tag-slug' });

      expect(result).toMatchObject({
        id: '1',
        name: 'Updated Tag',
        slug: 'tag-slug',
      });
      expect(mockDb.executeQuery).toHaveBeenCalled();
    });

    it('prevents updating a tag when slug conflicts with another tag', async () => {
      vi.spyOn(tagRepo, 'findBySlug').mockResolvedValue({
        id: '2',
        name: 'Existing Tag',
        slug: 'duplicate',
        createdAt: new Date(),
      });

      await expect(tagRepo.update('1', { slug: 'duplicate' })).rejects.toThrow('Tag with this slug already exists');
      expect(mockDb.executeQuery).not.toHaveBeenCalled();
    });
  });

  describe('getUsageCount', () => {
    it('returns the number of posts using a tag', async () => {
      mockDb.executeQuery.mockResolvedValue({ count: 5 });

      const count = await tagRepo.getUsageCount('tag-id');
      expect(count).toBe(5);
      expect(mockDb.executeQuery).toHaveBeenCalled();
    });
  });
});
