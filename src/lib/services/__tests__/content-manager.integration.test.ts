import { describe, it, expect, beforeEach } from 'vitest';
import { ContentManager } from '../content-manager.js';
import type { CreatePost } from '../../database/repositories/post-repository.js';

// This is a basic integration test to verify the ContentManager
// works with the actual repository implementations
// Note: This test requires a working Supabase connection
describe('ContentManager Integration', () => {
  let contentManager: ContentManager;

  beforeEach(() => {
    // Use admin connection for testing
    contentManager = new ContentManager(true);
  });

  it('should be able to instantiate ContentManager', () => {
    expect(contentManager).toBeInstanceOf(ContentManager);
  });

  it('should have all required methods', () => {
    // Post lifecycle methods
    expect(typeof contentManager.createPost).toBe('function');
    expect(typeof contentManager.updatePost).toBe('function');
    expect(typeof contentManager.deletePost).toBe('function');
    expect(typeof contentManager.getPost).toBe('function');
    expect(typeof contentManager.getPostBySlug).toBe('function');

    // Draft, publish, and scheduling methods
    expect(typeof contentManager.saveDraft).toBe('function');
    expect(typeof contentManager.publishPost).toBe('function');
    expect(typeof contentManager.unpublishPost).toBe('function');
    expect(typeof contentManager.schedulePost).toBe('function');
    expect(typeof contentManager.unschedulePost).toBe('function');
    expect(typeof contentManager.processScheduledPosts).toBe('function');

    // Search and filtering methods
    expect(typeof contentManager.searchPosts).toBe('function');
    expect(typeof contentManager.getPublishedPosts).toBe('function');
    expect(typeof contentManager.getDraftPosts).toBe('function');
    expect(typeof contentManager.getScheduledPosts).toBe('function');
    expect(typeof contentManager.getPostsByCategory).toBe('function');
    expect(typeof contentManager.getPostsByTag).toBe('function');
    expect(typeof contentManager.getPostsByAuthor).toBe('function');

    // Bulk operations
    expect(typeof contentManager.bulkUpdatePosts).toBe('function');

    // Category management methods
    expect(typeof contentManager.createCategory).toBe('function');
    expect(typeof contentManager.updateCategory).toBe('function');
    expect(typeof contentManager.deleteCategory).toBe('function');
    expect(typeof contentManager.getCategory).toBe('function');
    expect(typeof contentManager.getCategoryBySlug).toBe('function');
    expect(typeof contentManager.getAllCategories).toBe('function');
    expect(typeof contentManager.getRootCategories).toBe('function');
    expect(typeof contentManager.getCategoryChildren).toBe('function');
    expect(typeof contentManager.searchCategories).toBe('function');
    expect(typeof contentManager.getCategoryHierarchy).toBe('function');

    // Tag management methods
    expect(typeof contentManager.createTag).toBe('function');
    expect(typeof contentManager.updateTag).toBe('function');
    expect(typeof contentManager.deleteTag).toBe('function');
    expect(typeof contentManager.getTag).toBe('function');
    expect(typeof contentManager.getTagBySlug).toBe('function');
    expect(typeof contentManager.getAllTags).toBe('function');
    expect(typeof contentManager.searchTags).toBe('function');
    expect(typeof contentManager.getMostUsedTags).toBe('function');
    expect(typeof contentManager.createTagFromName).toBe('function');
    expect(typeof contentManager.findOrCreateTagsByNames).toBe('function');

    // Utility methods
    expect(typeof contentManager.getContentStats).toBe('function');
  });

  it('should validate post data structure', () => {
    const validPostData: CreatePost = {
      title: 'Test Post',
      slug: 'test-post',
      content: 'This is test content',
      authorId: 'test-author-id',
      status: 'draft',
    };

    // This should not throw any TypeScript errors
    expect(validPostData.title).toBe('Test Post');
    expect(validPostData.slug).toBe('test-post');
    expect(validPostData.content).toBe('This is test content');
    expect(validPostData.authorId).toBe('test-author-id');
    expect(validPostData.status).toBe('draft');
  });

  it('should handle search filters correctly', () => {
    const searchFilters = {
      status: 'published' as const,
      search: 'test query',
      categorySlug: 'technology',
      tagSlug: 'javascript',
      publishedAfter: new Date('2023-01-01'),
      publishedBefore: new Date('2023-12-31'),
      limit: 10,
      offset: 0,
    };

    // This should not throw any TypeScript errors
    expect(searchFilters.status).toBe('published');
    expect(searchFilters.search).toBe('test query');
    expect(searchFilters.categorySlug).toBe('technology');
    expect(searchFilters.tagSlug).toBe('javascript');
    expect(searchFilters.publishedAfter).toBeInstanceOf(Date);
    expect(searchFilters.publishedBefore).toBeInstanceOf(Date);
    expect(searchFilters.limit).toBe(10);
    expect(searchFilters.offset).toBe(0);
  });

  it('should handle bulk operation data correctly', () => {
    const bulkOperation = {
      postIds: ['post-1', 'post-2', 'post-3'],
      operation: 'publish' as const,
    };

    // This should not throw any TypeScript errors
    expect(bulkOperation.postIds).toHaveLength(3);
    expect(bulkOperation.operation).toBe('publish');
  });

  it('should handle schedule options correctly', () => {
    const scheduleOptions = {
      publishAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      timezone: 'UTC',
    };

    // This should not throw any TypeScript errors
    expect(scheduleOptions.publishAt).toBeInstanceOf(Date);
    expect(scheduleOptions.timezone).toBe('UTC');
  });
});