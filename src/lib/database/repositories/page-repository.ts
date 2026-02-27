import { BaseRepository } from '../base-repository.js';
import { ValidationError, ConflictError, NotFoundError } from '../connection.js';
import { pageFiltersSchema } from '../../validation/schemas.js';
import { AuthorRepository } from './author-repository.js';
import { PageSectionRepository, type PageSectionInput } from './page-section-repository.js';
import type { Page, PageFilters, PageStatus } from '../../types/index.js';
import type { EditorJSData } from '../../editorjs/types.js';
import type { Database } from '../../supabase.js';

type PageRow = Database['public']['Tables']['pages']['Row'];
type CreatePageData = Database['public']['Tables']['pages']['Insert'];
type UpdatePageData = Database['public']['Tables']['pages']['Update'];

export interface CreatePage {
  title: string;
  slug: string;
  status?: PageStatus;
  template?: string;
  contentBlocks?: EditorJSData;
  contentHtml?: string;
  excerpt?: string;
  authorId?: string | null;
  seoMetadata?: any;
  publishedAt?: Date;
}

export interface UpdatePage {
  title?: string;
  slug?: string;
  status?: PageStatus;
  template?: string;
  contentBlocks?: EditorJSData;
  contentHtml?: string;
  excerpt?: string;
  authorId?: string | null;
  seoMetadata?: any;
  publishedAt?: Date;
}

export class PageRepository extends BaseRepository<Page, CreatePage, UpdatePage> {
  private authorRepo: AuthorRepository;
  private sectionRepo: PageSectionRepository;
  private currentUpdatePageId: string | null = null;

  constructor(useAdmin = false) {
    super('pages', useAdmin);
    this.authorRepo = new AuthorRepository(useAdmin);
    this.sectionRepo = new PageSectionRepository(useAdmin);
  }

