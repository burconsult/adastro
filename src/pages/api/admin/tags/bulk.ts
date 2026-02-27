import type { APIRoute } from 'astro';
import { TagRepository } from '@/lib/database/repositories/tag-repository';
import { requireAdmin } from '@/lib/auth/auth-helpers';

export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    // Validate authentication and admin access
    await requireAdmin(request);

    const data = await request.json();
    const { tagIds } = data;

    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Invalid request',
        message: 'tagIds array is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const tagRepo = new TagRepository(true);
    const result = await tagRepo.bulkDelete(tagIds);

    return new Response(JSON.stringify({
      success: true,
      message: `Bulk delete completed: ${result.success.length} successful, ${result.failed.length} failed`,
      results: {
        successful: result.success,
        failed: result.failed
      },
      summary: {
        total: tagIds.length,
        successful: result.success.length,
        failed: result.failed.length
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in bulk tag deletion:', error);
    return new Response(JSON.stringify({ 
      error: 'Bulk deletion failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    // Validate authentication and admin access
    await requireAdmin(request);

    const data = await request.json();
    const { updates } = data;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Invalid request',
        message: 'updates array is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const tagRepo = new TagRepository(true);
    const result = await tagRepo.bulkUpdate(updates);

    return new Response(JSON.stringify({
      success: true,
      message: `Bulk update completed: ${result.success.length} successful, ${result.failed.length} failed`,
      results: {
        successful: result.success,
        failed: result.failed
      },
      summary: {
        total: updates.length,
        successful: result.success.length,
        failed: result.failed.length
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in bulk tag update:', error);
    return new Response(JSON.stringify({ 
      error: 'Bulk update failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};