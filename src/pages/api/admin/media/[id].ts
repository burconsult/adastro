import type { APIRoute } from 'astro';
import { requireAuthor } from '@/lib/auth/auth-helpers';
import { MediaRepository } from '@/lib/database/repositories/media-repository';
import { mediaManager } from '@/lib/services/media-manager.js';
import type { MediaAsset } from '@/lib/types/index.js';
import { supabaseAdmin } from '@/lib/supabase.js';

const serializeAsset = (asset: MediaAsset) => ({
  ...asset,
  createdAt: asset.createdAt instanceof Date ? asset.createdAt.toISOString() : asset.createdAt
});

export const GET: APIRoute = async ({ params, request }) => {
  try {
    const user = await requireAuthor(request);
    const id = params.id;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Media ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const repo = new MediaRepository(true);
    const asset = await repo.findById(id);

    if (!asset) {
      return new Response(JSON.stringify({ error: 'Media asset not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (user.role === 'author') {
      if (!user.authorId) {
        return new Response(JSON.stringify({ error: 'Author profile not found' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const { data: ownership } = await supabaseAdmin
        .from('media_assets')
        .select('uploaded_by')
        .eq('id', id)
        .maybeSingle();

      if (!ownership || ownership.uploaded_by !== user.authorId) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify(serializeAsset(asset)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error retrieving media asset:', error);
    return new Response(JSON.stringify({
      error: 'Failed to load media asset',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const user = await requireAuthor(request);
    const id = params.id;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Media ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const payload = await request.json().catch(() => ({}));
    const { altText, caption, filename } = payload ?? {};

    if ([altText, caption, filename].every((value) => value === undefined)) {
      return new Response(JSON.stringify({ error: 'No changes provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (user.role === 'author') {
      if (!user.authorId) {
        return new Response(JSON.stringify({ error: 'Author profile not found' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const { data: ownership } = await supabaseAdmin
        .from('media_assets')
        .select('uploaded_by')
        .eq('id', id)
        .maybeSingle();

      if (!ownership || ownership.uploaded_by !== user.authorId) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const repo = new MediaRepository(true);
    const updated = await repo.update(id, { altText, caption, filename });

    return new Response(JSON.stringify(serializeAsset(updated)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating media asset:', error);
    return new Response(JSON.stringify({
      error: 'Failed to update media asset',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    const user = await requireAuthor(request);
    const id = params.id;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Media ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (user.role === 'author') {
      if (!user.authorId) {
        return new Response(JSON.stringify({ error: 'Author profile not found' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const { data: ownership } = await supabaseAdmin
        .from('media_assets')
        .select('uploaded_by')
        .eq('id', id)
        .maybeSingle();

      if (!ownership || ownership.uploaded_by !== user.authorId) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    await mediaManager.deleteMediaAsset(id);

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting media asset:', error);
    return new Response(JSON.stringify({
      error: 'Failed to delete media asset',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
