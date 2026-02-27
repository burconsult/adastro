import { PostRepository } from '../database/repositories/post-repository.js';
import type { CreatePost, UpdatePost } from '../database/repositories/post-repository.js';
import { CategoryRepository } from '../database/repositories/category-repository.js';
import type { CreateCategory, UpdateCategory } from '../database/repositories/category-repository.js';
import { TagRepository } from '../database/repositories/tag-repository.js';
import type { CreateTag, UpdateTag } from '../database/repositories/tag-repository.js';
import { ValidationError, NotFoundError } from '../database/connection.js';
import type { BlogPost, Category, Tag, PostFilters, PostStatus } from '../types/index.js';

export interface ContentSearchFilters extends PostFilters {
  publishedAfter?: Date;
  publishedBefore?: Date;
  categorySlug?: string;
  tagSlug?: string;
}

export interface PostScheduleOptions {
  publishAt: Date;
  timezone?: string;
}

export interface BulkPostOperation {
  postIds: string[];
  operation: 'publish' | 'unpublish' | 'delete' | 'updateStatus';
  status?: PostStatus;
}

export class ContentManager {
  private postRepo: PostRepository;
  private categoryRepo: CategoryRepository;
  private tagRepo: TagRepository;

  constructor(useAdmin = false) {
    this.postRepo = new PostRepository(useAdmin);
    this.categoryRepo = new CategoryRepository(useAdmin);
    this.tagRepo = new TagRepository(useAdmin);
  }

  // Post lifecycle management
  async createPost(data: CreatePost): Promise<BlogPost> {
    return this.postRepo.create(data);
  }

  async updatePost(id: string, data: UpdatePost): Promise<BlogPost> {
    return this.postRepo.update(id, data);
  }

  async deletePost(id: string): Promise<void> {
    return this.postRepo.delete(id);
  }

  async getPost(id: string): Promise<BlogPost | null> {
    return this.postRepo.findByIdWithRelations(id);
  }

  async getPostOrThrow(id: string): Promise<BlogPost> {
    const post = await this.getPost(id);
    if (!post) {
      throw new NotFoundError('Post', id);
    }
    return post;
  }

  async getPostBySlug(slug: string): Promise<BlogPost | null> {
    return this.postRepo.findBySlug(slug);
  }

  async getPostBySlugOrThrow(slug: string): Promise<BlogPost> {
    return this.postRepo.findBySlugOrThrow(slug);
  }

  // Draft, publish, and scheduling functionality
  async saveDraft(data: CreatePost | (UpdatePost & { id: string })): Promise<BlogPost> {
    const draftData = { ...data, status: 'draft' as PostStatus };

    if ('id' in data && data.id) {
      const { id, ...updateData } = draftData;
      return this.updatePost(id, updateData);
    } else {
      return this.createPost(draftData);
    }
  }

  async publishPost(id: string, publishAt?: Date): Promise<BlogPost> {
    const post = await this.getPostOrThrow(id);

    if (post.status === 'published') {
      throw new ValidationError('Post is already published');
    }

    const updateData: UpdatePost = {
      status: 'published',
      publishedAt: publishAt || new Date(),
    };

    return this.updatePost(id, updateData);
  }

  async unpublishPost(id: string): Promise<BlogPost> {
    const post = await this.getPostOrThrow(id);

    if (post.status !== 'published') {
      throw new ValidationError('Post is not published');
    }

    const updateData: UpdatePost = {
      status: 'draft',
      publishedAt: undefined,
    };

    return this.updatePost(id, updateData);
  }

  async schedulePost(id: string, options: PostScheduleOptions): Promise<BlogPost> {
    const post = await this.getPostOrThrow(id);

    if (post.status === 'published') {
      throw new ValidationError('Cannot schedule an already published post');
    }

    if (options.publishAt <= new Date()) {
      throw new ValidationError('Scheduled publish date must be in the future');
    }

    const updateData: UpdatePost = {
      status: 'scheduled',
      publishedAt: options.publishAt,
    };

    return this.updatePost(id, updateData);
  }

  async unschedulePost(id: string): Promise<BlogPost> {
    const post = await this.getPostOrThrow(id);

    if (post.status !== 'scheduled') {
      throw new ValidationError('Post is not scheduled');
    }

    const updateData: UpdatePost = {
      status: 'draft',
      publishedAt: undefined,
    };

    return this.updatePost(id, updateData);
  }

