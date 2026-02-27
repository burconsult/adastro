import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ContentManager } from '../content-manager.js';
import { PostRepository } from '../../database/repositories/post-repository.js';
import { CategoryRepository } from '../../database/repositories/category-repository.js';
import { TagRepository } from '../../database/repositories/tag-repository.js';
import { ValidationError, NotFoundError } from '../../database/connection.js';
import type { BlogPost, Category, Tag, PostStatus } from '../../types/index.js';

// Mock the repositories
vi.mock('../../database/repositories/post-repository.js');
vi.mock('../../database/repositories/category-repository.js');
vi.mock('../../database/repositories/tag-repository.js');

describe('ContentManager', () => {
  let contentManager: ContentManager;
  let mockPostRepo: vi.Mocked<PostRepository>;
  let mockCategoryRepo: vi.Mocked<CategoryRepository>;
  let mockTagRepo: vi.Mocked<TagRepository>;

  // Mock data
  const mockAuthor = {
    id: 'author-1',
    name: 'John Doe',
    email: 'john@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCategory: Category = {
    id: 'cat-1',
    name: 'Technology',
    slug: 'technology',
    createdAt: new Date(),
  };

  const mockTag: Tag = {
    id: 'tag-1',
    name: 'JavaScript',
    slug: 'javascript',
    createdAt: new Date(),
  };

  const mockPost: BlogPost = {
    id: 'post-1',
    title: 'Test Post',
    slug: 'test-post',
    content: 'This is a test post content.',
    author: mockAuthor,
    publishedAt: new Date(),
    updatedAt: new Date(),
    createdAt: new Date(),
    status: 'published',
    categories: [mockCategory],
    tags: [mockTag],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mocked instances
    mockPostRepo = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findByIdWithRelations: vi.fn(),
      findBySlug: vi.fn(),
      findBySlugOrThrow: vi.fn(),
      findWithFilters: vi.fn(),
      count: vi.fn(),
    } as any;

    mockCategoryRepo = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findByIdOrThrow: vi.fn(),
      findBySlug: vi.fn(),
      findBySlugOrThrow: vi.fn(),
      findAll: vi.fn(),
      findRootCategories: vi.fn(),
      findChildren: vi.fn(),
      search: vi.fn(),
      getCategoryHierarchy: vi.fn(),
      count: vi.fn(),
    } as any;

    mockTagRepo = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findByIdOrThrow: vi.fn(),
      findBySlug: vi.fn(),
      findBySlugOrThrow: vi.fn(),
      findAll: vi.fn(),
      search: vi.fn(),
      findMostUsed: vi.fn(),
      createFromName: vi.fn(),
      findOrCreateByNames: vi.fn(),
      count: vi.fn(),
    } as any;

    // Mock the constructors
    vi.mocked(PostRepository).mockImplementation(() => mockPostRepo);
    vi.mocked(CategoryRepository).mockImplementation(() => mockCategoryRepo);
    vi.mocked(TagRepository).mockImplementation(() => mockTagRepo);

    contentManager = new ContentManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Post lifecycle management', () => {
    it('should create a new post', async () => {
      const createData = {
        title: 'New Post',
        slug: 'new-post',
        content: 'Content here',
        authorId: 'author-1',
      };

      mockPostRepo.create.mockResolvedValue(mockPost);

      const result = await contentManager.createPost(createData);

      expect(mockPostRepo.create).toHaveBeenCalledWith(createData);
      expect(result).toEqual(mockPost);
    });

    it('should update an existing post', async () => {
      const updateData = { title: 'Updated Title' };
      mockPostRepo.update.mockResolvedValue({ ...mockPost, title: 'Updated Title' });

      const result = await contentManager.updatePost('post-1', updateData);

      expect(mockPostRepo.update).toHaveBeenCalledWith('post-1', updateData);
      expect(result.title).toBe('Updated Title');
    });

    it('should delete a post', async () => {
      mockPostRepo.delete.mockResolvedValue();

      await contentManager.deletePost('post-1');

      expect(mockPostRepo.delete).toHaveBeenCalledWith('post-1');
    });

    it('should get a post by ID', async () => {
      mockPostRepo.findByIdWithRelations.mockResolvedValue(mockPost);

      const result = await contentManager.getPost('post-1');

      expect(mockPostRepo.findByIdWithRelations).toHaveBeenCalledWith('post-1');
      expect(result).toEqual(mockPost);
    });

    it('should get a post by slug', async () => {
      mockPostRepo.findBySlug.mockResolvedValue(mockPost);

      const result = await contentManager.getPostBySlug('test-post');

      expect(mockPostRepo.findBySlug).toHaveBeenCalledWith('test-post');
      expect(result).toEqual(mockPost);
    });

    it('should throw error when getting non-existent post', async () => {
      mockPostRepo.findByIdWithRelations.mockResolvedValue(null);

      await expect(contentManager.getPostOrThrow('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('Draft, publish, and scheduling functionality', () => {
    it('should save a draft post', async () => {
      const draftData = {
        title: 'Draft Post',
        slug: 'draft-post',
        content: 'Draft content',
        authorId: 'author-1',
      };

      const expectedDraft = { ...mockPost, status: 'draft' as PostStatus };
      mockPostRepo.create.mockResolvedValue(expectedDraft);

      const result = await contentManager.saveDraft(draftData);

      expect(mockPostRepo.create).toHaveBeenCalledWith({
        ...draftData,
        status: 'draft',
      });
      expect(result.status).toBe('draft');
    });

    it('should update an existing draft', async () => {
      const updateData = {
        id: 'post-1',
        title: 'Updated Draft',
      };

      const expectedDraft = { ...mockPost, title: 'Updated Draft', status: 'draft' as PostStatus };
      mockPostRepo.update.mockResolvedValue(expectedDraft);

      const result = await contentManager.saveDraft(updateData);

      expect(mockPostRepo.update).toHaveBeenCalledWith('post-1', {
        title: 'Updated Draft',
        status: 'draft',
      });
      expect(result.title).toBe('Updated Draft');
    });

    it('should publish a draft post', async () => {
      const draftPost = { ...mockPost, status: 'draft' as PostStatus };
      mockPostRepo.findByIdWithRelations.mockResolvedValue(draftPost);

      const publishedPost = { ...mockPost, status: 'published' as PostStatus };
      mockPostRepo.update.mockResolvedValue(publishedPost);

      const result = await contentManager.publishPost('post-1');

      expect(mockPostRepo.update).toHaveBeenCalledWith('post-1', {
        status: 'published',
        publishedAt: expect.any(Date),
      });
      expect(result.status).toBe('published');
    });

    it('should not publish an already published post', async () => {
      mockPostRepo.findByIdWithRelations.mockResolvedValue(mockPost);

      await expect(contentManager.publishPost('post-1')).rejects.toThrow(ValidationError);
    });

    it('should unpublish a published post', async () => {
      mockPostRepo.findByIdWithRelations.mockResolvedValue(mockPost);

      const draftPost = { ...mockPost, status: 'draft' as PostStatus };
      mockPostRepo.update.mockResolvedValue(draftPost);

      const result = await contentManager.unpublishPost('post-1');

      expect(mockPostRepo.update).toHaveBeenCalledWith('post-1', {
        status: 'draft',
        publishedAt: undefined,
      });
      expect(result.status).toBe('draft');
    });

    it('should schedule a post for future publication', async () => {
      const draftPost = { ...mockPost, status: 'draft' as PostStatus };
      mockPostRepo.findByIdWithRelations.mockResolvedValue(draftPost);

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      const scheduledPost = { ...mockPost, status: 'scheduled' as PostStatus, publishedAt: futureDate };
      mockPostRepo.update.mockResolvedValue(scheduledPost);

      const result = await contentManager.schedulePost('post-1', { publishAt: futureDate });

      expect(mockPostRepo.update).toHaveBeenCalledWith('post-1', {
        status: 'scheduled',
        publishedAt: futureDate,
      });
      expect(result.status).toBe('scheduled');
    });

    it('should not schedule a post for past date', async () => {
      const draftPost = { ...mockPost, status: 'draft' as PostStatus };
      mockPostRepo.findByIdWithRelations.mockResolvedValue(draftPost);

      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday

      await expect(contentManager.schedulePost('post-1', { publishAt: pastDate }))
        .rejects.toThrow(ValidationError);
    });

    it('should unschedule a scheduled post', async () => {
      const scheduledPost = { ...mockPost, status: 'scheduled' as PostStatus };
      mockPostRepo.findByIdWithRelations.mockResolvedValue(scheduledPost);

      const draftPost = { ...mockPost, status: 'draft' as PostStatus };
      mockPostRepo.update.mockResolvedValue(draftPost);

      const result = await contentManager.unschedulePost('post-1');

      expect(mockPostRepo.update).toHaveBeenCalledWith('post-1', {
        status: 'draft',
        publishedAt: undefined,
      });
      expect(result.status).toBe('draft');
    });

    it('should process scheduled posts that are ready to publish', async () => {
      const pastDate = new Date(Date.now() - 60 * 1000); // 1 minute ago
      const scheduledPost = {
        ...mockPost,
        status: 'scheduled' as PostStatus,
        publishedAt: pastDate
      };

      mockPostRepo.findWithFilters.mockResolvedValue([scheduledPost]);

      const publishedPost = { ...mockPost, status: 'published' as PostStatus };
      mockPostRepo.update.mockResolvedValue(publishedPost);

      const result = await contentManager.processScheduledPosts();

      expect(mockPostRepo.findWithFilters).toHaveBeenCalledWith({
        status: 'scheduled',
        limit: 100,
      });
      expect(mockPostRepo.update).toHaveBeenCalledWith('post-1', {
        status: 'published',
      });
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('published');
    });
  });

  describe('Content search and filtering', () => {
    it('should search posts with basic filters', async () => {
      const filters = {
        status: 'published' as PostStatus,
        search: 'test',
        limit: 10,
        offset: 0,
      };

      mockPostRepo.findWithFilters.mockResolvedValue([mockPost]);

      const result = await contentManager.searchPosts(filters);

      expect(mockPostRepo.findWithFilters).toHaveBeenCalledWith(filters);
      expect(result).toEqual([mockPost]);
    });

    it('should search posts by category slug', async () => {
      const filters = {
        categorySlug: 'technology',
        status: 'published' as PostStatus,
      };

      mockCategoryRepo.findBySlug.mockResolvedValue(mockCategory);
      mockPostRepo.findWithFilters.mockResolvedValue([mockPost]);

      const result = await contentManager.searchPosts(filters);

      expect(mockCategoryRepo.findBySlug).toHaveBeenCalledWith('technology');
      expect(mockPostRepo.findWithFilters).toHaveBeenCalledWith({
        status: 'published',
        categoryId: 'cat-1',
      });
      expect(result).toEqual([mockPost]);
    });

    it('should search posts by tag slug', async () => {
      const filters = {
        tagSlug: 'javascript',
        status: 'published' as PostStatus,
      };

      mockTagRepo.findBySlug.mockResolvedValue(mockTag);
      mockPostRepo.findWithFilters.mockResolvedValue([mockPost]);

      const result = await contentManager.searchPosts(filters);

      expect(mockTagRepo.findBySlug).toHaveBeenCalledWith('javascript');
      expect(mockPostRepo.findWithFilters).toHaveBeenCalledWith({
        status: 'published',
        tagId: 'tag-1',
      });
      expect(result).toEqual([mockPost]);
    });

    it('should return empty results for non-existent category', async () => {
      const filters = {
        categorySlug: 'non-existent',
        status: 'published' as PostStatus,
      };

      mockCategoryRepo.findBySlug.mockResolvedValue(null);

      const result = await contentManager.searchPosts(filters);

      expect(result).toEqual([]);
    });

    it('should filter posts by date range', async () => {
      const publishedDate = new Date('2023-01-15');
      const postWithDate = { ...mockPost, publishedAt: publishedDate };

      const filters = {
        publishedAfter: new Date('2023-01-01'),
        publishedBefore: new Date('2023-02-01'),
      };

      mockPostRepo.findWithFilters.mockResolvedValue([postWithDate]);

      const result = await contentManager.searchPosts(filters);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(postWithDate);
    });

    it('should get published posts', async () => {
      mockPostRepo.findWithFilters.mockResolvedValue([mockPost]);

      const result = await contentManager.getPublishedPosts(5, 10);

      expect(mockPostRepo.findWithFilters).toHaveBeenCalledWith({
        status: 'published',
        limit: 5,
        offset: 10,
      });
      expect(result).toEqual([mockPost]);
    });

    it('should get posts by category', async () => {
      mockCategoryRepo.findBySlug.mockResolvedValue(mockCategory);
      mockPostRepo.findWithFilters.mockResolvedValue([mockPost]);

      const result = await contentManager.getPostsByCategory('technology');

      expect(result).toEqual([mockPost]);
    });

    it('should get posts by tag', async () => {
      mockTagRepo.findBySlug.mockResolvedValue(mockTag);
      mockPostRepo.findWithFilters.mockResolvedValue([mockPost]);

      const result = await contentManager.getPostsByTag('javascript');

      expect(result).toEqual([mockPost]);
    });
  });

  describe('Bulk operations', () => {
    it('should bulk publish posts', async () => {
      const draftPost = { ...mockPost, status: 'draft' as PostStatus };
      mockPostRepo.findByIdWithRelations.mockResolvedValue(draftPost);

      const publishedPost = { ...mockPost, status: 'published' as PostStatus };
      mockPostRepo.update.mockResolvedValue(publishedPost);

      const operation = {
        postIds: ['post-1', 'post-2'],
        operation: 'publish' as const,
      };

      const result = await contentManager.bulkUpdatePosts(operation);

      expect(mockPostRepo.findByIdWithRelations).toHaveBeenCalledTimes(2);
      expect(mockPostRepo.update).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
    });

    it('should bulk delete posts', async () => {
      mockPostRepo.delete.mockResolvedValue();

      const operation = {
        postIds: ['post-1', 'post-2'],
        operation: 'delete' as const,
      };

      const result = await contentManager.bulkUpdatePosts(operation);

      expect(mockPostRepo.delete).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(0); // Deleted posts are not returned
    });

    it('should handle bulk operation errors gracefully', async () => {
      const draftPost = { ...mockPost, status: 'draft' as PostStatus };
      mockPostRepo.findByIdWithRelations
        .mockResolvedValueOnce(draftPost)
        .mockRejectedValueOnce(new Error('Database error'));

      const publishedPost = { ...mockPost, status: 'published' as PostStatus };
      mockPostRepo.update.mockResolvedValue(publishedPost);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      const operation = {
        postIds: ['post-1', 'post-2'],
        operation: 'publish' as const,
      };

      const result = await contentManager.bulkUpdatePosts(operation);

      expect(result).toHaveLength(1); // Only successful operation
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to perform publish on post post-2'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Category management', () => {
    it('should create a category', async () => {
      const createData = {
        name: 'New Category',
        slug: 'new-category',
      };

      mockCategoryRepo.create.mockResolvedValue(mockCategory);

      const result = await contentManager.createCategory(createData);

      expect(mockCategoryRepo.create).toHaveBeenCalledWith(createData);
      expect(result).toEqual(mockCategory);
    });

    it('should get all categories', async () => {
      mockCategoryRepo.findAll.mockResolvedValue([mockCategory]);

      const result = await contentManager.getAllCategories();

      expect(mockCategoryRepo.findAll).toHaveBeenCalledWith(50, 0);
      expect(result).toEqual([mockCategory]);
    });

    it('should search categories', async () => {
      mockCategoryRepo.search.mockResolvedValue([mockCategory]);

      const result = await contentManager.searchCategories('tech');

      expect(mockCategoryRepo.search).toHaveBeenCalledWith('tech', 10, 0);
      expect(result).toEqual([mockCategory]);
    });
  });

  describe('Tag management', () => {
    it('should create a tag', async () => {
      const createData = {
        name: 'New Tag',
        slug: 'new-tag',
      };

      mockTagRepo.create.mockResolvedValue(mockTag);

      const result = await contentManager.createTag(createData);

      expect(mockTagRepo.create).toHaveBeenCalledWith(createData);
      expect(result).toEqual(mockTag);
    });

    it('should get most used tags', async () => {
      const tagWithCount = { ...mockTag, postCount: 5 };
      mockTagRepo.findMostUsed.mockResolvedValue([tagWithCount]);

      const result = await contentManager.getMostUsedTags();

      expect(mockTagRepo.findMostUsed).toHaveBeenCalledWith(20);
      expect(result).toEqual([tagWithCount]);
    });

    it('should create tag from name', async () => {
      mockTagRepo.createFromName.mockResolvedValue(mockTag);

      const result = await contentManager.createTagFromName('JavaScript');

      expect(mockTagRepo.createFromName).toHaveBeenCalledWith('JavaScript');
      expect(result).toEqual(mockTag);
    });

    it('should find or create tags by names', async () => {
      mockTagRepo.findOrCreateByNames.mockResolvedValue([mockTag]);

      const result = await contentManager.findOrCreateTagsByNames(['JavaScript', 'TypeScript']);

      expect(mockTagRepo.findOrCreateByNames).toHaveBeenCalledWith(['JavaScript', 'TypeScript']);
      expect(result).toEqual([mockTag]);
    });
  });

  describe('Content statistics', () => {
    it('should get content statistics', async () => {
      mockPostRepo.count.mockResolvedValue(100);
      mockPostRepo.findWithFilters
        .mockResolvedValueOnce(new Array(50).fill(mockPost)) // published
        .mockResolvedValueOnce(new Array(30).fill(mockPost)) // draft
        .mockResolvedValueOnce(new Array(20).fill(mockPost)); // scheduled
      mockCategoryRepo.count.mockResolvedValue(10);
      mockTagRepo.count.mockResolvedValue(25);

      const result = await contentManager.getContentStats();

      expect(result).toEqual({
        totalPosts: 100,
        publishedPosts: 50,
        draftPosts: 30,
        scheduledPosts: 20,
        totalCategories: 10,
        totalTags: 25,
      });
    });
  });
});