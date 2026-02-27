import { BaseRepository } from '../base-repository.js';
import { ValidationError, ConflictError } from '../connection.js';
import { createAuthorSchema, updateAuthorSchema } from '../../validation/schemas.js';
import type { Author } from '../../types/index.js';
import { generateSlug } from '../../utils/data-transform.js';
import type { Database } from '../../supabase.js';

type AuthorRow = Database['public']['Tables']['authors']['Row'];
type CreateAuthorData = Database['public']['Tables']['authors']['Insert'];
type UpdateAuthorData = Database['public']['Tables']['authors']['Update'];

export interface CreateAuthor {
  name: string;
  email: string;
  bio?: string;
  avatarUrl?: string;
  slug?: string;
}

export interface UpdateAuthor {
  name?: string;
  email?: string;
  bio?: string;
  avatarUrl?: string;
  slug?: string;
}

export class AuthorRepository extends BaseRepository<Author, CreateAuthor, UpdateAuthor> {
  private readonly useAdmin: boolean;

  constructor(useAdmin = false) {
    super('authors', useAdmin);
    this.useAdmin = useAdmin;
  }

  private selectColumns(): string {
    return this.useAdmin
      ? '*'
      : 'id,name,slug,bio,avatar_url,created_at,updated_at';
  }

  mapFromDatabase(row: AuthorRow): Author {
    const emailValue = (row as any).email;
    const slugValue = (row as any).slug;
    const fallbackSlugSource = typeof emailValue === 'string'
      ? emailValue.split('@')[0]
      : row.name;
    return {
      id: row.id,
      name: row.name,
      slug: typeof slugValue === 'string' && slugValue.length > 0
        ? slugValue
        : generateSlug(fallbackSlugSource || 'author'),
      email: typeof emailValue === 'string' ? emailValue : undefined,
      bio: row.bio || undefined,
      avatar: row.avatar_url ? {
        id: '', // This would need to be populated from media_assets if needed
        filename: '',
        url: row.avatar_url,
        storagePath: '',
        mimeType: '',
        fileSize: 0,
        createdAt: new Date()
      } : undefined,
      socialLinks: [], // This would need to be populated from a separate table if implemented
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  mapToDatabase(data: CreateAuthor | UpdateAuthor): CreateAuthorData | UpdateAuthorData {
    const mapped: any = {};
    
    if ('name' in data && data.name !== undefined) mapped.name = data.name;
    if ('email' in data && data.email !== undefined) mapped.email = data.email;
    if ('bio' in data) mapped.bio = data.bio || null;
    if ('avatarUrl' in data) mapped.avatar_url = data.avatarUrl || null;
    if ('slug' in data && data.slug) mapped.slug = data.slug;
    
    return mapped;
  }

  async validateCreate(data: CreateAuthor): Promise<void> {
    try {
      createAuthorSchema.parse({
        name: data.name,
        email: data.email,
        bio: data.bio,
      });
    } catch (error: any) {
      throw new ValidationError(`Invalid author data: ${error.message}`);
    }

    // Check for email uniqueness
    const existingAuthor = await this.findByEmail(data.email);
    if (existingAuthor) {
      throw new ConflictError('Author with this email already exists');
    }
  }

  async validateUpdate(data: UpdateAuthor): Promise<void> {
    try {
      updateAuthorSchema.parse({
        name: data.name,
        email: data.email,
        bio: data.bio,
      });
    } catch (error: any) {
      throw new ValidationError(`Invalid author data: ${error.message}`);
    }

    // Check for email uniqueness if email is being updated
    if (data.email) {
      const existingAuthor = await this.findByEmail(data.email);
      if (existingAuthor) {
        throw new ConflictError('Author with this email already exists');
      }
    }
  }

  async findByEmail(email: string): Promise<Author | null> {
    if (!this.useAdmin) {
      throw new ValidationError('Email lookup requires admin access');
    }

    return this.db.executeOptionalQuery(
      async (client) => {
        const result = await client
          .from('authors')
          .select('*')
          .eq('email', email)
          .single();
        
        if (result.data) {
          result.data = this.mapFromDatabase(result.data);
        }
        
        return result;
      },
      'findByEmail authors'
    );
  }

  async findByAuthUserId(authUserId: string): Promise<Author | null> {
    return this.db.executeOptionalQuery(
      async (client) => {
        const result = await client
          .from('authors')
          .select(this.selectColumns())
          .eq('auth_user_id', authUserId)
          .single();

        if (result.data) {
          result.data = this.mapFromDatabase(result.data);
        }

        return result;
      },
      'findByAuthUserId authors'
    );
  }

  async findBySlug(slug: string): Promise<Author | null> {
    return this.db.executeOptionalQuery(
      async (client) => {
        const result = await client
          .from('authors')
          .select(this.selectColumns())
          .eq('slug', slug)
          .single();

        if (result.data) {
          result.data = this.mapFromDatabase(result.data);
        }

        return result;
      },
      'findBySlug authors'
    );
  }

  async findByEmailOrThrow(email: string): Promise<Author> {
    const author = await this.findByEmail(email);
    if (!author) {
      throw new ValidationError(`Author with email ${email} not found`);
    }
    return author;
  }

  async search(query: string, limit = 10, offset = 0): Promise<Author[]> {
    return this.db.executeArrayQuery(
      async (client) => {
        let searchQuery = `name.ilike.%${query}%`;
        if (this.useAdmin) {
          searchQuery += `,email.ilike.%${query}%`;
        }

        const result = await client
          .from('authors')
          .select(this.selectColumns())
          .or(searchQuery)
          .range(offset, offset + limit - 1)
          .order('name');
        
        if (result.data) {
          result.data = result.data.map(row => this.mapFromDatabase(row));
        }
        
        return result;
      },
      'search authors'
    );
  }

  async findById(id: string): Promise<Author | null> {
    return this.db.executeOptionalQuery(
      async (client) => {
        const result = await client
          .from('authors')
          .select(this.selectColumns())
          .eq('id', id)
          .single();

        if (result.data) {
          result.data = this.mapFromDatabase(result.data);
        }

        return result;
      },
      'findById authors'
    );
  }

  async findAll(limit = 50, offset = 0): Promise<Author[]> {
    return this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('authors')
          .select(this.selectColumns())
          .range(offset, offset + limit - 1)
          .order('created_at', { ascending: false });

        if (result.data) {
          result.data = result.data.map(row => this.mapFromDatabase(row));
        }

        return result;
      },
      'findAll authors'
    );
  }

  async create(data: CreateAuthor): Promise<Author> {
    await this.validateCreate(data);
    const slugSource = data.slug || data.email.split('@')[0] || data.name;
    const slug = generateSlug(slugSource || 'author');
    const mappedData = this.mapToDatabase({ ...data, slug });

    return this.db.executeQuery(
      async (client) => {
        const result = await client
          .from('authors')
          .insert(mappedData)
          .select(this.selectColumns())
          .single();

        if (result.data) {
          result.data = this.mapFromDatabase(result.data);
        }

        return result;
      },
      'create authors'
    );
  }

  async update(id: string, data: UpdateAuthor): Promise<Author> {
    await this.validateUpdate(data);
    const mappedData = this.mapToDatabase(data);

    return this.db.executeQuery(
      async (client) => {
        const result = await client
          .from('authors')
          .update(mappedData)
          .eq('id', id)
          .select(this.selectColumns())
          .single();

        if (result.data) {
          result.data = this.mapFromDatabase(result.data);
        }

        return result;
      },
      'update authors'
    );
  }
}
