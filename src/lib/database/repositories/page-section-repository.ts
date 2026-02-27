import { BaseRepository } from '../base-repository.js';
import { ValidationError } from '../connection.js';
import type { PageSection } from '../../types/index.js';
import type { Database } from '../../supabase.js';

type PageSectionRow = Database['public']['Tables']['page_sections']['Row'];
type CreatePageSectionData = Database['public']['Tables']['page_sections']['Insert'];
type UpdatePageSectionData = Database['public']['Tables']['page_sections']['Update'];

export interface CreatePageSection {
  pageId: string;
  type: string;
  content?: Record<string, any>;
  orderIndex?: number;
}

export interface UpdatePageSection {
  type?: string;
  content?: Record<string, any>;
  orderIndex?: number;
}

export type PageSectionInput = Omit<CreatePageSection, 'pageId'>;

export class PageSectionRepository extends BaseRepository<PageSection, CreatePageSection, UpdatePageSection> {
  constructor(useAdmin = false) {
    super('page_sections', useAdmin);
  }

  mapFromDatabase(row: PageSectionRow): PageSection {
    return {
      id: row.id,
      pageId: row.page_id,
      type: row.type,
      content: (row.content as Record<string, any>) ?? {},
      orderIndex: row.order_index,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  mapToDatabase(
    data: CreatePageSection | UpdatePageSection
  ): CreatePageSectionData | UpdatePageSectionData {
    const mapped: any = {};

    if ('pageId' in data) mapped.page_id = data.pageId;
    if ('type' in data && data.type !== undefined) mapped.type = data.type;
    if ('content' in data) mapped.content = data.content ?? {};
    if ('orderIndex' in data && data.orderIndex !== undefined) mapped.order_index = data.orderIndex;

    return mapped;
  }

  async validateCreate(data: CreatePageSection): Promise<void> {
    if (!data.pageId) {
      throw new ValidationError('Page ID is required');
    }
    if (!data.type) {
      throw new ValidationError('Section type is required');
    }
  }

  async validateUpdate(_data: UpdatePageSection): Promise<void> {
    return;
  }

  async findByPageId(pageId: string): Promise<PageSection[]> {
    return this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('page_sections')
          .select('*')
          .eq('page_id', pageId)
          .order('order_index', { ascending: true });

        if (result.data) {
          result.data = result.data.map((row) => this.mapFromDatabase(row));
        }

        return result;
      },
      'findByPageId page_sections'
    );
  }

  async replaceForPage(pageId: string, sections: PageSectionInput[]): Promise<PageSection[]> {
    return this.db.executeArrayQuery(
      async (client) => {
        await client.from('page_sections').delete().eq('page_id', pageId);

        if (sections.length === 0) {
          return { data: [], error: null };
        }

        const payload = sections.map((section, index) => ({
          page_id: pageId,
          type: section.type,
          content: section.content ?? {},
          order_index: section.orderIndex ?? index
        }));

        const result = await client
          .from('page_sections')
          .insert(payload)
          .select()
          .order('order_index', { ascending: true });

        if (result.data) {
          result.data = result.data.map((row) => this.mapFromDatabase(row));
        }

        return result;
      },
      'replaceForPage page_sections'
    );
  }
}
