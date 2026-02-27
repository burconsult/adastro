import type { APIRoute } from 'astro';
import { PostRepository } from '@/lib/database/repositories/post-repository';
import { requireAuthor } from '@/lib/auth/auth-helpers';

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAuthor(request);
    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');
    const excludeId = url.searchParams.get('excludeId');

    if (!slug) {
      return new Response(JSON.stringify({ error: 'Slug query parameter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const postRepo = new PostRepository(true);
    const existing = await postRepo.findBySlug(slug);

    const available = !existing || (excludeId && existing.id === excludeId);

    return new Response(
      JSON.stringify({
        available,
        conflictingPostId: available ? null : existing?.id ?? null
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Slug validation failed:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to validate slug' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
