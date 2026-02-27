import { supabaseAdmin } from '@/lib/supabase';

export const STORAGE_MEDIA_BUCKET_KEY = 'storage.buckets.media';
export const STORAGE_MIGRATION_BUCKET_KEY = 'storage.buckets.migrationUploads';

export const DEFAULT_MEDIA_BUCKET = 'media-assets';
export const DEFAULT_MIGRATION_BUCKET = 'migration-uploads';

const BUCKET_NAME_MAX_LENGTH = 63;
const BUCKET_CACHE_TTL_MS = 15000;

export type StorageBucketConfig = {
  media: string;
  migrationUploads: string;
};

let bucketCache: { value: StorageBucketConfig; expiresAt: number } | null = null;

const hasSupabaseSecretKey = (): boolean => {
  const runtimeValue = typeof process !== 'undefined' ? process.env.SUPABASE_SECRET_KEY : undefined;
  const buildValue = import.meta.env.SUPABASE_SECRET_KEY as string | undefined;
  const candidate = runtimeValue || buildValue;
  return typeof candidate === 'string' && candidate.trim().length > 0 && candidate !== 'missing-secret-key';
};

const normalizeBucketName = (value: string, fallback: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!normalized) return fallback;

  let candidate = normalized.slice(0, BUCKET_NAME_MAX_LENGTH).replace(/-+$/g, '');
  if (!candidate) return fallback;

  if (!/^[a-z0-9]/.test(candidate)) {
    candidate = `a${candidate}`.slice(0, BUCKET_NAME_MAX_LENGTH);
  }
  if (!/[a-z0-9]$/.test(candidate)) {
    candidate = `${candidate}0`.slice(0, BUCKET_NAME_MAX_LENGTH);
  }

  if (candidate.length < 3) {
    return fallback;
  }

  return candidate;
};

const toHostSlug = (siteUrl: string | null | undefined): string | null => {
  if (!siteUrl) return null;
  try {
    const host = new URL(siteUrl).hostname.toLowerCase();
    const labels = host.split('.').filter(Boolean);

    let base = labels[0] || '';
    if (host.endsWith('.vercel.app') || host.endsWith('.netlify.app')) {
      base = labels[0] || '';
    } else if (labels[0] === 'www' && labels.length > 1) {
      base = labels[1];
    }

    const slug = base
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || null;
  } catch {
    return null;
  }
};

const getRuntimeSiteUrl = (): string | undefined => {
  if (typeof process !== 'undefined' && process.env.SITE_URL) {
    return process.env.SITE_URL;
  }
  return import.meta.env.SITE_URL as string | undefined;
};

const getRuntimeBucketOverrides = () => ({
  media: (typeof process !== 'undefined' ? process.env.MEDIA_STORAGE_BUCKET : undefined)
    || (import.meta.env.MEDIA_STORAGE_BUCKET as string | undefined),
  migrationUploads: (typeof process !== 'undefined' ? process.env.MIGRATION_UPLOADS_BUCKET : undefined)
    || (import.meta.env.MIGRATION_UPLOADS_BUCKET as string | undefined)
});

const parseJsonStringValue = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
};

const isMissingTableError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('does not exist')
    || normalized.includes('could not find the table')
    || normalized.includes('relation')
  );
};

export const deriveBucketConfigFromSiteUrl = (
  siteUrl: string | null | undefined
): StorageBucketConfig => {
  const hostSlug = toHostSlug(siteUrl);
  if (!hostSlug) {
    return {
      media: DEFAULT_MEDIA_BUCKET,
      migrationUploads: DEFAULT_MIGRATION_BUCKET
    };
  }

  return {
    media: normalizeBucketName(`${hostSlug}-media-assets`, DEFAULT_MEDIA_BUCKET),
    migrationUploads: normalizeBucketName(`${hostSlug}-migration-uploads`, DEFAULT_MIGRATION_BUCKET)
  };
};

