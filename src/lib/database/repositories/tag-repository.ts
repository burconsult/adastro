import { BaseRepository } from '../base-repository.js';
import { ValidationError, ConflictError } from '../connection.js';
import { createTagSchema, updateTagSchema } from '../../validation/schemas.js';
import type { Tag } from '../../types/index.js';
import type { Database } from '../../supabase.js';

type TagRow = Database['public']['Tables']['tags']['Row'];
type CreateTagData = Database['public']['Tables']['tags']['Insert'];
type UpdateTagData = Database['public']['Tables']['tags']['Update'];

export interface CreateTag {
  name: string;
  slug: string;
}

export interface UpdateTag {
  name?: string;
  slug?: string;
}

export class TagRepository extends BaseRepository<Tag, CreateTag, UpdateTag> {
  private currentUpdateTagId: string | null = null;

  constructor(useAdmin = false) {
    super('tags', useAdmin);
  }

  mapFromDatabase(row: TagRow): Tag {
    const tag: Tag = {
      id: row.id,
      name: row.name,
      slug: row.slug,
      createdAt: new Date(row.created_at),
    };

    const rawRow: any = row;

    if (typeof rawRow.post_count === 'number') {
      tag.postCount = Number(rawRow.post_count) || 0;
    } else if (Array.isArray(rawRow.post_tags)) {
      const aggregate = rawRow.post_tags[0];
      const count = aggregate && typeof aggregate.count !== 'undefined'
        ? Number(aggregate.count)
        : rawRow.post_tags.length;
      if (!Number.isNaN(count)) {
        tag.postCount = count;
      }
    }

    return tag;
  }

  mapToDatabase(data: CreateTag | UpdateTag): CreateTagData | UpdateTagData {
    const mapped: any = {};
    
    if ('name' in data && data.name !== undefined) mapped.name = data.name;
    if ('slug' in data && data.slug !== undefined) mapped.slug = data.slug;
    
    return mapped;
  }

  async validateCreate(data: CreateTag): Promise<void> {
    try {
      createTagSchema.parse(data);
    } catch (error: any) {
      throw new ValidationError(`Invalid tag data: ${error.message}`);
    }

    // Check for slug uniqueness
    const existingTag = await this.findBySlug(data.slug);
    if (existingTag) {
      throw new ConflictError('Tag with this slug already exists');
    }
  }

  async validateUpdate(data: UpdateTag): Promise<void> {
    try {
      updateTagSchema.parse(data);
    } catch (error: any) {
      throw new ValidationError(`Invalid tag data: ${error.message}`);
    }

    // Check for slug uniqueness if slug is being updated
    if (data.slug) {
      const existingTag = await this.findBySlug(data.slug);
      const updatingId = this.currentUpdateTagId;
      if (existingTag && (!updatingId || existingTag.id !== updatingId)) {
        throw new ConflictError('Tag with this slug already exists');
      }
    }
  }

  async update(id: string, data: UpdateTag): Promise<Tag> {
    this.currentUpdateTagId = id;
    try {
      await this.validateUpdate(data);
    } finally {
      this.currentUpdateTagId = null;
    }

    const mappedData = this.mapToDatabase(data);

    return this.db.executeQuery(
      async (client) => {
        const result = await client
          .from('tags')
          .update(mappedData)
          .eq('id', id)
          .select('*')
          .single();

        if (result.data) {
          result.data = this.mapFromDatabase(result.data);
        }

        return result;
      },
      'update tags'
    );
  }

  async findBySlug(slug: string): Promise<Tag | null> {
    return this.db.executeOptionalQuery(
      async (client) => {
        const result = await client
          .from('tags')
          .select('*')
          .eq('slug', slug)
          .single();
        
        if (result.data) {
          result.data = this.mapFromDatabase(result.data);
        }
        
        return result;
      },
      'findBySlug tags'
    );
  }

  async findBySlugOrThrow(slug: string): Promise<Tag> {
    const tag = await this.findBySlug(slug);
    if (!tag) {
      throw new ValidationError(`Tag with slug ${slug} not found`);
    }
    return tag;
  }