  // Process scheduled posts (to be called by a cron job or similar)
  async processScheduledPosts(): Promise<BlogPost[]> {
    const now = new Date();
    const scheduledPosts = await this.postRepo.findWithFilters({
      status: 'scheduled',
      limit: 100, // Process in batches
    });

    const publishedPosts: BlogPost[] = [];

    for (const post of scheduledPosts) {
      if (post.publishedAt && post.publishedAt <= now) {
        try {
          const publishedPost = await this.updatePost(post.id, {
            status: 'published',
          });
          publishedPosts.push(publishedPost);
        } catch (error) {
          console.error(`Failed to publish scheduled post ${post.id}:`, error);
        }
      }
    }

    return publishedPosts;
  }

  // Content search and filtering
  async searchPosts(filters: ContentSearchFilters): Promise<BlogPost[]> {
    // Convert enhanced filters to base PostFilters
    const baseFilters: PostFilters = {
      status: filters.status,
      authorId: filters.authorId,
      search: filters.search,
      limit: filters.limit,
      offset: filters.offset,
    };

    // Handle category slug filter
    if (filters.categorySlug) {
      const category = await this.categoryRepo.findBySlug(filters.categorySlug);
      if (category) {
        baseFilters.categoryId = category.id;
      } else {
        // Return empty results if category doesn't exist
        return [];
      }
    } else if (filters.categoryId) {
      baseFilters.categoryId = filters.categoryId;
    }

    // Handle tag slug filter
    if (filters.tagSlug) {
      const tag = await this.tagRepo.findBySlug(filters.tagSlug);
      if (tag) {
        baseFilters.tagId = tag.id;
      } else {
        // Return empty results if tag doesn't exist
        return [];
      }
    } else if (filters.tagId) {
      baseFilters.tagId = filters.tagId;
    }

    let posts = await this.postRepo.findWithFilters(baseFilters);

    // Apply date range filters (post-query filtering for now)
    if (filters.publishedAfter || filters.publishedBefore) {
      posts = posts.filter(post => {
        if (!post.publishedAt) return false;

        if (filters.publishedAfter && post.publishedAt < filters.publishedAfter) {
          return false;
        }

        if (filters.publishedBefore && post.publishedAt > filters.publishedBefore) {
          return false;
        }

        return true;
      });
    }

    return posts;
  }

  async getPublishedPosts(limit = 10, offset = 0): Promise<BlogPost[]> {
    return this.searchPosts({
      status: 'published',
      limit,
      offset,
    });
  }

  async getDraftPosts(authorId?: string, limit = 10, offset = 0): Promise<BlogPost[]> {
    return this.searchPosts({
      status: 'draft',
      authorId,
      limit,
      offset,
    });
  }

  async getScheduledPosts(limit = 10, offset = 0): Promise<BlogPost[]> {
    return this.searchPosts({
      status: 'scheduled',
      limit,
      offset,
    });
  }

  async getPostsByCategory(categorySlug: string, limit = 10, offset = 0): Promise<BlogPost[]> {
    return this.searchPosts({
      categorySlug,
      status: 'published',
      limit,
      offset,
    });
  }

  async getPostsByTag(tagSlug: string, limit = 10, offset = 0): Promise<BlogPost[]> {
    return this.searchPosts({
      tagSlug,
      status: 'published',
      limit,
      offset,
    });
  }

  async getPostsByAuthor(authorId: string, limit = 10, offset = 0): Promise<BlogPost[]> {
    return this.searchPosts({
      authorId,
      status: 'published',
      limit,
      offset,
    });
  }

  // Bulk operations
  async bulkUpdatePosts(operation: BulkPostOperation): Promise<BlogPost[]> {
    const updatedPosts: BlogPost[] = [];

    for (const postId of operation.postIds) {
      try {
        let updatedPost: BlogPost;

        switch (operation.operation) {
          case 'publish':
            updatedPost = await this.publishPost(postId);
            break;
          case 'unpublish':
            updatedPost = await this.unpublishPost(postId);
            break;
          case 'delete':
            await this.deletePost(postId);
            continue; // Skip adding to results for deleted posts
          case 'updateStatus':
            if (!operation.status) {
              throw new ValidationError('Status is required for updateStatus operation');
            }
            updatedPost = await this.updatePost(postId, { status: operation.status });
            break;
          default:
            throw new ValidationError(`Unknown bulk operation: ${operation.operation}`);
        }

        updatedPosts.push(updatedPost);
      } catch (error) {
        console.error(`Failed to perform ${operation.operation} on post ${postId}:`, error);
        // Continue with other posts even if one fails
      }
    }

    return updatedPosts;
  }

