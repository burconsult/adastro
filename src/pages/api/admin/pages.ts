import type { APIRoute } from 'astro';
import { PageRepository } from '@/lib/database/repositories/page-repository';
import { requireAuthor } from '@/lib/auth/auth-helpers';
import { editorJsToHtml, normalizeEditorJsData } from '@/lib/editorjs';

const normalizeSections = (sections: unknown) => {
  if (!Array.isArray(sections)) return [];
  return sections
    .map((section, index) => {
      if (!section || typeof section !== 'object') return null;
      const record = section as Record<string, any>;
      const type = typeof record.type === 'string' ? record.type.trim() : '';
      if (!type) return null;
      const content =
        record.content && typeof record.content === 'object' && !Array.isArray(record.content)
          ? record.content
          : {};
      const orderIndex =
        typeof record.orderIndex === 'number' && Number.isFinite(record.orderIndex)
          ? record.orderIndex
          : index;
      return { type, content, orderIndex };
    })
    .filter((section): section is { type: string; content: Record<string, any>; orderIndex: number } => Boolean(section));
};

export const GET: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuthor(request);
    if (user.role === 'author' && !user.authorId) {
      return new Response(JSON.stringify({ error: 'Author profile not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') as 'draft' | 'published' | 'archived' | null;
    const search = url.searchParams.get('search');
    const locale = url.searchParams.get('locale');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const pageRepo = new PageRepository(true);
    const pages = await pageRepo.findWithFilters({
      status: status ?? undefined,
      search: search ?? undefined,
      locale: locale ?? undefined,
      authorId: user.role === 'author' ? user.authorId : undefined,
      limit,
      offset
    });

    return new Response(JSON.stringify(pages), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching pages:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch pages',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuthor(request);
    if (user.role === 'author' && !user.authorId) {
      return new Response(JSON.stringify({ error: 'Author profile not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await request.json();
    const rawBlocksProvided = Object.prototype.hasOwnProperty.call(data, 'blocks');
    const normalizedBlocks = rawBlocksProvided ? normalizeEditorJsData(data.blocks) : { blocks: [] };
    const derivedFromBlocks = normalizedBlocks.blocks.length > 0 ? editorJsToHtml(normalizedBlocks) : '';
    const incomingContent = typeof data.content === 'string' ? data.content : '';
    const incomingHtml = typeof data.contentHtml === 'string' ? data.contentHtml : '';
    const contentHtml = incomingHtml.trim() || incomingContent.trim() || derivedFromBlocks;

    if (!data.title || !data.slug) {
      return new Response(JSON.stringify({
        error: 'Missing required fields',
        required: ['title', 'slug']
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const pageRepo = new PageRepository(true);
    const authorId = user.role === 'admin'
      ? (data.authorId || user.authorId || null)
      : user.authorId;

    const sections = normalizeSections(data.sections);

    const publishedAt = data.publishedAt
      ? new Date(data.publishedAt)
      : data.status === 'published'
        ? new Date()
        : undefined;

    const page = await pageRepo.createWithSections({
      title: data.title,
      slug: data.slug,
      locale: data.locale,
      status: data.status || 'draft',
      template: data.template || 'default',
      contentBlocks: rawBlocksProvided ? normalizedBlocks : undefined,
      contentHtml,
      excerpt: data.excerpt,
      authorId,
      seoMetadata: data.seoMetadata,
      publishedAt
    }, sections);

    return new Response(JSON.stringify(page), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating page:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create page',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