  mapFromDatabase(row: PageRow): Page {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status as PageStatus,
      template: row.template,
      contentBlocks: (row.content_blocks as EditorJSData | null | undefined) ?? { blocks: [] },
      contentHtml: row.content_html ?? undefined,
      excerpt: row.excerpt ?? undefined,
      author: row.author_id
        ? {
            id: row.author_id,
            name: '',
            email: '',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        : undefined,
      seoMetadata: row.seo_metadata ?? undefined,
      publishedAt: row.published_at ? new Date(row.published_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      sections: []
    };
  }

  mapToDatabase(data: CreatePage | UpdatePage): CreatePageData | UpdatePageData {
    const mapped: any = {};

    if ('title' in data && data.title !== undefined) mapped.title = data.title;
    if ('slug' in data && data.slug !== undefined) mapped.slug = data.slug;
    if ('status' in data && data.status !== undefined) mapped.status = data.status;
    if ('template' in data && data.template !== undefined) mapped.template = data.template;
    if (Object.prototype.hasOwnProperty.call(data, 'contentBlocks')) {
      mapped.content_blocks = data.contentBlocks ?? { blocks: [] };
    }
    if ('contentHtml' in data) mapped.content_html = data.contentHtml || null;
    if ('excerpt' in data) mapped.excerpt = data.excerpt || null;
    if ('authorId' in data) mapped.author_id = data.authorId ?? null;
    if ('seoMetadata' in data) mapped.seo_metadata = data.seoMetadata || null;
    if ('publishedAt' in data) mapped.published_at = data.publishedAt?.toISOString() || null;

    return mapped;
  }

  async validateCreate(data: CreatePage): Promise<void> {
    try {
      if (!data.title || data.title.trim().length === 0) {
        throw new Error('Title is required');
      }
      if (!data.slug || data.slug.trim().length === 0) {
        throw new Error('Slug is required');
      }
    } catch (error: any) {
      throw new ValidationError(`Invalid page data: ${error.message}`);
    }

    const existingPage = await this.findBySlug(data.slug);
    if (existingPage) {
      throw new ConflictError('Page with this slug already exists');
    }

    if (data.authorId) {
      const authorExists = await this.authorRepo.exists(data.authorId);
      if (!authorExists) {
        throw new ValidationError('Author does not exist');
      }
    }
  }

  async validateUpdate(data: UpdatePage): Promise<void> {
    try {
      if (data.title !== undefined && data.title.trim().length === 0) {
        throw new Error('Title cannot be empty');
      }
      if (data.slug !== undefined && data.slug.trim().length === 0) {
        throw new Error('Slug cannot be empty');
      }
    } catch (error: any) {
      throw new ValidationError(`Invalid page data: ${error.message}`);
    }

    if (data.slug) {
      const existingPage = await this.findBySlug(data.slug);
      const updatingId = this.currentUpdatePageId;
      if (existingPage && (!updatingId || existingPage.id !== updatingId)) {
        throw new ConflictError('Page with this slug already exists');
      }
    }

    if (data.authorId) {
      const authorExists = await this.authorRepo.exists(data.authorId);
      if (!authorExists) {
        throw new ValidationError('Author does not exist');
      }
    }
  }

  async findBySlug(slug: string): Promise<Page | null> {
    const page = await this.db.executeOptionalQuery(
      async (client) => {
        const result = await client
          .from('pages')
          .select('*')
          .eq('slug', slug)
          .maybeSingle();

        if (result.data) {
          result.data = this.mapFromDatabase(result.data);
        }

        return result;
      },
      'findBySlug pages'
    );

    if (!page) return null;
    return this.populateRelations(page);
  }

  async findBySlugOrThrow(slug: string): Promise<Page> {
    const page = await this.findBySlug(slug);
    if (!page) {
      throw new NotFoundError('Page', slug);
    }
    return page;
  }

  async findByIdWithRelations(id: string): Promise<Page | null> {
    const page = await this.findById(id);
    if (!page) return null;
    return this.populateRelations(page);
  }

  async findWithFilters(filters: PageFilters): Promise<Page[]> {
    try {
      pageFiltersSchema.parse(filters);
    } catch (error: any) {
      throw new ValidationError(`Invalid filters: ${error.message}`);
    }

    const pages = await this.db.executeArrayQuery(
      async (client) => {
        let query = client.from('pages').select('*');

        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        if (filters.authorId) {
          query = query.eq('author_id', filters.authorId);
        }
        if (filters.search) {
          query = query.or(`title.ilike.%${filters.search}%,slug.ilike.%${filters.search}%`);
        }

        if (filters.limit !== undefined) {
          const offset = filters.offset || 0;
          query = query.range(offset, offset + filters.limit - 1);
        }

        query = query.order('updated_at', { ascending: false });

        const result = await query;
        if (result.data) {
          result.data = result.data.map((row) => this.mapFromDatabase(row));
        }

        return result;
      },
      'findWithFilters pages'
    );

    const hydrated = [];
    for (const page of pages) {
      hydrated.push(await this.populateRelations(page));
    }

    return hydrated;
  }

  async updateWithSections(id: string, data: UpdatePage, sections: PageSectionInput[]): Promise<Page> {
    this.currentUpdatePageId = id;
    try {
      const updated = await this.update(id, data);
      await this.sectionRepo.replaceForPage(id, sections);
      return await this.findByIdWithRelations(updated.id) as Page;
    } finally {
      this.currentUpdatePageId = null;
    }
  }

  async createWithSections(data: CreatePage, sections: PageSectionInput[]): Promise<Page> {
    const page = await this.create(data);
    await this.sectionRepo.replaceForPage(page.id, sections);
    return await this.findByIdWithRelations(page.id) as Page;
  }

  private async populateRelations(page: Page): Promise<Page> {
    const author = page.author?.id ? await this.authorRepo.findById(page.author.id) : null;
    const sections = await this.sectionRepo.findByPageId(page.id);

    return {
      ...page,
      author: author ?? page.author,
      sections
    };
  }
}
