import type { APIRoute } from 'astro';
import { PostRepository, type UpdatePost } from '@/lib/database/repositories/post-repository';
import { requireAuthor } from '@/lib/auth/auth-helpers';
import { editorJsToHtml, normalizeEditorJsData } from '@/lib/editorjs';

export const GET: APIRoute = async ({ params, request }) => {
  try {
    // Validate authentication
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
    const post = await postRepo.findByIdWithRelations(id);

    if (!post) {
      return new Response(JSON.stringify({ error: 'Post not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (user.role === 'author' && post.author.id !== user.authorId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(post), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching post:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch post',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    // Validate authentication
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

    const data = await request.json();
    
    const postRepo = new PostRepository(true);
    
    // Check if post exists
    const existingPost = await postRepo.findById(id);
    if (!existingPost) {
      return new Response(JSON.stringify({ error: 'Post not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (user.role === 'author' && existingPost.author.id !== user.authorId) {
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

    let contentToPersist: string | undefined;
    if (incomingContent.trim()) {
      contentToPersist = incomingContent;
    } else if (blocksProvided) {
      contentToPersist = derivedFromBlocks || existingPost.content;
    }

    const updatePayload: UpdatePost = {
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      status: data.status,
      categoryIds: Array.isArray(data.categoryIds) ? data.categoryIds : undefined,
      tagIds: Array.isArray(data.tagIds) ? data.tagIds : undefined,
      featuredImageId: data.featuredImageId,
      audioAssetId: data.audioAssetId,
      seoMetadata: data.seoMetadata,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : undefined,
      authorId: user.role === 'admin' ? data.authorId : user.authorId
    };

    if (blocksProvided) {
      updatePayload.blocks = normalizedBlocks ?? { blocks: [] };
    }

    if (contentToPersist !== undefined) {
      updatePayload.content = contentToPersist;
    }

    const post = await postRepo.update(id, updatePayload);

    const postWithRelations = await postRepo.findByIdWithRelations(post.id);

    return new Response(JSON.stringify(postWithRelations ?? post), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating post:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to update post',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    // Validate authentication
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
    
    // Check if post exists
    const existingPost = await postRepo.findById(id);
    if (!existingPost) {
      return new Response(JSON.stringify({ error: 'Post not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (user.role === 'author' && existingPost.author.id !== user.authorId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await postRepo.delete(id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to delete post',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
