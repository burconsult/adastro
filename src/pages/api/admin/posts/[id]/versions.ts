import type { APIRoute } from 'astro';
import { requireAuthor } from '@/lib/auth/auth-helpers';
import { PostRepository } from '@/lib/database/repositories/post-repository';
import { NotFoundError } from '@/lib/database/connection';
import { recordAuditEvent } from '@/lib/audit';

const canAccessPost = async (postRepo: PostRepository, postId: string, user: Awaited<ReturnType<typeof requireAuthor>>) => {
  const post = await postRepo.findByIdWithRelations(postId);
  if (!post) {
    return { allowed: false, status: 404, error: 'Post not found' };
  }
  if (user.role === 'author' && post.author.id !== user.authorId) {
    return { allowed: false, status: 403, error: 'Forbidden' };
  }
  return { allowed: true, post };
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
      return new Response(JSON.stringify({ error: 'Post ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const postRepo = new PostRepository(true);
    const access = await canAccessPost(postRepo, id, user);
    if (!access.allowed) {
      return new Response(JSON.stringify({ error: access.error }), {
        status: access.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const versions = await postRepo.findVersions(id, 20);
    return new Response(JSON.stringify(versions), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching post versions:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch post versions',
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
      return new Response(JSON.stringify({ error: 'Post ID is required' }), {
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

    const postRepo = new PostRepository(true);
    const access = await canAccessPost(postRepo, id, user);
    if (!access.allowed) {
      return new Response(JSON.stringify({ error: access.error }), {
        status: access.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const restored = await postRepo.restoreVersion(id, versionId, {
      actorAuthorId: user.authorId ?? null,
      preserveAuthorId: user.role === 'author'
    });
    await recordAuditEvent({
      actor: user,
      action: 'post.restore',
      entityType: 'post',
      entityId: id,
      entityLabel: restored.title,
      metadata: { versionId }
    });
    return new Response(JSON.stringify(restored), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const notFound = error instanceof NotFoundError;
    if (!notFound) {
      console.error('Error restoring post version:', error);
    }
    return new Response(JSON.stringify({
      error: notFound ? 'Post version not found' : 'Failed to restore post version',
      message: notFound
        ? 'The selected version does not exist for this post.'
        : 'The selected version could not be restored.'
    }), {
      status: notFound ? 404 : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
