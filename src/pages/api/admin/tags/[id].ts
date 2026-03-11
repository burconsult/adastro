import type { APIRoute } from 'astro';
import { TagRepository } from '@/lib/database/repositories/tag-repository';
import { requireAdmin } from '@/lib/auth/auth-helpers';
import { SettingsService } from '@/lib/services/settings-service';

const settingsService = new SettingsService();

const getTagLocalizationMaps = async () => settingsService.getSettings([
  'content.tagLabelsByLocale'
]);

export const GET: APIRoute = async ({ params, request }) => {
  try {
    // Validate authentication and admin access
    await requireAdmin(request);

    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Tag ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const tagRepo = new TagRepository(true);
    const tag = await tagRepo.findById(id);

    if (!tag) {
      return new Response(JSON.stringify({ error: 'Tag not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const usageCount = await tagRepo.getUsageCount(id);
    const localizationSettings = await getTagLocalizationMaps();
    const labelMaps = (localizationSettings['content.tagLabelsByLocale'] ?? {}) as Record<string, Record<string, string>>;

    return new Response(JSON.stringify({
      ...tag,
      postCount: usageCount,
      localizations: {
        labels: labelMaps[tag.slug] ?? {}
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching tag:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch tag',
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
      return new Response(JSON.stringify({ error: 'Tag ID is required' }), {
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

    const tagRepo = new TagRepository(true);
    
    // Check if tag exists
    const existingTag = await tagRepo.findById(id);
    if (!existingTag) {
      return new Response(JSON.stringify({ error: 'Tag not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const previousSlug = existingTag.slug;
    const tag = await tagRepo.update(id, {
      name: data.name,
      slug: data.slug
    });
    const localizationSettings = await getTagLocalizationMaps();
    const labelMaps = { ...((localizationSettings['content.tagLabelsByLocale'] ?? {}) as Record<string, Record<string, string>>) };
    const nextLabels = { ...(data.localizations?.labels ?? labelMaps[previousSlug] ?? {}) };
    if (previousSlug !== tag.slug) {
      delete labelMaps[previousSlug];
    }
    labelMaps[tag.slug] = nextLabels;
    await settingsService.updateSettings({
      'content.tagLabelsByLocale': labelMaps
    });

    const usageCount = await tagRepo.getUsageCount(id);

    return new Response(JSON.stringify({
      ...tag,
      postCount: usageCount,
      localizations: {
        labels: nextLabels
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating tag:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to update tag',
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
      return new Response(JSON.stringify({ error: 'Tag ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const tagRepo = new TagRepository(true);
    
    // Check if tag exists
    const existingTag = await tagRepo.findById(id);
    if (!existingTag) {
      return new Response(JSON.stringify({ error: 'Tag not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const usageCount = await tagRepo.getUsageCount(id);
    if (usageCount > 0) {
      return new Response(JSON.stringify({
        error: 'Tag is in use',
        message: `Cannot delete tag with ${usageCount} associated post${usageCount === 1 ? '' : 's'}.`,
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const localizationSettings = await getTagLocalizationMaps();
    const labelMaps = { ...((localizationSettings['content.tagLabelsByLocale'] ?? {}) as Record<string, Record<string, string>>) };
    delete labelMaps[existingTag.slug];
    await tagRepo.delete(id);
    await settingsService.updateSettings({
      'content.tagLabelsByLocale': labelMaps
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting tag:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to delete tag',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
