import type { APIRoute } from 'astro';
import { CategoryRepository } from '@/lib/database/repositories/category-repository';
import { requireAdmin, requireAuthor } from '@/lib/auth/auth-helpers';
import { SettingsService } from '@/lib/services/settings-service';

const settingsService = new SettingsService();

const getCategoryLocalizationMaps = async () => settingsService.getSettings([
  'content.categoryLabelsByLocale',
  'content.categoryDescriptionsByLocale'
]);

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const user = await requireAuthor(request);

    const url = new URL(request.url);
    const search = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const categoryRepo = new CategoryRepository(user.role === 'admin');
    
    let categories;
    if (search) {
      categories = await categoryRepo.search(search, limit, offset);
    } else {
      categories = await categoryRepo.findAllWithStats(limit, offset);
    }

    const localizationSettings = await getCategoryLocalizationMaps();
    const labelMaps = (localizationSettings['content.categoryLabelsByLocale'] ?? {}) as Record<string, Record<string, string>>;
    const descriptionMaps = (localizationSettings['content.categoryDescriptionsByLocale'] ?? {}) as Record<string, Record<string, string>>;

    const payload = categories.map((category: any) => ({
      ...category,
      postCount: category.postCount ?? 0,
      localizations: {
        labels: labelMaps[category.slug] ?? {},
        descriptions: descriptionMaps[category.slug] ?? {}
      }
    }));

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch categories',
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

    const categoryRepo = new CategoryRepository(true);
    const category = await categoryRepo.create({
      name: data.name,
      slug: data.slug,
      description: data.description,
      parentId: data.parentId
    });

    if (data.localizations && typeof data.localizations === 'object') {
      const currentSettings = await getCategoryLocalizationMaps();
      const labelMaps = { ...((currentSettings['content.categoryLabelsByLocale'] ?? {}) as Record<string, Record<string, string>>) };
      const descriptionMaps = { ...((currentSettings['content.categoryDescriptionsByLocale'] ?? {}) as Record<string, Record<string, string>>) };
      labelMaps[category.slug] = { ...(data.localizations.labels ?? {}) };
      descriptionMaps[category.slug] = { ...(data.localizations.descriptions ?? {}) };
      await settingsService.updateSettings({
        'content.categoryLabelsByLocale': labelMaps,
        'content.categoryDescriptionsByLocale': descriptionMaps
      });
    }

    const payload = {
      ...category,
      postCount: 0,
      localizations: {
        labels: data.localizations?.labels ?? {},
        descriptions: data.localizations?.descriptions ?? {}
      }
    };

    return new Response(JSON.stringify(payload), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating category:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to create category',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
