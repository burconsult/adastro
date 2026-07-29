import { BaseRepository } from '../base-repository.js';
import { ValidationError, ConflictError, NotFoundError } from '../connection.js';
import { pageFiltersSchema } from '../../validation/schemas.js';
import { AuthorRepository } from './author-repository.js';
import { PageSectionRepository, type PageSectionInput } from './page-section-repository.js';
import type { ContentVersion, Page, PageFilters, PageStatus } from '../../types/index.js';
import type { EditorJSData } from '../../editorjs/types.js';
import type { Database } from '../../supabase.js';
import { DEFAULT_LOCALE, normalizeLocaleCode } from '../../i18n/locales.js';

type PageRow = Database['public']['Tables']['pages']['Row'];
type CreatePageData = Database['public']['Tables']['pages']['Insert'];
type UpdatePageData = Database['public']['Tables']['pages']['Update'];
type PageVersionRow = Database['public']['Tables']['page_versions']['Row'];

export type PageSnapshot = {
  schemaVersion: 1;
  title: string;
  slug: string;
  locale: string;
  status: PageStatus;
  template: string;
  contentBlocks: EditorJSData;
  contentHtml?: string;
  excerpt?: string;
  authorId?: string | null;
  seoMetadata?: any;
  publishedAt?: string;
  sections: PageSectionInput[];
};

type SaveOptions = {
  actorAuthorId?: string | null;
  skipVersion?: boolean;
};

type RestoreOptions = {
  actorAuthorId?: string | null;
  preserveAuthorId?: boolean;
};

export interface CreatePage {
  title: string;
  slug: string;
  locale?: string;
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
  locale?: string;
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
  private currentUpdatePageSlug: string | null = null;
  private currentUpdatePageLocale: string | null = null;

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
      locale: row.locale || DEFAULT_LOCALE,
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
    if ('locale' in data && data.locale !== undefined) mapped.locale = normalizeLocaleCode(data.locale, DEFAULT_LOCALE);
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
    const locale = normalizeLocaleCode(data.locale, DEFAULT_LOCALE);

    try {
      if (!data.title || data.title.trim().length === 0) {
        throw new Error('Title is required');
      }
      if (!data.slug || data.slug.trim().length === 0) {
        throw new Error('Slug is required');
      }
      if (!locale) {
        throw new Error('Locale is required');
      }
    } catch (error: any) {
      throw new ValidationError(`Invalid page data: ${error.message}`);
    }

    const existingPage = await this.findBySlug(data.slug, locale);
    if (existingPage) {
      throw new ConflictError('Page with this slug already exists for the selected locale');
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

    if (data.slug || data.locale) {
      const targetSlug = (data.slug ?? this.currentUpdatePageSlug ?? '').trim();
      const targetLocale = normalizeLocaleCode(data.locale ?? this.currentUpdatePageLocale, DEFAULT_LOCALE);
      if (targetSlug) {
        const existingPage = await this.findBySlug(targetSlug, targetLocale);
        const updatingId = this.currentUpdatePageId;
        if (existingPage && (!updatingId || existingPage.id !== updatingId)) {
          throw new ConflictError('Page with this slug already exists for the selected locale');
        }
      }
    }

    if (data.authorId) {
      const authorExists = await this.authorRepo.exists(data.authorId);
      if (!authorExists) {
        throw new ValidationError('Author does not exist');
      }
    }
  }

  async create(data: CreatePage, options: SaveOptions = {}): Promise<Page> {
    const payload: CreatePage = {
      ...data,
      locale: normalizeLocaleCode(data.locale, DEFAULT_LOCALE)
    };
    await this.validateCreate(payload);

    const mapped = this.mapToDatabase(payload);
    const row = await this.db.executeQuery(
      async (client) => {
        const result = await client
          .from('pages')
          .insert(mapped)
          .select()
          .single();
        return result;
      },
      'create page'
    );

    const created = await this.findByIdWithRelations(row.id) as Page;
    if (!options.skipVersion) {
      await this.createVersion(created, options.actorAuthorId ?? null);
    }
    return created;
  }

  async update(id: string, data: UpdatePage, options: SaveOptions = {}): Promise<Page> {
    const existingPage = await this.findById(id);
    if (!existingPage) {
      throw new NotFoundError('Page', id);
    }

    this.currentUpdatePageId = id;
    this.currentUpdatePageSlug = existingPage.slug;
    this.currentUpdatePageLocale = existingPage.locale;
    try {
      await this.validateUpdate(data);
    } finally {
      this.currentUpdatePageId = null;
      this.currentUpdatePageSlug = null;
      this.currentUpdatePageLocale = null;
    }

    const mapped = this.mapToDatabase({
      ...data,
      ...(data.locale ? { locale: normalizeLocaleCode(data.locale, DEFAULT_LOCALE) } : {})
    });
    await this.db.executeOptionalQuery(
      async (client) => {
        const result = await client
          .from('pages')
          .update(mapped)
          .eq('id', id)
          .select()
          .maybeSingle();
        return result;
      },
      'update page'
    );

    const withRelations = await this.findByIdWithRelations(id);
    if (!withRelations) {
      throw new NotFoundError('Page', id);
    }
    if (!options.skipVersion) {
      await this.createVersion(withRelations, options.actorAuthorId ?? null);
    }
    return withRelations;
  }

