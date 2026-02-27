import type { APIRoute } from 'astro';
import { TagRepository } from '@/lib/database/repositories/tag-repository';
import { requireAdmin } from '@/lib/auth/auth-helpers';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Validate authentication and admin access
    await requireAdmin(request);

    const tagRepo = new TagRepository(true);
    const stats = await tagRepo.getTagStats();

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching tag statistics:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch tag statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
