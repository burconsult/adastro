import { BaseRepository } from '../base-repository.js';
import { ValidationError, ConflictError, NotFoundError } from '../connection.js';
import { createBlogPostSchema, updateBlogPostSchema, postFiltersSchema } from '../../validation/schemas.js';
import { AuthorRepository } from './author-repository.js';
import { CategoryRepository } from './category-repository.js';
import { TagRepository } from './tag-repository.js';
import { MediaRepository } from './media-repository.js';
import type { BlogPost, PostFilters, PostStatus, PostContentBlocks } from '../../types/index.js';
import type { EditorJSData } from '../../editorjs/types.js';
import type { Database } from '../../supabase.js';

type PostRow = Database['public']['Tables']['posts']['Row'];
type CreatePostData = Database['public']['Tables']['posts']['Insert'];
type UpdatePostData = Database['public']['Tables']['posts']['Update'];

export interface CreatePost {
  title: string;
  slug: string;
  content: string;
  blocks?: PostContentBlocks | EditorJSData;
  excerpt?: string;
  authorId: string;
  status?: PostStatus;
  publishedAt?: Date;
  categoryIds?: string[];
  tagIds?: string[];
  featuredImageId?: string;
  audioAssetId?: string;
  seoMetadata?: any;
  customFields?: Record<string, any>;
}

export interface UpdatePost {
  title?: string;
  slug?: string;
  content?: string;
  blocks?: PostContentBlocks | EditorJSData;
  excerpt?: string;
  authorId?: string;
  status?: PostStatus;
  publishedAt?: Date;
  categoryIds?: string[];
  tagIds?: string[];
  featuredImageId?: string;
  audioAssetId?: string;
  seoMetadata?: any;
  customFields?: Record<string, any>;
}

export class PostRepository extends BaseRepository<BlogPost, CreatePost, UpdatePost> {
  private authorRepo: AuthorRepository;
  private categoryRepo: CategoryRepository;
  private tagRepo: TagRepository;
  private mediaRepo: MediaRepository;
  private currentUpdatePostId: string | null = null;

  constructor(useAdmin = false) {
    super('posts', useAdmin);
    this.authorRepo = new AuthorRepository(useAdmin);
    this.categoryRepo = new CategoryRepository(useAdmin);
    this.tagRepo = new TagRepository(useAdmin);
    this.mediaRepo = new MediaRepository(useAdmin);
  }

