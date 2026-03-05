import type { APIRoute } from 'astro';
import { PostRepository } from '@/lib/database/repositories/post-repository';
import { requireAuthor } from '@/lib/auth/auth-helpers';
import { editorJsToHtml, normalizeEditorJsData } from '@/lib/editorjs';

const toOptionalQueryValue = (value: string | null): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parsePositiveInt = (value: string | null, fallback: number): number => {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const parseNonNegativeInt = (value: string | null, fallback: number): number => {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
};

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    // Validate authentication
    const user = await requireAuthor(request);
    if (user.role === 'author' && !user.authorId) {
      return new Response(JSON.stringify({ error: 'Author profile not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const status = toOptionalQueryValue(url.searchParams.get('status')) as 'draft' | 'published' | 'scheduled' | undefined;
    const search = toOptionalQueryValue(url.searchParams.get('search'));
    const locale = toOptionalQueryValue(url.searchParams.get('locale'));
    const categoryId = toOptionalQueryValue(url.searchParams.get('category'));
    const tagId = toOptionalQueryValue(url.searchParams.get('tag'));
    const limit = parsePositiveInt(url.searchParams.get('limit'), 20);
    const offset = parseNonNegativeInt(url.searchParams.get('offset'), 0);

    const postRepo = new PostRepository(true);
    
    const posts = await postRepo.findWithFilters({
      status,
      search,
      locale,
      categoryId,
      tagId,
      authorId: user.role === 'author' ? user.authorId : undefined,
      limit,
      offset
    });

    return new Response(JSON.stringify(posts), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch posts',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Validate authentication
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
    const contentToPersist = incomingContent.trim() || derivedFromBlocks;

    // Validate required fields
    if (!data.title || !contentToPersist) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields',
        required: ['title', 'content or blocks']
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const postRepo = new PostRepository(true);
    const authorId = user.role === 'admin'
      ? (data.authorId || user.authorId)
      : user.authorId;

    if (!authorId) {
      return new Response(JSON.stringify({ error: 'Author profile not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const post = await postRepo.create({
      title: data.title,
      slug: data.slug,
      locale: data.locale,
      content: contentToPersist,
      blocks: rawBlocksProvided ? normalizedBlocks : undefined,
      excerpt: data.excerpt,
      status: data.status || 'draft',
      authorId,
      categoryIds: Array.isArray(data.categoryIds) ? data.categoryIds : [],
      tagIds: Array.isArray(data.tagIds) ? data.tagIds : [],
      featuredImageId: data.featuredImageId,
      audioAssetId: data.audioAssetId,
      seoMetadata: data.seoMetadata,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : undefined
    });

    const postWithRelations = await postRepo.findByIdWithRelations(post.id);

    return new Response(JSON.stringify(postWithRelations ?? post), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating post:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to create post',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
