import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/auth/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase';
import { getSiteLocaleConfig } from '@/lib/site-config';
import { normalizeLocaleCode } from '@/lib/i18n/locales';
import type { DeviceType } from '@/lib/analytics/user-agent';

type AnalyticsPoint = { date: string; count: number };
type TopPath = { path: string; count: number };
type TopReferrer = { referrerHost: string; count: number };
type LocaleBreakdown = { locale: string; count: number };
type CountryBreakdown = { countryCode: string; count: number };
type DeviceBreakdown = { deviceType: DeviceType | 'unknown'; count: number };
type BrowserBreakdown = { browser: string; count: number };
type OsBreakdown = { os: string; count: number };

const DEVICE_TYPES = new Set<DeviceType | 'unknown'>(['desktop', 'mobile', 'tablet', 'bot', 'other', 'unknown']);

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

const normalizeCountryCode = (value: unknown): string => {
  if (typeof value !== 'string') return 'ZZ';
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : 'ZZ';
};

const normalizeDeviceType = (value: unknown): DeviceType | 'unknown' => {
  if (typeof value !== 'string') return 'unknown';
  const normalized = value.trim().toLowerCase() as DeviceType | 'unknown';
  return DEVICE_TYPES.has(normalized) ? normalized : 'unknown';
};

const normalizeNamedDimension = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().slice(0, 48);
  return normalized.length > 0 ? normalized : fallback;
};

const normalizeCountryFilter = (value: string | null): string | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : undefined;
};

const normalizeDeviceFilter = (value: string | null): DeviceType | 'unknown' | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase() as DeviceType | 'unknown';
  return DEVICE_TYPES.has(normalized) ? normalized : undefined;
};

const normalizeBrowserFilter = (value: string | null): string | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().slice(0, 48);
  return normalized.length > 0 ? normalized : undefined;
};

const mapEntries = <T extends string>(source: Map<T, number>, keyName: 'locale' | 'countryCode' | 'deviceType' | 'browser' | 'os') =>
  [...source.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ [keyName]: key, count }));

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);

    const localeConfig = await getSiteLocaleConfig();
    const url = new URL(request.url);
    const days = clampDays(Number(url.searchParams.get('days') || '30'));
    const localeParam = normalizeLocaleCode(url.searchParams.get('locale'), '');
    const selectedLocale = localeConfig.locales.includes(localeParam) ? localeParam : undefined;
    const selectedCountryCode = normalizeCountryFilter(url.searchParams.get('country'));
    const selectedDeviceType = normalizeDeviceFilter(url.searchParams.get('device'));
    const selectedBrowser = normalizeBrowserFilter(url.searchParams.get('browser'));
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
    const topReferrerMap = new Map<string, number>();
    const dailyMap = new Map<string, number>();
    const uniquePaths = new Set<string>();
    const localeMap = new Map<string, number>();
    const countryMap = new Map<string, number>();
    const deviceMap = new Map<DeviceType | 'unknown', number>();
    const browserMap = new Map<string, number>();
    const osMap = new Map<string, number>();
    let botViews = 0;
    let humanViews = 0;
    let previousCount = 0;

    for (const row of rows) {
      const path = typeof (row as any)?.data?.path === 'string' ? String((row as any).data.path).slice(0, 255) : '/';
      const rowLocale = extractLocaleFromPath(path, localeConfig.locales, localeConfig.defaultLocale);
      const rowCountryCode = normalizeCountryCode((row as any)?.data?.countryCode);
      const rowDeviceType = normalizeDeviceType((row as any)?.data?.deviceType);
      const rowBrowser = normalizeNamedDimension((row as any)?.data?.browser, 'Unknown');
      const rowOs = normalizeNamedDimension((row as any)?.data?.os, 'Unknown');
      const rowReferrerHost = normalizeNamedDimension((row as any)?.data?.referrerHost, '');
      const rowIsBot = (row as any)?.data?.isBot === true;

      localeMap.set(rowLocale, (localeMap.get(rowLocale) || 0) + 1);
      if (selectedLocale && rowLocale !== selectedLocale) continue;

      countryMap.set(rowCountryCode, (countryMap.get(rowCountryCode) || 0) + 1);
      deviceMap.set(rowDeviceType, (deviceMap.get(rowDeviceType) || 0) + 1);
      browserMap.set(rowBrowser, (browserMap.get(rowBrowser) || 0) + 1);
      osMap.set(rowOs, (osMap.get(rowOs) || 0) + 1);

      if (selectedCountryCode && rowCountryCode !== selectedCountryCode) continue;
      if (selectedDeviceType && rowDeviceType !== selectedDeviceType) continue;
      if (selectedBrowser && rowBrowser !== selectedBrowser) continue;

      if (rowIsBot) botViews += 1;
      else humanViews += 1;

      if (rowReferrerHost) {
        topReferrerMap.set(rowReferrerHost, (topReferrerMap.get(rowReferrerHost) || 0) + 1);
      }

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

      const rowCountryCode = normalizeCountryCode((row as any)?.data?.countryCode);
      const rowDeviceType = normalizeDeviceType((row as any)?.data?.deviceType);
      const rowBrowser = normalizeNamedDimension((row as any)?.data?.browser, 'Unknown');
      if (selectedCountryCode && rowCountryCode !== selectedCountryCode) continue;
      if (selectedDeviceType && rowDeviceType !== selectedDeviceType) continue;
      if (selectedBrowser && rowBrowser !== selectedBrowser) continue;
      previousCount += 1;
    }

    const topPaths: TopPath[] = [...topPathMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));
    const topReferrers: TopReferrer[] = [...topReferrerMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([referrerHost, count]) => ({ referrerHost, count }));

    const todayKey = new Date().toISOString().slice(0, 10);
    const todayViews = dailyMap.get(todayKey) || 0;

    const dailyViews: AnalyticsPoint[] = [...dailyMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));
    const localeBreakdown: LocaleBreakdown[] = mapEntries(localeMap, 'locale') as LocaleBreakdown[];
    const countryBreakdown: CountryBreakdown[] = mapEntries(countryMap, 'countryCode') as CountryBreakdown[];
    const deviceBreakdown: DeviceBreakdown[] = mapEntries(deviceMap, 'deviceType') as DeviceBreakdown[];
    const browserBreakdown: BrowserBreakdown[] = mapEntries(browserMap, 'browser') as BrowserBreakdown[];
    const osBreakdown: OsBreakdown[] = mapEntries(osMap, 'os') as OsBreakdown[];

    return new Response(JSON.stringify({
      windowDays: days,
      selectedLocale: selectedLocale ?? 'all',
      selectedCountryCode: selectedCountryCode ?? 'all',
      selectedDeviceType: selectedDeviceType ?? 'all',
      selectedBrowser: selectedBrowser ?? 'all',
      availableLocales: localeConfig.locales,
      availableCountries: countryBreakdown.map((item) => item.countryCode),
      availableDeviceTypes: deviceBreakdown.map((item) => item.deviceType),
      availableBrowsers: browserBreakdown.map((item) => item.browser),
      localeBreakdown,
      countryBreakdown,
      deviceBreakdown,
      browserBreakdown,
      osBreakdown,
      botViews,
      humanViews,
      totalPageViews: dailyViews.reduce((acc, point) => acc + point.count, 0),
      previousWindowPageViews: previousCount,
      uniquePaths: uniquePaths.size,
      todayPageViews: todayViews,
      topPaths,
      topReferrers,
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

