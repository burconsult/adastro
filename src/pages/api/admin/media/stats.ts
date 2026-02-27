import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/auth/auth-helpers';
import { mediaManager } from '@/lib/services/media-manager.js';

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const stats = await mediaManager.getMediaUsageStats();

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error retrieving media stats:', error);
    return new Response(JSON.stringify({
      error: 'Failed to load media statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
