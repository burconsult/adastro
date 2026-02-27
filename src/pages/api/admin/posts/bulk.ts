import type { APIRoute } from 'astro';
import { PostRepository } from '@/lib/database/repositories/post-repository';
import { requireAdmin } from '@/lib/auth/auth-helpers';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Validate authentication
    await requireAdmin(request);

    const data = await request.json();
    const { action, postIds } = data;

    if (!action || !postIds || !Array.isArray(postIds)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid request',
        message: 'action and postIds array are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const postRepo = new PostRepository(true);
    let results = [];

    switch (action) {
      case 'delete':
        for (const postId of postIds) {
          try {
            await postRepo.delete(postId);
            results.push({ id: postId, success: true });
          } catch (error) {
            results.push({ 
              id: postId, 
              success: false, 
              error: 'Delete failed' 
            });
          }
        }
        break;

      case 'publish':
        for (const postId of postIds) {
          try {
            await postRepo.update(postId, { status: 'published' });
            results.push({ id: postId, success: true });
          } catch (error) {
            results.push({ 
              id: postId, 
              success: false, 
              error: 'Publish failed' 
            });
          }
        }
        break;

      case 'draft':
        for (const postId of postIds) {
          try {
            await postRepo.update(postId, { status: 'draft' });
            results.push({ id: postId, success: true });
          } catch (error) {
            results.push({ 
              id: postId, 
              success: false, 
              error: 'Draft update failed' 
            });
          }
        }
        break;

      default:
        return new Response(JSON.stringify({ 
          error: 'Invalid action',
          message: 'Supported actions: delete, publish, draft'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return new Response(JSON.stringify({
      success: true,
      message: `Bulk ${action} completed: ${successCount} successful, ${failureCount} failed`,
      results,
      summary: {
        total: postIds.length,
        successful: successCount,
        failed: failureCount
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in bulk post operation:', error);
    return new Response(JSON.stringify({ 
      error: 'Bulk operation failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
