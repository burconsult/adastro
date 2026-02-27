import type { APIRoute } from 'astro';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAdmin } from '../../../../lib/auth/auth-helpers.js';
import { SettingsService } from '../../../../lib/services/settings-service.js';
import { supabaseAdmin } from '../../../../lib/supabase.js';

const settingsService = new SettingsService();
const FEATURE_ROOT = join(fileURLToPath(new URL('../../../../../', import.meta.url)), 'src/lib/features');

type FeatureMeta = {
  id?: string;
  entry?: string;
  dataTables?: string[];
  profileDataKey?: string;
};

const findFeatureRoot = (featureId: string) => {
  const featureRoot = join(FEATURE_ROOT, featureId);
  if (existsSync(featureRoot)) return featureRoot;
  return null;
};

const loadFeatureMeta = (featureRoot: string): FeatureMeta | null => {
  const metaPath = join(featureRoot, 'feature.json');
  if (!existsSync(metaPath)) return null;
  const raw = readFileSync(metaPath, 'utf-8');
  return JSON.parse(raw) as FeatureMeta;
};

const isSafeTableName = (value: string) => /^[a-z][a-z0-9_]*$/.test(value);
const isMissingTableError = (error: unknown) => {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as any).code) : '';
  const message = typeof error === 'object' && error && 'message' in error
    ? String((error as any).message).toLowerCase()
    : '';
  return code === '42P01' || message.includes('does not exist') || message.includes('could not find the table');
};

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const payload = await request.json().catch(() => ({}));
    const featureId = typeof payload.id === 'string' ? payload.id.trim() : '';
    if (!featureId) {
      return new Response(JSON.stringify({ error: 'Feature id is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const featureRoot = findFeatureRoot(featureId);
    if (!featureRoot) {
      return new Response(JSON.stringify({ error: 'Feature package not found.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const meta = loadFeatureMeta(featureRoot);
    const dataTables = Array.isArray(meta?.dataTables) ? meta?.dataTables : [];
    const profileDataKey = typeof meta?.profileDataKey === 'string' ? meta.profileDataKey : '';
    const warnings: string[] = [];

    const settings = await settingsService.getSettingsByPrefix(`features.${featureId}.`);
    const tableData: Record<string, any[]> = {};

    for (const table of dataTables) {
      if (!isSafeTableName(table)) {
        throw new Error(`Invalid table name: ${table}`);
      }
      const { data, error } = await (supabaseAdmin as any).from(table).select('*');
      if (error) {
        if (isMissingTableError(error)) {
          tableData[table] = [];
          warnings.push(`Table "${table}" not found. Exported as empty.`);
          continue;
        }
        throw new Error(`Failed to export ${table}: ${error.message}`);
      }
      tableData[table] = data ?? [];
    }

    let profileData: Array<{ authUserId: string; data: any }> | undefined;
    if (profileDataKey) {
      const { data, error } = await (supabaseAdmin as any)
        .from('user_profiles')
        .select('auth_user_id, data');
      if (error) {
        if (isMissingTableError(error)) {
          warnings.push('Table "user_profiles" not found. Profile feature data was skipped.');
          profileData = [];
        } else {
          throw new Error(`Failed to export profile data: ${error.message}`);
        }
      } else {
        profileData = (data || [])
          .map((row: any) => ({
            authUserId: row.auth_user_id,
            data: row.data?.[profileDataKey]
          }))
          .filter((row: any) => row.data !== undefined);
      }
    }

    const exportPayload = {
      feature: {
        id: featureId,
        exportedAt: new Date().toISOString()
      },
      warnings,
      settings,
      tables: tableData,
      profileData: profileData ?? []
    };

    return new Response(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="feature-${featureId}-backup.json"`
      }
    });
  } catch (error) {
    console.error('Feature export failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to export feature data.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
