import { BaseRepository } from '../base-repository.js';
import { ValidationError, ConflictError } from '../connection.js';
import { createCategorySchema, updateCategorySchema } from '../../validation/schemas.js';
import type { Category } from '../../types/index.js';
import type { Database } from '../../supabase.js';

type CategoryRow = Database['public']['Tables']['categories']['Row'];
type CreateCategoryData = Database['public']['Tables']['categories']['Insert'];
type UpdateCategoryData = Database['public']['Tables']['categories']['Update'];

export interface CreateCategory {
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
}

export interface UpdateCategory {
  name?: string;
  slug?: string;
  description?: string;
  parentId?: string;
}

export class CategoryRepository extends BaseRepository<Category, CreateCategory, UpdateCategory> {
  private currentUpdateCategoryId: string | null = null;

  constructor(useAdmin = false) {
    super('categories', useAdmin);
  }

  mapFromDatabase(row: CategoryRow): Category {
    const category: Category = {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description || undefined,
      parentId: row.parent_id || undefined,
      createdAt: new Date(row.created_at),
    };

    const rawRow: any = row;

    if (typeof rawRow.post_count === 'number') {
      category.postCount = Number(rawRow.post_count) || 0;
    } else if (Array.isArray(rawRow.post_categories)) {
      const aggregate = rawRow.post_categories[0];
      const count = aggregate && typeof aggregate.count !== 'undefined'
        ? Number(aggregate.count)
        : rawRow.post_categories.length;
      if (!Number.isNaN(count)) {
        category.postCount = count;
      }
    }

    return category;
  }

  mapToDatabase(data: CreateCategory | UpdateCategory): CreateCategoryData | UpdateCategoryData {
    const mapped: any = {};
    
    if ('name' in data && data.name !== undefined) mapped.name = data.name;
    if ('slug' in data && data.slug !== undefined) mapped.slug = data.slug;
    if ('description' in data) mapped.description = data.description || null;
    if ('parentId' in data) mapped.parent_id = data.parentId || null;
    
    return mapped;
  }

  async validateCreate(data: CreateCategory): Promise<void> {
    try {
      createCategorySchema.parse(data);
    } catch (error: any) {
      throw new ValidationError(`Invalid category data: ${error.message}`);
    }

    // Check for slug uniqueness
    const existingCategory = await this.findBySlug(data.slug);
    if (existingCategory) {
      throw new ConflictError('Category with this slug already exists');
    }

    // Validate parent category exists if provided
    if (data.parentId) {
      const parentExists = await this.exists(data.parentId);
      if (!parentExists) {
        throw new ValidationError('Parent category does not exist');
      }
    }
  }

  async validateUpdate(data: UpdateCategory): Promise<void> {
    try {
      updateCategorySchema.parse(data);
    } catch (error: any) {
      throw new ValidationError(`Invalid category data: ${error.message}`);
    }

    // Check for slug uniqueness if slug is being updated
    if (data.slug) {
      const existingCategory = await this.findBySlug(data.slug);
      const updatingId = this.currentUpdateCategoryId;
      if (existingCategory && (!updatingId || existingCategory.id !== updatingId)) {
        throw new ConflictError('Category with this slug already exists');
      }
    }

    // Validate parent category exists if provided
    if (data.parentId) {
      const updatingId = this.currentUpdateCategoryId;
      if (updatingId && data.parentId === updatingId) {
        throw new ValidationError('A category cannot be its own parent');
      }

      const parentExists = await this.exists(data.parentId);
      if (!parentExists) {
        throw new ValidationError('Parent category does not exist');
      }
    }
  }

  async update(id: string, data: UpdateCategory): Promise<Category> {
    this.currentUpdateCategoryId = id;
    try {
      await this.validateUpdate(data);
    } finally {
      this.currentUpdateCategoryId = null;
    }

    const mappedData = this.mapToDatabase(data);

    return this.db.executeQuery(
      async (client) => {
        const result = await client
          .from('categories')
          .update(mappedData)
          .eq('id', id)
          .select('*')
          .single();

        if (result.data) {
          result.data = this.mapFromDatabase(result.data);
        }

        return result;
      },
      'update categories'
    );
  }

  async findBySlug(slug: string): Promise<Category | null> {
    return this.db.executeOptionalQuery(
      async (client) => {
        const result = await client
          .from('categories')
          .select('*')
          .eq('slug', slug)
          .single();
        
        if (result.data) {
          result.data = this.mapFromDatabase(result.data);
        }
        
        return result;
      },
      'findBySlug categories'
    );
  }

  async findBySlugOrThrow(slug: string): Promise<Category> {
    const category = await this.findBySlug(slug);
    if (!category) {
      throw new ValidationError(`Category with slug ${slug} not found`);
    }
    return category;
  }

  async findByParentId(parentId: string | null, limit = 50, offset = 0): Promise<Category[]> {
    return this.db.executeArrayQuery(
      async (client) => {
        let query = client
          .from('categories')
          .select('*')
          .range(offset, offset + limit - 1)
          .order('name');

        if (parentId === null) {
          query = query.is('parent_id', null);
        } else {
          query = query.eq('parent_id', parentId);
        }

        const result = await query;
        
        if (result.data) {
          result.data = result.data.map(row => this.mapFromDatabase(row));
        }
        
        return result;
      },
      'findByParentId categories'
    );
  }

  async findRootCategories(limit = 50, offset = 0): Promise<Category[]> {
    return this.findByParentId(null, limit, offset);
  }

  async findChildren(parentId: string, limit = 50, offset = 0): Promise<Category[]> {
    return this.findByParentId(parentId, limit, offset);
  }

  async findAllWithStats(limit = 50, offset = 0): Promise<Array<Category & { postCount: number }>> {
    return this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('categories')
          .select(`
            *,
            post_categories(count)
          `)
          .range(offset, offset + limit - 1)
          .order('name');

        if (result.data) {
          result.data = result.data.map((row: any) => {
            const category = this.mapFromDatabase(row);
            return {
              ...category,
              postCount: category.postCount ?? 0,
            };
          });
        }

        return result;
      },
      'findAllWithStats categories'
    );
  }

  async search(query: string, limit = 10, offset = 0): Promise<Category[]> {
    return this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('categories')
          .select(`
            *,
            post_categories(count)
          `)
          .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
          .range(offset, offset + limit - 1)
          .order('name');
        
        if (result.data) {
          result.data = result.data.map((row: any) => this.mapFromDatabase(row));
        }
        
        return result;
      },
      'search categories'
    );
  }

  // Get category hierarchy (category with all its ancestors)
  async getCategoryHierarchy(categoryId: string): Promise<Category[]> {
    const hierarchy: Category[] = [];
    let currentId: string | undefined = categoryId;

    while (currentId) {
      const category = await this.findByIdOrThrow(currentId);
      hierarchy.unshift(category); // Add to beginning to maintain order
      currentId = category.parentId;
    }

    return hierarchy;
  }

  async getUsageCount(categoryId: string): Promise<number> {
    const result = await this.db.executeQuery(
      async (client) => {
        const { count, error } = await client
          .from('post_categories')
          .select('post_id', { count: 'exact', head: true })
          .eq('category_id', categoryId);

        return {
          data: { count: count ?? 0 },
          error,
        };
      },
      'getCategoryUsageCount'
    );

    return result.count;
  }
}
