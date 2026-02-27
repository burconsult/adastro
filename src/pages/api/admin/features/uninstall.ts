import type { APIRoute } from 'astro';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAdmin } from '../../../../lib/auth/auth-helpers.js';
import { SettingsService } from '../../../../lib/services/settings-service.js';
import { supabaseAdmin } from '../../../../lib/supabase.js';

const settingsService = new SettingsService();
const PROJECT_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const FEATURE_ROOT = join(PROJECT_ROOT, 'src/lib/features');
const FEATURE_UNINSTALL_SCRIPT = join(PROJECT_ROOT, 'infra/features/uninstall.js');

type FeatureMeta = {
  id?: string;
  entry?: string;
  dataTables?: string[];
  uninstallSql?: string;
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
const isSafeJsonKey = (value: string) => /^[a-z][a-z0-9_-]*$/i.test(value);
const isExecSqlMissingError = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes('exec_sql') && (
    message.includes('does not exist') ||
    message.includes('function') ||
    message.includes('not found')
  );
};

const runExecSql = async (sql: string) => {
  const { error } = await supabaseAdmin.rpc('exec_sql', { sql });
  if (error) {
    throw new Error(error.message);
  }
};

const runUninstaller = (featureId: string, options?: { removeFiles?: boolean }) =>
  new Promise<void>((resolve, reject) => {
    const args = [FEATURE_UNINSTALL_SCRIPT, featureId];
    if (options?.removeFiles) {
      args.push('--remove-files');
    }
    execFile(process.execPath, args, { cwd: PROJECT_ROOT }, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const payload = await request.json().catch(() => ({}));
    const featureId = typeof payload.id === 'string' ? payload.id.trim() : '';
    const purgeData = payload.purgeData === true;
    const removeFiles = payload.removeFiles === true;

    if (!featureId) {
      return new Response(JSON.stringify({ error: 'Feature id is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const featureRoot = findFeatureRoot(featureId);
    const meta = featureRoot ? loadFeatureMeta(featureRoot) : null;
    const dataTables = Array.isArray(meta?.dataTables) ? meta?.dataTables : [];
    const profileDataKey = typeof meta?.profileDataKey === 'string' ? meta.profileDataKey : '';
    const warnings: string[] = [];
    const uninstallSqlPath = meta?.uninstallSql
      ? join(featureRoot ?? '', meta.uninstallSql)
      : featureRoot
        ? join(featureRoot, 'uninstall.sql')
        : null;

    if (purgeData) {
      if (uninstallSqlPath && existsSync(uninstallSqlPath)) {
        const sql = readFileSync(uninstallSqlPath, 'utf-8');
        try {
          await runExecSql(sql);
        } catch (error) {
          if (isExecSqlMissingError(error)) {
            warnings.push('Database helper function exec_sql is missing. Feature SQL cleanup was skipped.');
          } else {
            throw error;
          }
        }
      } else if (dataTables.length > 0) {
        const invalid = dataTables.find((table) => !isSafeTableName(table));
        if (invalid) {
          throw new Error(`Invalid table name: ${invalid}`);
        }
        const dropSql = dataTables
          .map((table) => `DROP TABLE IF EXISTS ${table} CASCADE;`)
          .join('\n');
        try {
          await runExecSql(dropSql);
        } catch (error) {
          if (isExecSqlMissingError(error)) {
            warnings.push('Database helper function exec_sql is missing. Feature tables were not dropped.');
          } else {
            throw error;
          }
        }
      }
      if (profileDataKey) {
        if (!isSafeJsonKey(profileDataKey)) {
          throw new Error(`Invalid profileDataKey: ${profileDataKey}`);
        }
        try {
          await runExecSql(`UPDATE user_profiles SET data = data - '${profileDataKey}';`);
        } catch (error) {
          if (isExecSqlMissingError(error)) {
            warnings.push(`Could not remove "${profileDataKey}" from user profile JSON because exec_sql is missing.`);
          } else {
            throw error;
          }
        }
      }
    }

    await runUninstaller(featureId, { removeFiles });
    await settingsService.deleteSettingsByPrefix(`features.${featureId}.`);

    return new Response(JSON.stringify({ success: true, requiresRestart: true, warnings }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Feature uninstall failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to uninstall feature.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
