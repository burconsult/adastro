import type { APIRoute } from 'astro';
import { MediaRepository } from '@/lib/database/repositories/media-repository';
import { requireAuthor } from '@/lib/auth/auth-helpers';

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const user = await requireAuthor(request);

    const url = new URL(request.url);
    const limit = Number.parseInt(url.searchParams.get('limit') || '50');
    const offset = Number.parseInt(url.searchParams.get('offset') || '0');
    const mimeType = url.searchParams.get('mimeType') || undefined;
    const search = url.searchParams.get('search') || undefined;

    if (user.role === 'author' && !user.authorId) {
      return new Response(JSON.stringify({ error: 'Author profile not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use admin-backed reads for a consistent media payload (including original asset metadata)
    // while still scoping authors to their own uploads via the uploadedBy filter.
    const mediaRepo = new MediaRepository(true);
    const { assets, total } = await mediaRepo.findMany({
      limit,
      offset,
      mimeType,
      search,
      uploadedBy: user.role === 'author' ? user.authorId : undefined
    });

    const payload = {
      assets: assets.map(asset => ({
        ...asset,
        createdAt: asset.createdAt instanceof Date ? asset.createdAt.toISOString() : asset.createdAt
      })),
      total
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching media:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch media',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
