import { SettingsService } from '@/lib/services/settings-service';

export type SupportedOAuthProvider = 'github' | 'google';

export interface OAuthProviderAvailability {
  id: SupportedOAuthProvider;
  label: string;
  enabledInApp: boolean;
  enabledInSupabase: boolean;
  available: boolean;
}

const SUPPORTED_PROVIDERS: Array<{ id: SupportedOAuthProvider; label: string; settingKey: string }> = [
  { id: 'github', label: 'GitHub', settingKey: 'auth.oauth.github.enabled' },
  { id: 'google', label: 'Google', settingKey: 'auth.oauth.google.enabled' }
];

const CACHE_TTL_MS = 60_000;
let availabilityCache: { expiresAt: number; data: OAuthProviderAvailability[] } | null = null;

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
  }
  if (typeof value === 'number') return value !== 0;
  return false;
};

const readAppOAuthFlags = async (): Promise<Record<SupportedOAuthProvider, boolean>> => {
  const settingsService = new SettingsService();
  try {
    const raw = await settingsService.getSettings(SUPPORTED_PROVIDERS.map((provider) => provider.settingKey));
    return {
      github: toBoolean(raw['auth.oauth.github.enabled']),
      google: toBoolean(raw['auth.oauth.google.enabled'])
    };
  } catch (error) {
    console.warn('Failed to load app OAuth settings. Falling back to disabled social providers.', error);
    return { github: false, google: false };
  }
};

const readSupabaseOAuthFlags = async (): Promise<Record<SupportedOAuthProvider, boolean>> => {
  const supabaseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const publishableKey = import.meta.env.SUPABASE_PUBLISHABLE_KEY as string | undefined;

  if (!supabaseUrl || !publishableKey) {
    return { github: false, google: false };
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: publishableKey }
    });
    if (!response.ok) {
      throw new Error(`Supabase auth settings request failed (${response.status})`);
    }

    const payload = await response.json().catch(() => ({}));
    const external = payload?.external ?? {};

    return {
      github: Boolean(external.github),
      google: Boolean(external.google)
    };
  } catch (error) {
    console.warn('Failed to load Supabase OAuth provider settings. Falling back to disabled social providers.', error);
    return { github: false, google: false };
  }
};

export async function getOAuthProviderAvailability(options?: { forceRefresh?: boolean }): Promise<OAuthProviderAvailability[]> {
  const now = Date.now();
  if (!options?.forceRefresh && availabilityCache && availabilityCache.expiresAt > now) {
    return availabilityCache.data;
  }

  const [appFlags, supabaseFlags] = await Promise.all([
    readAppOAuthFlags(),
    readSupabaseOAuthFlags()
  ]);

  const data = SUPPORTED_PROVIDERS.map((provider) => {
    const enabledInApp = appFlags[provider.id];
    const enabledInSupabase = supabaseFlags[provider.id];
    return {
      id: provider.id,
      label: provider.label,
      enabledInApp,
      enabledInSupabase,
      available: enabledInApp && enabledInSupabase
    };
  });

  availabilityCache = {
    data,
    expiresAt: now + CACHE_TTL_MS
  };

  return data;
}

export async function isOAuthProviderAvailable(provider: string): Promise<boolean> {
  const normalized = (provider || '').trim().toLowerCase() as SupportedOAuthProvider;
  if (!SUPPORTED_PROVIDERS.some((entry) => entry.id === normalized)) {
    return false;
  }
  const availability = await getOAuthProviderAvailability();
  return availability.some((entry) => entry.id === normalized && entry.available);
}