  async findBySlugs(slugs: string[]): Promise<Tag[]> {
    if (slugs.length === 0) return [];

    return this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('tags')
          .select('*')
          .in('slug', slugs)
          .order('name');
        
        if (result.data) {
          result.data = result.data.map(row => this.mapFromDatabase(row));
        }
        
        return result;
      },
      'findBySlugs tags'
    );
  }

  async search(query: string, limit = 10, offset = 0): Promise<Tag[]> {
    return this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('tags')
          .select(`
            *,
            post_tags(count)
          `)
          .ilike('name', `%${query}%`)
          .range(offset, offset + limit - 1)
          .order('name');
        
        if (result.data) {
          result.data = result.data.map((row: any) => this.mapFromDatabase(row));
        }
        
        return result;
      },
      'search tags'
    );
  }

  async findMostUsed(limit = 20): Promise<Array<Tag & { postCount: number }>> {
    return this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('tags')
          .select(`
            *,
            post_tags!inner(count)
          `)
          .limit(limit)
          .order('post_tags.count', { ascending: false });
        
        if (result.data) {
          result.data = result.data.map((row: any) => ({
            ...this.mapFromDatabase(row),
            postCount: Array.isArray(row.post_tags)
              ? Number(row.post_tags[0]?.count) || 0
              : 0
          }));
        }
        
        return result;
      },
      'findMostUsed tags'
    );
  }

  // Get tag statistics
  async getTagStats(): Promise<{
    totalTags: number;
    usedTags: number;
    unusedTags: number;
    averagePostsPerTag: number;
    mostUsedTag?: Tag & { postCount: number };
  }> {
    return this.db.executeQuery(
      async (client) => {
        // Get total count
        const totalResult = await client
          .from('tags')
          .select('*', { count: 'exact', head: true });

        // Get tags with post counts
        const statsResult = await client
          .from('tags')
          .select(`
            *,
            post_tags(count)
          `)
          .order('name');

        const totalTags = totalResult.count || 0;
        const tagsWithStats = statsResult.data?.map((row: any) => ({
          ...this.mapFromDatabase(row),
          postCount: row.post_tags?.length || 0
        })) || [];

        const usedTags = tagsWithStats.filter(tag => tag.postCount > 0).length;
        const unusedTags = totalTags - usedTags;
        const totalPosts = tagsWithStats.reduce((sum, tag) => sum + tag.postCount, 0);
        const averagePostsPerTag = usedTags > 0 ? totalPosts / usedTags : 0;
        const mostUsedTag = tagsWithStats.reduce((max, tag) => 
          tag.postCount > (max?.postCount || 0) ? tag : max, 
          undefined as (Tag & { postCount: number }) | undefined
        );

        return {
          data: {
            totalTags,
            usedTags,
            unusedTags,
            averagePostsPerTag: Math.round(averagePostsPerTag * 100) / 100,
            mostUsedTag
          }
        };
      },
      'getTagStats'
    );
  }

  // Bulk operations
  async bulkDelete(tagIds: string[]): Promise<{ success: string[]; failed: Array<{ id: string; error: string }> }> {
    const success: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const tagId of tagIds) {
      try {
        await this.delete(tagId);
        success.push(tagId);
      } catch (error) {
        failed.push({
          id: tagId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return { success, failed };
  }

  async bulkUpdate(updates: Array<{ id: string; data: UpdateTag }>): Promise<{ success: string[]; failed: Array<{ id: string; error: string }> }> {
    const success: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const update of updates) {
      try {
        await this.update(update.id, update.data);
        success.push(update.id);
      } catch (error) {
        failed.push({
          id: update.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return { success, failed };
  }

  // Merge tags - move all posts from source tags to target tag, then delete source tags
  async mergeTags(targetTagId: string, sourceTagIds: string[]): Promise<{
    mergedPosts: number;
    deletedTags: string[];
    errors: Array<{ tagId: string; error: string }>;
  }> {
    const deletedTags: string[] = [];
    const errors: Array<{ tagId: string; error: string }> = [];
    let mergedPosts = 0;

    // Verify target tag exists
    const targetTag = await this.findById(targetTagId);
    if (!targetTag) {
      throw new ValidationError('Target tag not found');
    }

    for (const sourceTagId of sourceTagIds) {
      try {
        // Get all posts associated with source tag
        const postTagsResult = await this.db.executeArrayQuery(
          async (client) => {
            const result = await client
              .from('post_tags')
              .select('post_id')
              .eq('tag_id', sourceTagId);
            return result;
          },
          'get post_tags for merge'
        );

        const postIds = postTagsResult.map((pt: any) => pt.post_id);

        // Move posts to target tag (avoiding duplicates)
        for (const postId of postIds) {
          try {
            // Check if post is already associated with target tag
            const existingAssociation = await this.db.executeOptionalQuery(
              async (client) => {
                const result = await client
                  .from('post_tags')
                  .select('*')
                  .eq('post_id', postId)
                  .eq('tag_id', targetTagId)
                  .single();
                return result;
              },
              'check existing post_tag association'
            );

            if (!existingAssociation) {
              // Create new association with target tag
              await this.db.executeQuery(
                async (client) => {
                  const result = await client
                    .from('post_tags')
                    .insert({ post_id: postId, tag_id: targetTagId });
                  return result;
                },
                'create post_tag association'
              );
              mergedPosts++;
            }

            // Remove association with source tag
            await this.db.executeQuery(
              async (client) => {
                const result = await client
                  .from('post_tags')
                  .delete()
                  .eq('post_id', postId)
                  .eq('tag_id', sourceTagId);
                return result;
              },
              'remove source post_tag association'
            );
          } catch (error) {
            console.error(`Error moving post ${postId} from tag ${sourceTagId}:`, error);
          }
        }

        // Delete source tag
        await this.delete(sourceTagId);
        deletedTags.push(sourceTagId);
      } catch (error) {
        errors.push({
          tagId: sourceTagId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return { mergedPosts, deletedTags, errors };
  }

  // Find unused tags (tags with no posts)
  async findUnused(limit = 50, offset = 0): Promise<Tag[]> {
    return this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('tags')
          .select(`
            *,
            post_tags(count)
          `)
          .range(offset, offset + limit - 1)
          .order('name');
        
        if (result.data) {
          result.data = result.data
            .filter((row: any) => !row.post_tags || row.post_tags.length === 0)
            .map(row => this.mapFromDatabase(row));
        }
        
        return result;
      },
      'findUnused tags'
    );
  }

  // Utility method to create tag from name (auto-generates slug)
  async createFromName(name: string): Promise<Tag> {
    const slug = this.generateSlug(name);
    return this.create({ name, slug });
  }

  // Get tags with usage statistics
  async findAllWithStats(limit = 100, offset = 0): Promise<Array<Tag & { postCount: number }>> {
    return this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('tags')
          .select(`
            *,
            post_tags(count)
          `)
          .range(offset, offset + limit - 1)
          .order('name');
        
        if (result.data) {
          result.data = result.data.map((row: any) => ({
            ...this.mapFromDatabase(row),
            postCount: Array.isArray(row.post_tags)
              ? Number(row.post_tags[0]?.count) || 0
              : 0
          }));
        }
        
        return result;
      },
      'findAllWithStats tags'
    );
  }

  // Utility method to find or create tags by names
  async findOrCreateByNames(names: string[]): Promise<Tag[]> {
    const tags: Tag[] = [];
    
    for (const name of names) {
      const slug = this.generateSlug(name);
      let tag = await this.findBySlug(slug);
      
      if (!tag) {
        tag = await this.create({ name, slug });
      }
      
      tags.push(tag);
    }
    
    return tags;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  async getUsageCount(tagId: string): Promise<number> {
    const result = await this.db.executeQuery(
      async (client) => {
        const { count, error } = await client
          .from('post_tags')
          .select('post_id', { count: 'exact', head: true })
          .eq('tag_id', tagId);

        return {
          data: { count: count ?? 0 },
          error,
        };
      },
      'getTagUsageCount'
    );

    return result.count;
  }
}