export const getFallbackStorageBucketConfig = (
  siteUrl: string | null | undefined
): StorageBucketConfig => {
  const derived = deriveBucketConfigFromSiteUrl(siteUrl || getRuntimeSiteUrl() || null);
  const overrides = getRuntimeBucketOverrides();

  return {
    media: normalizeBucketName(overrides.media || derived.media, DEFAULT_MEDIA_BUCKET),
    migrationUploads: normalizeBucketName(overrides.migrationUploads || derived.migrationUploads, DEFAULT_MIGRATION_BUCKET)
  };
};

export const getStorageBucketConfig = async (options?: {
  siteUrl?: string | null;
  bypassCache?: boolean;
}): Promise<StorageBucketConfig> => {
  const fallback = getFallbackStorageBucketConfig(options?.siteUrl ?? null);

  if (!hasSupabaseSecretKey()) {
    return fallback;
  }

  const now = Date.now();
  if (!options?.bypassCache && bucketCache && bucketCache.expiresAt > now) {
    return bucketCache.value;
  }

  try {
    const adminClient = supabaseAdmin as any;
    if (!adminClient || typeof adminClient.from !== 'function') {
      return fallback;
    }

    const query = adminClient.from('site_settings');
    if (!query || typeof query.select !== 'function') {
      return fallback;
    }

    const { data, error } = await query
      .select('key,value')
      .in('key', [STORAGE_MEDIA_BUCKET_KEY, STORAGE_MIGRATION_BUCKET_KEY]);

    if (error) {
      if (isMissingTableError(String(error.message || ''))) {
        return fallback;
      }
      throw new Error(error.message);
    }

    const mediaSetting = data?.find((row: any) => row.key === STORAGE_MEDIA_BUCKET_KEY);
    const migrationSetting = data?.find((row: any) => row.key === STORAGE_MIGRATION_BUCKET_KEY);

    const resolved: StorageBucketConfig = {
      media: normalizeBucketName(parseJsonStringValue(mediaSetting?.value) || fallback.media, DEFAULT_MEDIA_BUCKET),
      migrationUploads: normalizeBucketName(parseJsonStringValue(migrationSetting?.value) || fallback.migrationUploads, DEFAULT_MIGRATION_BUCKET)
    };

    bucketCache = {
      value: resolved,
      expiresAt: now + BUCKET_CACHE_TTL_MS
    };

    return resolved;
  } catch (error) {
    console.warn('Failed to load storage bucket settings. Falling back to defaults.', error);
    return fallback;
  }
};

export const upsertStorageBucketConfig = async (config: StorageBucketConfig): Promise<void> => {
  if (!hasSupabaseSecretKey()) {
    throw new Error('SUPABASE_SECRET_KEY is required to persist storage bucket settings.');
  }

  const normalized: StorageBucketConfig = {
    media: normalizeBucketName(config.media, DEFAULT_MEDIA_BUCKET),
    migrationUploads: normalizeBucketName(config.migrationUploads, DEFAULT_MIGRATION_BUCKET)
  };

  const adminClient = supabaseAdmin as any;
  if (!adminClient || typeof adminClient.from !== 'function') {
    throw new Error('Supabase admin client is not available for storage configuration.');
  }

  const query = adminClient.from('site_settings');
  if (!query || typeof query.upsert !== 'function') {
    throw new Error('Supabase admin client does not support settings upsert.');
  }

  const { error } = await query.upsert([
      {
        key: STORAGE_MEDIA_BUCKET_KEY,
        value: normalized.media,
        category: 'system',
        description: 'Supabase Storage bucket for public media uploads'
      },
      {
        key: STORAGE_MIGRATION_BUCKET_KEY,
        value: normalized.migrationUploads,
        category: 'system',
        description: 'Supabase Storage bucket for temporary migration uploads'
      }
    ], {
    onConflict: 'key'
  });

  if (error) {
    throw new Error(`Could not persist storage bucket settings: ${error.message}`);
  }

  bucketCache = {
    value: normalized,
    expiresAt: Date.now() + BUCKET_CACHE_TTL_MS
  };
};
