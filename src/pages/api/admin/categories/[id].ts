import type { APIRoute } from 'astro';
import { CategoryRepository } from '@/lib/database/repositories/category-repository';
import { requireAdmin } from '@/lib/auth/auth-helpers';

export const GET: APIRoute = async ({ params, request }) => {
  try {
    // Validate authentication and admin access
    await requireAdmin(request);

    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Category ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const categoryRepo = new CategoryRepository(true);
    const category = await categoryRepo.findById(id);

    if (!category) {
      return new Response(JSON.stringify({ error: 'Category not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const usageCount = await categoryRepo.getUsageCount(id);

    return new Response(JSON.stringify({
      ...category,
      postCount: usageCount,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch category',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    // Validate authentication and admin access
    await requireAdmin(request);

    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Category ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await request.json();
    
    // Validate required fields
    if (!data.name || !data.slug) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields',
        required: ['name', 'slug']
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const categoryRepo = new CategoryRepository(true);
    
    // Check if category exists
    const existingCategory = await categoryRepo.findById(id);
    if (!existingCategory) {
      return new Response(JSON.stringify({ error: 'Category not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const category = await categoryRepo.update(id, {
      name: data.name,
      slug: data.slug,
      description: data.description,
      parentId: data.parentId || null
    });

    const usageCount = await categoryRepo.getUsageCount(id);

    return new Response(JSON.stringify({
      ...category,
      postCount: usageCount,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating category:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to update category',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    // Validate authentication and admin access
    await requireAdmin(request);

    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Category ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const categoryRepo = new CategoryRepository(true);
    
    // Check if category exists
    const existingCategory = await categoryRepo.findById(id);
    if (!existingCategory) {
      return new Response(JSON.stringify({ error: 'Category not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const usageCount = await categoryRepo.getUsageCount(id);
    if (usageCount > 0) {
      return new Response(JSON.stringify({
        error: 'Category is in use',
        message: `Cannot delete category with ${usageCount} associated post${usageCount === 1 ? '' : 's'}.`,
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await categoryRepo.delete(id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to delete category',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
