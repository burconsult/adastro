import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/auth/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase';
import { mediaManager } from '@/lib/services/media-manager';

type ArtifactRow = {
  entity_type: 'author' | 'category' | 'tag' | 'media' | 'post';
  entity_id: string;
};

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);

    const { jobId } = await request.json();
    if (!jobId) {
      return new Response(JSON.stringify({ error: 'jobId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from('migration_jobs')
      .select('id, status, rollback_safe')
      .eq('id', jobId)
      .maybeSingle();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: 'Migration job not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!job.rollback_safe) {
      return new Response(JSON.stringify({ error: 'This migration cannot be rolled back safely.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data: artifacts, error: artifactsError } = await supabaseAdmin
      .from('migration_artifacts')
      .select('entity_type, entity_id')
      .eq('job_id', jobId);

    if (artifactsError) {
      return new Response(JSON.stringify({ error: 'Failed to load migration artifacts' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const grouped = (artifacts || []).reduce<Record<string, string[]>>((acc, row) => {
      acc[row.entity_type] = acc[row.entity_type] || [];
      acc[row.entity_type].push(row.entity_id);
      return acc;
    }, {});

    const results = {
      postsDeleted: 0,
      mediaDeleted: 0,
      categoriesDeleted: 0,
      tagsDeleted: 0,
      authorsDeleted: 0,
      skipped: [] as string[]
    };

    const postIds = grouped.post || [];
    if (postIds.length) {
      const { error } = await supabaseAdmin
        .from('posts')
        .delete()
        .in('id', postIds);
      if (error) {
        return new Response(JSON.stringify({ error: 'Failed to roll back posts' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      results.postsDeleted = postIds.length;
    }

    const mediaIds = grouped.media || [];
    for (const mediaId of mediaIds) {
      const { count } = await supabaseAdmin
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('featured_image_id', mediaId);
      if (count && count > 0) {
        results.skipped.push(`media:${mediaId}`);
        continue;
      }
      try {
        await mediaManager.deleteMediaAsset(mediaId);
        results.mediaDeleted++;
      } catch (error) {
        results.skipped.push(`media:${mediaId}`);
      }
    }

    const categoryIds = grouped.category || [];
    for (const categoryId of categoryIds) {
      const { count } = await supabaseAdmin
        .from('post_categories')
        .select('post_id', { count: 'exact', head: true })
        .eq('category_id', categoryId);
      if (count && count > 0) {
        results.skipped.push(`category:${categoryId}`);
        continue;
      }
      const { error } = await supabaseAdmin
        .from('categories')
        .delete()
        .eq('id', categoryId);
      if (error) {
        results.skipped.push(`category:${categoryId}`);
      } else {
        results.categoriesDeleted++;
      }
    }

    const tagIds = grouped.tag || [];
    for (const tagId of tagIds) {
      const { count } = await supabaseAdmin
        .from('post_tags')
        .select('post_id', { count: 'exact', head: true })
        .eq('tag_id', tagId);
      if (count && count > 0) {
        results.skipped.push(`tag:${tagId}`);
        continue;
      }
      const { error } = await supabaseAdmin
        .from('tags')
        .delete()
        .eq('id', tagId);
      if (error) {
        results.skipped.push(`tag:${tagId}`);
      } else {
        results.tagsDeleted++;
      }
    }

    const authorIds = grouped.author || [];
    for (const authorId of authorIds) {
      const { count } = await supabaseAdmin
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('author_id', authorId);
      if (count && count > 0) {
        results.skipped.push(`author:${authorId}`);
        continue;
      }
      const { error } = await supabaseAdmin
        .from('authors')
        .delete()
        .eq('id', authorId);
      if (error) {
        results.skipped.push(`author:${authorId}`);
      } else {
        results.authorsDeleted++;
      }
    }

    await supabaseAdmin
      .from('migration_jobs')
      .update({
        status: 'rolled_back',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Undo failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
