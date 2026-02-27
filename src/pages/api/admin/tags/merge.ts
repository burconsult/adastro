import type { APIRoute } from 'astro';
import { TagRepository } from '@/lib/database/repositories/tag-repository';
import { requireAdmin } from '@/lib/auth/auth-helpers';

export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    // Validate authentication and admin access
    await requireAdmin(request);

    const data = await request.json();
    const { targetTagId, sourceTagIds } = data;

    if (!targetTagId || !sourceTagIds || !Array.isArray(sourceTagIds) || sourceTagIds.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Invalid request',
        message: 'targetTagId and sourceTagIds array are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Ensure target tag is not in source tags
    if (sourceTagIds.includes(targetTagId)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid request',
        message: 'Target tag cannot be in source tags list'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const tagRepo = new TagRepository(true);
    const result = await tagRepo.mergeTags(targetTagId, sourceTagIds);

    return new Response(JSON.stringify({
      success: true,
      message: `Merge completed: ${result.mergedPosts} posts moved, ${result.deletedTags.length} tags deleted`,
      mergedPosts: result.mergedPosts,
      deletedTags: result.deletedTags,
      errors: result.errors,
      summary: {
        totalSourceTags: sourceTagIds.length,
        successfulMerges: result.deletedTags.length,
        failedMerges: result.errors.length,
        postsAffected: result.mergedPosts
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error merging tags:', error);
    return new Response(JSON.stringify({ 
      error: 'Tag merge failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};