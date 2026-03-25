import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/auth/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase';
import { getSiteLocaleConfig } from '@/lib/site-config';
import { normalizeLocaleCode } from '@/lib/i18n/locales';
import {
  buildAnalyticsReport,
  getAnalyticsWindowRange,
  type AnalyticsDeviceType,
  type AnalyticsRow,
  type AnalyticsTrafficFilter
} from '@/lib/analytics/reporting';

const MAX_DAYS = 90;
const MAX_ROWS = 25_000;
const PAGE_SIZE = 1_000;
const DEVICE_TYPES = new Set<AnalyticsDeviceType>(['desktop', 'mobile', 'tablet', 'bot', 'other', 'unknown']);

const clampDays = (value: number) => {
  if (!Number.isFinite(value)) return 30;
  return Math.max(1, Math.min(MAX_DAYS, Math.round(value)));
};

const normalizeCountryFilter = (value: string | null): string | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : undefined;
};

const normalizeDeviceFilter = (value: string | null): AnalyticsDeviceType | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase() as AnalyticsDeviceType;
  return DEVICE_TYPES.has(normalized) ? normalized : undefined;
};

const normalizeBrowserFilter = (value: string | null): string | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().slice(0, 80);
  return normalized.length > 0 ? normalized : undefined;
};

const normalizeTrafficFilter = (value: string | null): AnalyticsTrafficFilter => {
  if (value === 'human' || value === 'bot') return value;
  return 'all';
};

const fetchAnalyticsRows = async ({
  fromIso,
  toIso
}: {
  fromIso: string;
  toIso: string;
}): Promise<AnalyticsRow[]> => {
  const rows: AnalyticsRow[] = [];

  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('analytics_events')
      .select('created_at, data')
      .eq('event_type', 'page_view')
      .eq('entity_type', 'page')
      .gte('created_at', fromIso)
      .lt('created_at', toIso)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    const page = Array.isArray(data) ? data : [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
};

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
    const selectedTrafficType = normalizeTrafficFilter(url.searchParams.get('traffic'));
    const range = getAnalyticsWindowRange(days, new Date());

    const [currentRows, previousRows] = await Promise.all([
      fetchAnalyticsRows({
        fromIso: range.currentStartInclusive.toISOString(),
        toIso: range.currentEndExclusive.toISOString()
      }),
      fetchAnalyticsRows({
        fromIso: range.previousStartInclusive.toISOString(),
        toIso: range.previousEndExclusive.toISOString()
      })
    ]);

    const report = buildAnalyticsReport({
      currentRows,
      previousRows,
      days,
      localeConfig,
      siteHost: new URL(request.url).host,
      selectedLocale,
      selectedCountryCode,
      selectedDeviceType,
      selectedBrowser,
      selectedTrafficType,
      now: new Date(range.currentEndExclusive.getTime() - 1)
    });

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load analytics summary';
    const status = /admin access required/i.test(message) ? 403 : 500;

    console.error('Error loading analytics summary:', error);
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const prerender = false;
