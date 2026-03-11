import type { APIRoute } from 'astro';
import { isSupabaseAdminConfigured, supabaseAdmin } from '@/lib/supabase';
import { resetAllSiteConfigCaches } from '@/lib/site-config';
import { isMissingRelationError } from '@/lib/setup/runtime';
import { DEFAULT_ARTICLE_ROUTING, normalizeArticleBasePath } from '@/lib/routing/articles';
import { getCoreLocalePacks } from '@/lib/i18n/catalog';
import { DEFAULT_LOCALE, ensureDefaultLocaleInList, normalizeLocaleCode, normalizeLocaleList } from '@/lib/i18n/locales';
import { ensureLocalizedSystemPages } from '@/lib/services/system-pages';

type RoutingPayload = {
  articleBasePath?: string;
  articlePermalinkStyle?: 'segment' | 'wordpress';
  defaultLocale?: string;
  activeLocales?: string[];
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
  const availableCoreLocales = Object.keys(getCoreLocalePacks());
  const defaultLocale = normalizeLocaleCode(payload.defaultLocale, DEFAULT_LOCALE);
  const activeLocales = ensureDefaultLocaleInList(
    defaultLocale,
    normalizeLocaleList(payload.activeLocales, defaultLocale)
  ).filter((locale) => availableCoreLocales.includes(locale));

  if (!availableCoreLocales.includes(defaultLocale)) {
    return new Response(JSON.stringify({
      error: `Locale "${defaultLocale}" does not have a bundled core language pack.`
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  }

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

  const { data: currentLocaleRows } = await (supabaseAdmin as any)
    .from('site_settings')
    .select('key,value')
    .in('key', ['content.defaultLocale', 'content.locales']);

  const localeRowsByKey = new Map(
    (currentLocaleRows || []).map((row: { key?: string; value?: unknown }) => [row.key, row.value] as const)
  );
  const previousDefaultLocale = normalizeLocaleCode(localeRowsByKey.get('content.defaultLocale'), DEFAULT_LOCALE);
  const previousActiveLocales = ensureDefaultLocaleInList(
    previousDefaultLocale,
    normalizeLocaleList(localeRowsByKey.get('content.locales'), previousDefaultLocale)
  );

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
      },
      {
        key: 'content.defaultLocale',
        value: defaultLocale,
        category: 'content',
        description: 'Default locale for localized routes'
      },
      {
        key: 'content.locales',
        value: activeLocales,
        category: 'content',
        description: 'Activated public locales'
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

  const newlyActivatedLocales = activeLocales.filter((locale) => !previousActiveLocales.includes(locale));

  for (const locale of newlyActivatedLocales) {
    await ensureLocalizedSystemPages({
      articleBasePath: basePath,
      targetLocale: locale,
      sourceLocale: previousDefaultLocale,
      fallbackSourceLocale: DEFAULT_LOCALE
    });
  }

  resetAllSiteConfigCaches();

  return new Response(JSON.stringify({
    ok: true,
    articleBasePath: basePath,
    articlePermalinkStyle: permalinkStyle,
    defaultLocale,
    activeLocales
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
};
