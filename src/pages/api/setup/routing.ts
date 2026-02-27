import type { APIRoute } from 'astro';
import { isSupabaseAdminConfigured, supabaseAdmin } from '@/lib/supabase';
import { resetSiteContentRoutingCache, resetSiteNavigationCache } from '@/lib/site-config';
import { isMissingRelationError } from '@/lib/setup/runtime';
import { DEFAULT_ARTICLE_ROUTING, normalizeArticleBasePath } from '@/lib/routing/articles';

type RoutingPayload = {
  articleBasePath?: string;
  articlePermalinkStyle?: 'segment' | 'wordpress';
};

export const POST: APIRoute = async ({ request }) => {
  if (!isSupabaseAdminConfigured) {
    return new Response(JSON.stringify({
      error: 'SUPABASE_SECRET_KEY is required for setup routing updates.'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  }

  let payload: RoutingPayload = {};
  try {
    payload = await request.json() as RoutingPayload;
  } catch {
    payload = {};
  }

  const basePath = normalizeArticleBasePath(payload.articleBasePath || DEFAULT_ARTICLE_ROUTING.basePath);
  const permalinkStyle = payload.articlePermalinkStyle === 'wordpress' ? 'wordpress' : 'segment';

  const { error: probeError } = await (supabaseAdmin as any)
    .from('site_settings')
    .select('*', { head: true, count: 'exact' })
    .limit(1);

  if (probeError) {
    const message = String(probeError.message || '');
    const status = isMissingRelationError(message) ? 409 : 500;
    return new Response(JSON.stringify({
      error: isMissingRelationError(message)
        ? 'Core schema is not initialized yet. Run Core SQL in Step 2 first.'
        : `Could not verify setup schema: ${message}`
    }), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  }

  const { error: upsertError } = await (supabaseAdmin as any)
    .from('site_settings')
    .upsert([
      {
        key: 'content.articleBasePath',
        value: basePath,
        category: 'content',
        description: 'Base path used for article routes'
      },
      {
        key: 'content.articlePermalinkStyle',
        value: permalinkStyle,
        category: 'content',
        description: 'Permalink style for article URLs'
      }
    ], {
      onConflict: 'key'
    });

  if (upsertError) {
    return new Response(JSON.stringify({
      error: `Could not save routing settings: ${upsertError.message}`
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  }

  resetSiteContentRoutingCache();
  resetSiteNavigationCache();

  return new Response(JSON.stringify({
    ok: true,
    articleBasePath: basePath,
    articlePermalinkStyle: permalinkStyle
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
};