  async findBySlug(slug: string, locale?: string): Promise<Page | null> {
    const normalizedLocale = locale ? normalizeLocaleCode(locale, DEFAULT_LOCALE) : null;

    if (normalizedLocale) {
      const page = await this.db.executeOptionalQuery(
        async (client) => {
          const result = await client
            .from('pages')
            .select('*')
            .eq('slug', slug)
            .eq('locale', normalizedLocale)
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

    const pages = await this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('pages')
          .select('*')
          .eq('slug', slug)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (result.data) {
          result.data = result.data.map((row) => this.mapFromDatabase(row));
        }

        return result;
      },
      'findBySlug pages fallback'
    );

    const first = pages[0];
    if (!first) return null;
    return this.populateRelations(first);
  }

  async findBySlugInLocales(slug: string, locales: string[]): Promise<Page | null> {
    const normalizedLocales = Array.from(new Set(
      locales
        .map((locale) => normalizeLocaleCode(locale, ''))
        .filter((locale) => locale.length > 0)
    ));
    if (normalizedLocales.length === 0) return null;

    const rows = await this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('pages')
          .select('*')
          .eq('slug', slug)
          .in('locale', normalizedLocales);

        if (result.data) {
          result.data = result.data.map((row) => this.mapFromDatabase(row));
        }

        return result;
      },
      'findBySlugInLocales pages'
    );

    if (rows.length === 0) return null;
    const sorted = [...rows].sort((a, b) => (
      normalizedLocales.indexOf(a.locale || DEFAULT_LOCALE) - normalizedLocales.indexOf(b.locale || DEFAULT_LOCALE)
    ));
    return this.populateRelations(sorted[0]);
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

  mapVersionFromDatabase(row: PageVersionRow): ContentVersion<PageSnapshot> {
    return {
      id: row.id,
      entityId: row.page_id,
      versionNumber: row.version_number,
      snapshot: row.snapshot as PageSnapshot,
      createdBy: row.created_by
        ? {
            id: row.created_by,
            name: '',
            email: '',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        : null,
      createdAt: new Date(row.created_at)
    };
  }

  async findVersions(pageId: string, limit = 50): Promise<Array<ContentVersion<PageSnapshot>>> {
    const normalizedLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const versions = await this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('page_versions')
          .select('*')
          .eq('page_id', pageId)
          .order('version_number', { ascending: false })
          .limit(normalizedLimit);

        if (result.data) {
          result.data = result.data.map((row) => this.mapVersionFromDatabase(row));
        }

        return result;
      },
      'find page versions'
    );

    const hydrated = [];
    for (const version of versions) {
      const createdBy = version.createdBy?.id ? await this.authorRepo.findById(version.createdBy.id) : null;
      hydrated.push({ ...version, createdBy });
    }
    return hydrated;
  }

  async restoreVersion(pageId: string, versionId: string, options: RestoreOptions = {}): Promise<Page> {
    const version = await this.db.executeOptionalQuery(
      async (client) => {
        const result = await client
          .from('page_versions')
          .select('*')
          .eq('id', versionId)
          .eq('page_id', pageId)
          .maybeSingle();

        if (result.data) {
          result.data = this.mapVersionFromDatabase(result.data);
        }

        return result;
      },
      'find page version'
    );

    if (!version) {
      throw new NotFoundError('Page version', versionId);
    }

    const snapshot = version.snapshot;
    return this.updateWithSections(pageId, {
      title: snapshot.title,
      slug: snapshot.slug,
      locale: snapshot.locale,
      status: snapshot.status,
      template: snapshot.template,
      contentBlocks: snapshot.contentBlocks,
      contentHtml: snapshot.contentHtml,
      excerpt: snapshot.excerpt,
      authorId: options.preserveAuthorId ? undefined : snapshot.authorId,
      seoMetadata: snapshot.seoMetadata,
      publishedAt: snapshot.publishedAt ? new Date(snapshot.publishedAt) : undefined
    }, snapshot.sections, { actorAuthorId: options.actorAuthorId ?? null });
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
        if (filters.locale) {
          query = query.eq('locale', normalizeLocaleCode(filters.locale, DEFAULT_LOCALE));
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

  async updateWithSections(id: string, data: UpdatePage, sections: PageSectionInput[], options: SaveOptions = {}): Promise<Page> {
    const updated = await this.update(id, data, { ...options, skipVersion: true });
    await this.sectionRepo.replaceForPage(id, sections);
    const withSections = await this.findByIdWithRelations(updated.id) as Page;
    if (!options.skipVersion) {
      await this.createVersion(withSections, options.actorAuthorId ?? null);
    }
    return withSections;
  }

  async createWithSections(data: CreatePage, sections: PageSectionInput[], options: SaveOptions = {}): Promise<Page> {
    const page = await this.create(data, { ...options, skipVersion: true });
    await this.sectionRepo.replaceForPage(page.id, sections);
    const withSections = await this.findByIdWithRelations(page.id) as Page;
    if (!options.skipVersion) {
      await this.createVersion(withSections, options.actorAuthorId ?? null);
    }
    return withSections;
  }

  private toSnapshot(page: Page): PageSnapshot {
    return {
      schemaVersion: 1,
      title: page.title,
      slug: page.slug,
      locale: page.locale || DEFAULT_LOCALE,
      status: page.status,
      template: page.template,
      contentBlocks: page.contentBlocks ?? { blocks: [] },
      contentHtml: page.contentHtml,
      excerpt: page.excerpt,
      authorId: page.author?.id ?? null,
      seoMetadata: page.seoMetadata,
      publishedAt: page.publishedAt?.toISOString(),
      sections: (page.sections ?? []).map((section) => ({
        type: section.type,
        content: section.content,
        orderIndex: section.orderIndex
      }))
    };
  }

  private async createVersion(page: Page, actorAuthorId?: string | null): Promise<void> {
    await this.db.executeQuery(
      async (client) => {
        return (client as any).rpc('create_page_version', {
          target_page_id: page.id,
          version_snapshot: this.toSnapshot(page),
          actor_author_id: actorAuthorId ?? null
        });
      },
      'create page version'
    );
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