  // Category management operations
  async createCategory(data: CreateCategory): Promise<Category> {
    return this.categoryRepo.create(data);
  }

  async updateCategory(id: string, data: UpdateCategory): Promise<Category> {
    return this.categoryRepo.update(id, data);
  }

  async deleteCategory(id: string): Promise<void> {
    return this.categoryRepo.delete(id);
  }

  async getCategory(id: string): Promise<Category | null> {
    return this.categoryRepo.findById(id);
  }

  async getCategoryOrThrow(id: string): Promise<Category> {
    return this.categoryRepo.findByIdOrThrow(id);
  }

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    return this.categoryRepo.findBySlug(slug);
  }

  async getCategoryBySlugOrThrow(slug: string): Promise<Category> {
    return this.categoryRepo.findBySlugOrThrow(slug);
  }

  async getAllCategories(limit = 50, offset = 0): Promise<Category[]> {
    return this.categoryRepo.findAll(limit, offset);
  }

  async getRootCategories(limit = 50, offset = 0): Promise<Category[]> {
    return this.categoryRepo.findRootCategories(limit, offset);
  }

  async getCategoryChildren(parentId: string, limit = 50, offset = 0): Promise<Category[]> {
    return this.categoryRepo.findChildren(parentId, limit, offset);
  }

  async searchCategories(query: string, limit = 10, offset = 0): Promise<Category[]> {
    return this.categoryRepo.search(query, limit, offset);
  }

  async getCategoryHierarchy(categoryId: string): Promise<Category[]> {
    return this.categoryRepo.getCategoryHierarchy(categoryId);
  }

  // Tag management operations
  async createTag(data: CreateTag): Promise<Tag> {
    return this.tagRepo.create(data);
  }

  async updateTag(id: string, data: UpdateTag): Promise<Tag> {
    return this.tagRepo.update(id, data);
  }

  async deleteTag(id: string): Promise<void> {
    return this.tagRepo.delete(id);
  }

  async getTag(id: string): Promise<Tag | null> {
    return this.tagRepo.findById(id);
  }

  async getTagOrThrow(id: string): Promise<Tag> {
    return this.tagRepo.findByIdOrThrow(id);
  }

  async getTagBySlug(slug: string): Promise<Tag | null> {
    return this.tagRepo.findBySlug(slug);
  }

  async getTagBySlugOrThrow(slug: string): Promise<Tag> {
    return this.tagRepo.findBySlugOrThrow(slug);
  }

  async getAllTags(limit = 50, offset = 0): Promise<Tag[]> {
    return this.tagRepo.findAll(limit, offset);
  }

  async searchTags(query: string, limit = 10, offset = 0): Promise<Tag[]> {
    return this.tagRepo.search(query, limit, offset);
  }

  async getMostUsedTags(limit = 20): Promise<Array<Tag & { postCount: number }>> {
    return this.tagRepo.findMostUsed(limit);
  }

  async createTagFromName(name: string): Promise<Tag> {
    return this.tagRepo.createFromName(name);
  }

  async findOrCreateTagsByNames(names: string[]): Promise<Tag[]> {
    return this.tagRepo.findOrCreateByNames(names);
  }

  // Utility methods
  async getContentStats(): Promise<{
    totalPosts: number;
    publishedPosts: number;
    draftPosts: number;
    scheduledPosts: number;
    totalCategories: number;
    totalTags: number;
  }> {
    const [
      totalPosts,
      publishedPosts,
      draftPosts,
      scheduledPosts,
      totalCategories,
      totalTags,
    ] = await Promise.all([
      this.postRepo.count(),
      this.countPostsByStatus('published'),
      this.countPostsByStatus('draft'),
      this.countPostsByStatus('scheduled'),
      this.categoryRepo.count(),
      this.tagRepo.count(),
    ]);

    return {
      totalPosts,
      publishedPosts,
      draftPosts,
      scheduledPosts,
      totalCategories,
      totalTags,
    };
  }

  private async countPostsByStatus(status: PostStatus): Promise<number> {
    const posts = await this.postRepo.findWithFilters({ status, limit: 1000 }); // Large limit to get all
    return posts.length;
  }
}
