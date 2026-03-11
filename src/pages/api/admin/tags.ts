import type { APIRoute } from 'astro';
import { TagRepository } from '@/lib/database/repositories/tag-repository';
import { requireAdmin, requireAuthor } from '@/lib/auth/auth-helpers';
import { SettingsService } from '@/lib/services/settings-service';

const settingsService = new SettingsService();

const getTagLocalizationMaps = async () => settingsService.getSettings([
  'content.tagLabelsByLocale'
]);

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const user = await requireAuthor(request);

    const url = new URL(request.url);
    const search = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const tagRepo = new TagRepository(user.role === 'admin');
    
    let tags;
    if (search) {
      tags = await tagRepo.search(search, limit, offset);
    } else {
      tags = await tagRepo.findAllWithStats(limit, offset);
    }

    const localizationSettings = await getTagLocalizationMaps();
    const labelMaps = (localizationSettings['content.tagLabelsByLocale'] ?? {}) as Record<string, Record<string, string>>;

    const payload = tags.map((tag: any) => ({
      ...tag,
      postCount: tag.postCount ?? 0,
      localizations: {
        labels: labelMaps[tag.slug] ?? {}
      }
    }));

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching tags:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch tags',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Validate authentication and admin access
    await requireAdmin(request);

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
    const tag = await tagRepo.create({
      name: data.name,
      slug: data.slug
    });

    if (data.localizations && typeof data.localizations === 'object') {
      const currentSettings = await getTagLocalizationMaps();
      const labelMaps = { ...((currentSettings['content.tagLabelsByLocale'] ?? {}) as Record<string, Record<string, string>>) };
      labelMaps[tag.slug] = { ...(data.localizations.labels ?? {}) };
      await settingsService.updateSettings({
        'content.tagLabelsByLocale': labelMaps
      });
    }

    const payload = {
      ...tag,
      postCount: 0,
      localizations: {
        labels: data.localizations?.labels ?? {}
      }
    };

    return new Response(JSON.stringify(payload), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating tag:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to create tag',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
