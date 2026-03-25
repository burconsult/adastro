import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/auth/auth-helpers';
import { SettingsService } from '@/lib/services/settings-service';
import { supabaseAdmin } from '@/lib/supabase';
import {
  ANALYTICS_RETENTION_SETTING_KEY,
  parseAnalyticsRetentionSettings,
  getAnalyticsRetentionCutoff,
  type AnalyticsRetentionSettingsState
} from '@/lib/analytics/retention';

const settingsService = new SettingsService();

const PAGE_SIZE = 1_000;
const MAX_EXPORT_ROWS = 100_000;

type AnalyticsArchiveRow = {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id?: string | null;
  data: Record<string, unknown>;
  user_agent?: string | null;
  ip_address?: string | null;
  created_at: string;
};

const getRetentionSettings = async (): Promise<AnalyticsRetentionSettingsState> => {
  const value = await settingsService.getSetting(ANALYTICS_RETENTION_SETTING_KEY);
  return parseAnalyticsRetentionSettings(value);
};

const countAnalyticsRows = async (cutoffIso?: string) => {
  let query = supabaseAdmin
    .from('analytics_events')
    .select('id', { count: 'exact', head: true });

  if (cutoffIso) {
    query = query.lt('created_at', cutoffIso);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
};

const getBoundaryTimestamp = async (ascending: boolean) => {
  const { data, error } = await supabaseAdmin
    .from('analytics_events')
    .select('created_at')
    .order('created_at', { ascending })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.created_at ?? null;
};

const fetchArchiveRows = async (cutoffIso: string): Promise<{ rows: AnalyticsArchiveRow[]; truncated: boolean }> => {
  const rows: AnalyticsArchiveRow[] = [];

  for (let offset = 0; offset < MAX_EXPORT_ROWS; offset += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('analytics_events')
      .select('id, event_type, entity_type, entity_id, data, user_agent, ip_address, created_at')
      .lt('created_at', cutoffIso)
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    const page = Array.isArray(data) ? data as AnalyticsArchiveRow[] : [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      return { rows, truncated: false };
    }
  }

  return { rows, truncated: true };
};

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);

    const settings = await getRetentionSettings();
    const cutoffIso = getAnalyticsRetentionCutoff(settings.retentionDays).toISOString();

    const [totalRows, prunableRows, oldestEventAt, newestEventAt] = await Promise.all([
      countAnalyticsRows(),
      countAnalyticsRows(cutoffIso),
      getBoundaryTimestamp(true),
      getBoundaryTimestamp(false)
    ]);

    return new Response(JSON.stringify({
      settings,
      totalRows,
      prunableRows,
      oldestEventAt,
      newestEventAt,
      pruneBefore: cutoffIso,
      overWarnThreshold: totalRows >= settings.warnAtRowCount
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error loading analytics retention summary:', error);
    const message = error instanceof Error ? error.message : 'Failed to load analytics retention summary';
    const status = /admin access required/i.test(message) ? 403 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);

    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === 'string' ? body.action : '';
    const settings = await getRetentionSettings();
    const retentionDays = typeof body.retentionDays === 'number'
      ? parseAnalyticsRetentionSettings({ ...settings, retentionDays: body.retentionDays }).retentionDays
      : settings.retentionDays;
    const cutoffIso = getAnalyticsRetentionCutoff(retentionDays).toISOString();

    if (action === 'export') {
      const { rows, truncated } = await fetchArchiveRows(cutoffIso);
      const payload = {
        exportedAt: new Date().toISOString(),
        retentionDays,
        pruneBefore: cutoffIso,
        truncated,
        rowCount: rows.length,
        rows
      };

      return new Response(JSON.stringify(payload, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="analytics-archive-before-${cutoffIso.slice(0, 10)}.json"`,
          'X-Analytics-Archive-Truncated': truncated ? '1' : '0',
          'X-Analytics-Archive-Row-Count': String(rows.length),
          'X-Analytics-Archive-Prune-Before': cutoffIso
        }
      });
    }

    if (action === 'prune') {
      const prunableRows = await countAnalyticsRows(cutoffIso);

      if (prunableRows === 0) {
        return new Response(JSON.stringify({
          success: true,
          prunedRows: 0,
          pruneBefore: cutoffIso
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (settings.archiveBeforePrune && body.archiveAcknowledged !== true) {
        return new Response(JSON.stringify({
          error: 'Archive download must be acknowledged before pruning analytics data.'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const { error } = await supabaseAdmin
        .from('analytics_events')
        .delete()
        .lt('created_at', cutoffIso);

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        prunedRows: prunableRows,
        pruneBefore: cutoffIso
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Unsupported analytics retention action.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error processing analytics retention action:', error);
    const message = error instanceof Error ? error.message : 'Failed to process analytics retention action';
    const status = /admin access required/i.test(message) ? 403 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const prerender = false;