  mapFromDatabase(row: PostRow): BlogPost {
    // Note: This is a simplified mapping. In practice, you'd need to join
    // with related tables to get the full author, categories, and tags data
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      content: row.content,
      excerpt: row.excerpt || undefined,
      blocks: (row.blocks as PostContentBlocks | EditorJSData | null | undefined) ?? { blocks: [] },
      author: {
        id: row.author_id,
        name: '',
        email: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      }, // This will be populated by the full query methods
      publishedAt: row.published_at ? new Date(row.published_at) : undefined,
      updatedAt: new Date(row.updated_at),
      createdAt: new Date(row.created_at),
      status: row.status as PostStatus,
      categories: [], // Will be populated by full query methods
      tags: [], // Will be populated by full query methods
      featuredImage: undefined, // Will be populated if needed
      featuredImageId: row.featured_image_id || undefined,
      audioAsset: undefined,
      audioAssetId: row.audio_asset_id || undefined,
      seoMetadata: row.seo_metadata || undefined,
      customFields: row.custom_fields || undefined,
    };
  }

  mapToDatabase(data: CreatePost | UpdatePost): CreatePostData | UpdatePostData {
    const mapped: any = {};
    
    if ('title' in data && data.title !== undefined) mapped.title = data.title;
    if ('slug' in data && data.slug !== undefined) mapped.slug = data.slug;
    if ('content' in data && data.content !== undefined) mapped.content = data.content;
    if (Object.prototype.hasOwnProperty.call(data, 'blocks')) mapped.blocks = data.blocks ?? { blocks: [] };
    if ('excerpt' in data) mapped.excerpt = data.excerpt || null;
    if ('authorId' in data && data.authorId !== undefined) mapped.author_id = data.authorId;
    if ('status' in data && data.status !== undefined) mapped.status = data.status;
    if ('publishedAt' in data && data.publishedAt !== undefined) {
      mapped.published_at = data.publishedAt?.toISOString() || null;
    }
    if ('featuredImageId' in data) mapped.featured_image_id = data.featuredImageId || null;
    if ('audioAssetId' in data) mapped.audio_asset_id = data.audioAssetId || null;
    if ('seoMetadata' in data) mapped.seo_metadata = data.seoMetadata || null;
    if ('customFields' in data) mapped.custom_fields = data.customFields || null;
    
    return mapped;
  }

  async validateCreate(data: CreatePost): Promise<void> {
    // Validate basic post data structure
    const validationData = {
      title: data.title,
      slug: data.slug,
      content: data.content,
      excerpt: data.excerpt,
      status: data.status || 'draft',
      seoMetadata: data.seoMetadata,
      customFields: data.customFields,
    };

    try {
      // Note: We're not validating the full schema here since we don't have
      // the complete author/categories/tags objects yet
      if (!data.title || data.title.trim().length === 0) {
        throw new Error('Title is required');
      }
      if (!data.slug || data.slug.trim().length === 0) {
        throw new Error('Slug is required');
      }
      const hasBlocks = Boolean(
        data.blocks &&
        ((Array.isArray(data.blocks) && data.blocks.length > 0) ||
          (typeof data.blocks === 'object' &&
            Array.isArray((data.blocks as EditorJSData).blocks) &&
            (data.blocks as EditorJSData).blocks.length > 0))
      );
      if ((!data.content || data.content.trim().length === 0) && !hasBlocks) {
        throw new Error('Content is required');
      }
      if (!data.authorId) {
        throw new Error('Author ID is required');
      }
    } catch (error: any) {
      throw new ValidationError(`Invalid post data: ${error.message}`);
    }

    // Check for slug uniqueness
    const existingPost = await this.findBySlug(data.slug);
    if (existingPost) {
      throw new ConflictError('Post with this slug already exists');
    }

    // Validate author exists
    const authorExists = await this.authorRepo.exists(data.authorId);
    if (!authorExists) {
      throw new ValidationError('Author does not exist');
    }

    // Validate categories exist if provided
    if (data.categoryIds && data.categoryIds.length > 0) {
      for (const categoryId of data.categoryIds) {
        const categoryExists = await this.categoryRepo.exists(categoryId);
        if (!categoryExists) {
          throw new ValidationError(`Category with ID ${categoryId} does not exist`);
        }
      }
    }

    // Validate tags exist if provided
    if (data.tagIds && data.tagIds.length > 0) {
      for (const tagId of data.tagIds) {
        const tagExists = await this.tagRepo.exists(tagId);
        if (!tagExists) {
          throw new ValidationError(`Tag with ID ${tagId} does not exist`);
        }
      }
    }
  }

  async validateUpdate(data: UpdatePost): Promise<void> {
    try {
      if (data.title !== undefined && data.title.trim().length === 0) {
        throw new Error('Title cannot be empty');
      }
      if (data.slug !== undefined && data.slug.trim().length === 0) {
        throw new Error('Slug cannot be empty');
      }
      const hasBlocks = Boolean(
        data.blocks &&
        ((Array.isArray(data.blocks) && data.blocks.length > 0) ||
          (typeof data.blocks === 'object' &&
            Array.isArray((data.blocks as EditorJSData).blocks) &&
            (data.blocks as EditorJSData).blocks.length > 0))
      );
      if (data.content !== undefined && data.content.trim().length === 0 && !hasBlocks) {
        throw new Error('Content cannot be empty');
      }
    } catch (error: any) {
      throw new ValidationError(`Invalid post data: ${error.message}`);
    }

    // Check for slug uniqueness if slug is being updated
    if (data.slug) {
      const existingPost = await this.findBySlug(data.slug);
      const updatingId = this.currentUpdatePostId;
      if (existingPost && (!updatingId || existingPost.id !== updatingId)) {
        throw new ConflictError('Post with this slug already exists');
      }
    }

    // Validate author exists if being updated
    if (data.authorId) {
      const authorExists = await this.authorRepo.exists(data.authorId);
      if (!authorExists) {
        throw new ValidationError('Author does not exist');
      }
    }

    // Validate categories exist if provided
    if (data.categoryIds && data.categoryIds.length > 0) {
      for (const categoryId of data.categoryIds) {
        const categoryExists = await this.categoryRepo.exists(categoryId);
        if (!categoryExists) {
          throw new ValidationError(`Category with ID ${categoryId} does not exist`);
        }
      }
    }

    // Validate tags exist if provided
    if (data.tagIds && data.tagIds.length > 0) {
      for (const tagId of data.tagIds) {
        const tagExists = await this.tagRepo.exists(tagId);
        if (!tagExists) {
          throw new ValidationError(`Tag with ID ${tagId} does not exist`);
        }
      }
    }
  }

  // Override create to handle relationships
  async create(data: CreatePost): Promise<BlogPost> {
    await this.validateCreate(data);
    
    // Create the post first
    const postData = this.mapToDatabase(data);
    const post = await this.db.executeQuery(
      async (client) => {
        const result = await client
          .from('posts')
          .insert(postData)
          .select()
          .single();
        
        return result;
      },
      'create post'
    );

    // Handle category relationships
    if (data.categoryIds && data.categoryIds.length > 0) {
      await this.updatePostCategories(post.id, data.categoryIds);
    }

    // Handle tag relationships
    if (data.tagIds && data.tagIds.length > 0) {
      await this.updatePostTags(post.id, data.tagIds);
    }

    // Return the full post with relationships
    return this.findByIdWithRelations(post.id) as Promise<BlogPost>;
  }

  // Override update to handle relationships
  async update(id: string, data: UpdatePost): Promise<BlogPost> {
    this.currentUpdatePostId = id;
    try {
      await this.validateUpdate(data);
    } finally {
      this.currentUpdatePostId = null;
    }
    
    // Update the post
    const postData = this.mapToDatabase(data);
    await this.db.executeOptionalQuery(
      async (client) => {
        const result = await client
          .from('posts')
          .update(postData)
          .eq('id', id)
          .select()
          .maybeSingle();
        
        return result;
      },
      'update post'
    );

    // Handle category relationships if provided
    if (data.categoryIds !== undefined) {
      await this.updatePostCategories(id, data.categoryIds);
    }

    // Handle tag relationships if provided
    if (data.tagIds !== undefined) {
      await this.updatePostTags(id, data.tagIds);
    }

    const withRelations = await this.findByIdWithRelations(id);
    if (!withRelations) {
      throw new NotFoundError('Post', id);
    }
    return withRelations;
  }

  async findBySlug(slug: string): Promise<BlogPost | null> {
    const post = await this.db.executeOptionalQuery(
      async (client) => {
        const result = await client
          .from('posts')
          .select('*')
          .eq('slug', slug)
          .maybeSingle();
        
        if (result.data) {
          result.data = this.mapFromDatabase(result.data);
        }
        
        return result;
      },
      'findBySlug posts'
    );

    if (!post) return null;
    return this.populateRelations(post);
  }

  async findBySlugOrThrow(slug: string): Promise<BlogPost> {
    const post = await this.findBySlug(slug);
    if (!post) {
      throw new NotFoundError('Post', slug);
    }
    return post;
  }

  async findByIdWithRelations(id: string): Promise<BlogPost | null> {
    const post = await this.findById(id);
    if (!post) return null;
    return this.populateRelations(post);
  }

  async findWithFilters(filters: PostFilters): Promise<BlogPost[]> {
    // Validate filters
    try {
      postFiltersSchema.parse(filters);
    } catch (error: any) {
      throw new ValidationError(`Invalid filters: ${error.message}`);
    }

    const posts = await this.db.executeArrayQuery(
      async (client) => {
        let query = client
          .from('posts')
          .select('*');

        // Apply filters
        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        if (filters.authorId) {
          query = query.eq('author_id', filters.authorId);
        }
        if (filters.search) {
          query = query.or(`title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`);
        }

        // Collect post ids constrained by taxonomy filters
        let allowedPostIds: string[] | null = null;

        if (filters.categoryId) {
          const { data: categoryRows, error: categoryError } = await client
            .from('post_categories')
            .select('post_id')
            .eq('category_id', filters.categoryId);

          if (categoryError) {
            return { data: null, error: categoryError };
          }

          const categoryPostIds = (categoryRows ?? []).map((row) => row.post_id);

          if (categoryPostIds.length === 0) {
            return { data: [], error: null };
          }

          allowedPostIds = categoryPostIds;
        }

        if (filters.tagId) {
          const { data: tagRows, error: tagError } = await client
            .from('post_tags')
            .select('post_id')
            .eq('tag_id', filters.tagId);

          if (tagError) {
            return { data: null, error: tagError };
          }

          const tagPostIds = (tagRows ?? []).map((row) => row.post_id);

          if (tagPostIds.length === 0) {
            return { data: [], error: null };
          }

          allowedPostIds = allowedPostIds
            ? allowedPostIds.filter((id) => tagPostIds.includes(id))
            : tagPostIds;

          if (allowedPostIds.length === 0) {
            return { data: [], error: null };
          }
        }

        if (allowedPostIds) {
          const uniqueIds = Array.from(new Set(allowedPostIds));
          query = query.in('id', uniqueIds);
        }

        // Apply pagination
        const limit = filters.limit || 10;
        const offset = filters.offset || 0;
        query = query.range(offset, offset + limit - 1);

        // Apply ordering
        query = query.order('created_at', { ascending: false });

        const result = await query;
        
        if (result.data) {
          result.data = result.data.map(row => this.mapFromDatabase(row));
        }
        
        return result;
      },
      'findWithFilters posts'
    );

    // Populate relations for each post
    const postsWithRelations = await Promise.all(
      posts.map(post => this.populateRelations(post))
    );

    return postsWithRelations;
  }

  private async populateRelations(post: BlogPost): Promise<BlogPost> {
    // Get author
    const author = await this.authorRepo.findByIdOrThrow(post.author.id);
    
    // Get categories
    const categories = await this.getPostCategories(post.id);
    
    // Get tags
    const tags = await this.getPostTags(post.id);

    let featuredImage = post.featuredImage;
    if (post.featuredImageId) {
      featuredImage = await this.mediaRepo.findById(post.featuredImageId) ?? undefined;
    }

    let audioAsset = post.audioAsset;
    if (post.audioAssetId) {
      audioAsset = await this.mediaRepo.findById(post.audioAssetId) ?? undefined;
    }

    return {
      ...post,
      author,
      categories,
      tags,
      featuredImage,
      audioAsset,
    };
  }

  private async updatePostCategories(postId: string, categoryIds: string[]): Promise<void> {
    // Remove existing relationships
    await this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('post_categories')
          .delete()
          .eq('post_id', postId)
          .select('post_id');
        return result;
      },
      'delete post categories'
    );

    // Add new relationships
    if (categoryIds.length > 0) {
      const relationships = categoryIds.map(categoryId => ({
        post_id: postId,
        category_id: categoryId,
      }));

      await this.db.executeArrayQuery(
        async (client) => {
          const result = await client
            .from('post_categories')
            .insert(relationships)
            .select('post_id');
          return result;
        },
        'insert post categories'
      );
    }
  }

  private async updatePostTags(postId: string, tagIds: string[]): Promise<void> {
    // Remove existing relationships
    await this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('post_tags')
          .delete()
          .eq('post_id', postId)
          .select('post_id');
        return result;
      },
      'delete post tags'
    );

    // Add new relationships
    if (tagIds.length > 0) {
      const relationships = tagIds.map(tagId => ({
        post_id: postId,
        tag_id: tagId,
      }));

      await this.db.executeArrayQuery(
        async (client) => {
          const result = await client
            .from('post_tags')
            .insert(relationships)
            .select('post_id');
          return result;
        },
        'insert post tags'
      );
    }
  }

  private async getPostCategories(postId: string) {
    return this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('post_categories')
          .select(`
            categories (*)
          `)
          .eq('post_id', postId);
        
        if (result.data) {
          result.data = result.data
            .map((row: any) => row.categories)
            .filter(Boolean)
            .map(row => this.categoryRepo.mapFromDatabase(row));
        }
        
        return result;
      },
      'getPostCategories'
    );
  }

  private async getPostTags(postId: string) {
    return this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('post_tags')
          .select(`
            tags (*)
          `)
          .eq('post_id', postId);
        
        if (result.data) {
          result.data = result.data
            .map((row: any) => row.tags)
            .filter(Boolean)
            .map(row => this.tagRepo.mapFromDatabase(row));
        }
        
        return result;
      },
      'getPostTags'
    );
  }
}
