import { supabaseAdmin } from '../supabase.js';
import aiUsageSql from './ai/migrations/000_ai_usage.sql?raw';
import commentsSchemaSql from './comments/migrations/000_comments.sql?raw';
import newsletterSchemaSql from './newsletter/migrations/000_newsletter.sql?raw';

const FEATURE_ENABLE_KEY_PATTERN = /^features\.([a-z0-9-]+)\.enabled$/i;

const BUNDLED_FEATURE_MIGRATIONS: Record<string, string[]> = {
  ai: [aiUsageSql],
  comments: [commentsSchemaSql],
  newsletter: [newsletterSchemaSql]
};

const isExecSqlMissingError = (message: string) => (
  message.includes('exec_sql')
  && (
    message.includes('does not exist')
    || message.includes('function')
    || message.includes('not found')
  )
);

export const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') return false;
  }
  return Boolean(value);
};

export const getFeatureIdFromEnableKey = (key: string): string | null => {
  const match = key.match(FEATURE_ENABLE_KEY_PATTERN);
  return match?.[1] ?? null;
};

export const applyBundledFeatureMigrations = async (featureId: string): Promise<void> => {
  const migrations = BUNDLED_FEATURE_MIGRATIONS[featureId];
  if (!migrations || migrations.length === 0) return;

  for (const sql of migrations) {
    const { error } = await supabaseAdmin.rpc('exec_sql', { sql });
    if (!error) continue;

    const message = String(error.message || '');
    if (isExecSqlMissingError(message.toLowerCase())) {
      throw new Error(
        'Feature schema helper function `exec_sql` is missing. Re-run Core Schema SQL from /setup and retry activation.'
      );
    }
    throw new Error(`Failed to apply ${featureId} feature migration: ${message}`);
  }
};
