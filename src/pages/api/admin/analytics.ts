import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/auth/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase';
import { getSiteLocaleConfig } from '@/lib/site-config';
import { normalizeLocaleCode } from '@/lib/i18n/locales';

type AnalyticsPoint = { date: string; count: number };
type TopPath = { path: string; count: number };
type LocaleBreakdown = { locale: string; count: number };

const clampDays = (value: number) => {
  if (!Number.isFinite(value)) return 30;
  return Math.max(1, Math.min(90, Math.round(value)));
};

const extractLocaleFromPath = (pathname: string, locales: string[], defaultLocale: string): string => {
  const match = /^\/([a-z]{2}(?:-[a-z]{2})?)(?:\/|$)/i.exec(pathname || '');
  if (!match) return defaultLocale;
  const localeCandidate = normalizeLocaleCode(match[1], defaultLocale);
  return locales.includes(localeCandidate) ? localeCandidate : defaultLocale;
};

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);

    const localeConfig = await getSiteLocaleConfig();
    const url = new URL(request.url);
    const days = clampDays(Number(url.searchParams.get('days') || '30'));
    const localeParam = normalizeLocaleCode(url.searchParams.get('locale'), '');
    const selectedLocale = localeConfig.locales.includes(localeParam) ? localeParam : undefined;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const previousSince = new Date(Date.now() - days * 2 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: currentRows, error: currentError }, { data: previousRows, error: previousError }] = await Promise.all([
      supabaseAdmin
        .from('analytics_events')
        .select('created_at, data')
        .eq('event_type', 'page_view')
        .eq('entity_type', 'page')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000),
      supabaseAdmin
        .from('analytics_events')
        .select('created_at, data')
        .eq('event_type', 'page_view')
        .eq('entity_type', 'page')
        .gte('created_at', previousSince)
        .lt('created_at', since)
        .limit(5000)
    ]);

    if (currentError) throw currentError;
    if (previousError) throw previousError;

    const rows = Array.isArray(currentRows) ? currentRows : [];
    const previous = Array.isArray(previousRows) ? previousRows : [];

    const topPathMap = new Map<string, number>();
    const dailyMap = new Map<string, number>();
    const uniquePaths = new Set<string>();
    const localeMap = new Map<string, number>();
    let previousCount = 0;

    for (const row of rows) {
      const path = typeof (row as any)?.data?.path === 'string' ? String((row as any).data.path).slice(0, 255) : '/';
      const rowLocale = extractLocaleFromPath(path, localeConfig.locales, localeConfig.defaultLocale);
      localeMap.set(rowLocale, (localeMap.get(rowLocale) || 0) + 1);
      if (selectedLocale && rowLocale !== selectedLocale) continue;

      const createdAt = typeof row.created_at === 'string' ? row.created_at : '';
      const day = createdAt ? createdAt.slice(0, 10) : '';
      if (day) {
        dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
      }

      uniquePaths.add(path);
      topPathMap.set(path, (topPathMap.get(path) || 0) + 1);
    }

    for (const row of previous) {
      const path = typeof (row as any)?.data?.path === 'string' ? String((row as any).data.path).slice(0, 255) : '/';
      const rowLocale = extractLocaleFromPath(path, localeConfig.locales, localeConfig.defaultLocale);
      if (selectedLocale && rowLocale !== selectedLocale) continue;
      previousCount += 1;
    }

    const topPaths: TopPath[] = [...topPathMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));

    const todayKey = new Date().toISOString().slice(0, 10);
    const todayViews = dailyMap.get(todayKey) || 0;

    const dailyViews: AnalyticsPoint[] = [...dailyMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));
    const localeBreakdown: LocaleBreakdown[] = [...localeMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([locale, count]) => ({ locale, count }));

    return new Response(JSON.stringify({
      windowDays: days,
      selectedLocale: selectedLocale ?? 'all',
      availableLocales: localeConfig.locales,
      localeBreakdown,
      totalPageViews: dailyViews.reduce((acc, point) => acc + point.count, 0),
      previousWindowPageViews: previousCount,
      uniquePaths: uniquePaths.size,
      todayPageViews: todayViews,
      topPaths,
      dailyViews
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error loading analytics summary:', error);
    return new Response(JSON.stringify({ error: 'Failed to load analytics summary' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const prerender = false;
