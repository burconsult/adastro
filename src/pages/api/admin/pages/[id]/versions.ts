import type { APIRoute } from 'astro';
import { requireAuthor } from '@/lib/auth/auth-helpers';
import { PageRepository } from '@/lib/database/repositories/page-repository';
import { NotFoundError } from '@/lib/database/connection';

const canAccessPage = async (pageRepo: PageRepository, pageId: string, user: Awaited<ReturnType<typeof requireAuthor>>) => {
  const page = await pageRepo.findByIdWithRelations(pageId);
  if (!page) {
    return { allowed: false, status: 404, error: 'Page not found' };
  }
  if (user.role === 'author' && page.author?.id !== user.authorId) {
    return { allowed: false, status: 403, error: 'Forbidden' };
  }
  return { allowed: true, page };
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
    const access = await canAccessPage(pageRepo, id, user);
    if (!access.allowed) {
      return new Response(JSON.stringify({ error: access.error }), {
        status: access.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const versions = await pageRepo.findVersions(id, 20);
    return new Response(JSON.stringify(versions), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching page versions:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch page versions',
      message: 'The version history could not be loaded.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ params, request }) => {
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

    const data = await request.json().catch(() => ({}));
    const versionId = typeof data.versionId === 'string' ? data.versionId : '';
    if (!versionId) {
      return new Response(JSON.stringify({ error: 'Version ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const pageRepo = new PageRepository(true);
    const access = await canAccessPage(pageRepo, id, user);
    if (!access.allowed) {
      return new Response(JSON.stringify({ error: access.error }), {
        status: access.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const restored = await pageRepo.restoreVersion(id, versionId, {
      actorAuthorId: user.authorId ?? null,
      preserveAuthorId: user.role === 'author'
    });
    return new Response(JSON.stringify(restored), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const notFound = error instanceof NotFoundError;
    if (!notFound) {
      console.error('Error restoring page version:', error);
    }
    return new Response(JSON.stringify({
      error: notFound ? 'Page version not found' : 'Failed to restore page version',
      message: notFound
        ? 'The selected version does not exist for this page.'
        : 'The selected version could not be restored.'
    }), {
      status: notFound ? 404 : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
