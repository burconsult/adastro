import type { APIRoute } from 'astro';
import { PageRepository, type UpdatePage } from '@/lib/database/repositories/page-repository';
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

export const GET: APIRoute = async ({ params, request }) => {
  try {
    const user = await requireAuthor(request);
    if (user.role === 'author' && !user.authorId) {
      return new Response(JSON.stringify({ error: 'Author profile not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Page ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const pageRepo = new PageRepository(true);
    const page = await pageRepo.findByIdWithRelations(id);
    if (!page) {
      return new Response(JSON.stringify({ error: 'Page not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (user.role === 'author' && page.author?.id !== user.authorId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(page), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching page:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch page',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const user = await requireAuthor(request);
    if (user.role === 'author' && !user.authorId) {
      return new Response(JSON.stringify({ error: 'Author profile not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Page ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await request.json();
    const pageRepo = new PageRepository(true);
    const existingPage = await pageRepo.findByIdWithRelations(id);
    if (!existingPage) {
      return new Response(JSON.stringify({ error: 'Page not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (user.role === 'author' && existingPage.author?.id !== user.authorId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const blocksProvided = Object.prototype.hasOwnProperty.call(data, 'blocks');
    const normalizedBlocks = blocksProvided ? normalizeEditorJsData(data.blocks) : undefined;
    const derivedFromBlocks = normalizedBlocks && normalizedBlocks.blocks.length > 0
      ? editorJsToHtml(normalizedBlocks)
      : '';
    const incomingContent = typeof data.content === 'string' ? data.content : '';
    const incomingHtml = typeof data.contentHtml === 'string' ? data.contentHtml : '';

    let contentHtml: string | undefined;
    if (incomingHtml.trim()) {
      contentHtml = incomingHtml;
    } else if (incomingContent.trim()) {
      contentHtml = incomingContent;
    } else if (blocksProvided) {
      contentHtml = derivedFromBlocks || existingPage.contentHtml || '';
    }

    const nextPublishedAt = data.publishedAt
      ? new Date(data.publishedAt)
      : data.status === 'published' && !existingPage.publishedAt
        ? new Date()
        : undefined;

    const updatePayload: UpdatePage = {
      title: data.title,
      slug: data.slug,
      locale: data.locale,
      status: data.status,
      template: data.template,
      excerpt: data.excerpt,
      seoMetadata: data.seoMetadata,
      publishedAt: nextPublishedAt,
      authorId: user.role === 'admin' ? data.authorId : user.authorId
    };

    if (blocksProvided) {
      updatePayload.contentBlocks = normalizedBlocks ?? { blocks: [] };
    }

    if (contentHtml !== undefined) {
      updatePayload.contentHtml = contentHtml;
    }

    const sections = normalizeSections(data.sections);
    const updated = await pageRepo.updateWithSections(id, updatePayload, sections);

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating page:', error);
    return new Response(JSON.stringify({
      error: 'Failed to update page',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    const user = await requireAuthor(request);
    if (user.role === 'author' && !user.authorId) {
      return new Response(JSON.stringify({ error: 'Author profile not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Page ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const pageRepo = new PageRepository(true);
    const existingPage = await pageRepo.findByIdWithRelations(id);
    if (!existingPage) {
      return new Response(JSON.stringify({ error: 'Page not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (user.role === 'author' && existingPage.author?.id !== user.authorId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await pageRepo.delete(id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting page:', error);
    return new Response(JSON.stringify({
      error: 'Failed to delete page',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
