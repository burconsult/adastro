import { getEnv } from '../../../env.js';
import { AI_MODEL_REGISTRY } from './model-registry.js';
import type {
  AiAudioProviderKey,
  AiCapability,
  AiImageProviderKey,
  AiProviderCatalogEntry,
  AiProviderId,
  AiProviderKey
} from './types.js';

type ProviderDiscoveryResult = {
  models: string[];
  source: 'remote' | 'registry';
  updatedAt: string;
  error?: string;
};

type ProviderDiscoveryCacheEntry = {
  expiresAt: number;
  value: ProviderDiscoveryResult;
};

const DISCOVERY_TTL_MS = 30 * 60 * 1000;
const DISCOVERY_TIMEOUT_MS = 8_000;

const discoveryCache = new Map<AiProviderId, ProviderDiscoveryCacheEntry>();

const providerCatalog: Record<AiProviderId, AiProviderCatalogEntry> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    docsUrl: 'https://platform.openai.com/docs/models',
    pricingUrl: 'https://openai.com/api/pricing',
    capabilities: {
      text: { supported: true, implemented: true, supportsModelDiscovery: true },
      image: { supported: true, implemented: true, supportsModelDiscovery: true },
      audio: { supported: true, implemented: true, supportsModelDiscovery: true },
      video: { supported: false, implemented: false }
    }
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    envKey: 'GOOGLE_GENAI_API_KEY',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/models',
    pricingUrl: 'https://ai.google.dev/pricing',
    capabilities: {
      text: { supported: true, implemented: true, supportsModelDiscovery: true },
      image: { supported: true, implemented: true, supportsModelDiscovery: true },
      audio: { supported: false, implemented: false },
      video: { supported: false, implemented: false }
    }
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    docsUrl: 'https://docs.anthropic.com/en/docs/about-claude/models',
    pricingUrl: 'https://www.anthropic.com/pricing#api',
    capabilities: {
      text: { supported: true, implemented: true, supportsModelDiscovery: true },
      image: { supported: false, implemented: false },
      audio: { supported: false, implemented: false },
      video: { supported: false, implemented: false }
    }
  },
  elevenlabs: {
    id: 'elevenlabs',
    label: 'ElevenLabs',
    envKey: 'ELEVENLABS_API_KEY',
    docsUrl: 'https://elevenlabs.io/docs/api-reference/models',
    pricingUrl: 'https://elevenlabs.io/pricing',
    capabilities: {
      text: { supported: false, implemented: false },
      image: { supported: false, implemented: false },
      audio: { supported: true, implemented: true, supportsModelDiscovery: true },
      video: { supported: false, implemented: false }
    }
  }
};

const toUnique = (values: string[]) => [...new Set(values.filter((value) => value.trim().length > 0))];

const registryModelsFor = (provider: AiProviderId): string[] => {
  const providerModels = (AI_MODEL_REGISTRY as Record<string, any>)[provider];
  if (!providerModels || typeof providerModels !== 'object') {
    return [];
  }

  const buckets = ['text', 'image', 'audio', 'video'];
  const models: string[] = [];
  for (const bucket of buckets) {
    const bucketModels = providerModels?.[bucket]?.models;
    if (Array.isArray(bucketModels)) {
      models.push(...bucketModels.filter((model) => typeof model === 'string'));
    }
  }
  return toUnique(models);
};

const withTimeout = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const discoverOpenAiModels = async (): Promise<string[]> => {
  const apiKey = getEnv('OPENAI_API_KEY');
  if (!apiKey) return [];
  const response = await withTimeout('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  if (!response.ok) {
    throw new Error(`OpenAI model discovery failed (${response.status})`);
  }
  const payload = await response.json();
  const models = Array.isArray(payload?.data) ? payload.data.map((entry: any) => entry?.id) : [];
  return toUnique(models.filter((value: unknown): value is string => typeof value === 'string'));
};

const discoverGeminiModels = async (): Promise<string[]> => {
  const apiKey = getEnv('GOOGLE_GENAI_API_KEY');
  if (!apiKey) return [];
  const response = await withTimeout(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
  if (!response.ok) {
    throw new Error(`Gemini model discovery failed (${response.status})`);
  }
  const payload = await response.json();
  const models = Array.isArray(payload?.models)
    ? payload.models.map((entry: any) => String(entry?.name || '').replace(/^models\//, ''))
    : [];
  return toUnique(models.filter((value: string) => value.length > 0));
};

const discoverAnthropicModels = async (): Promise<string[]> => {
  const apiKey = getEnv('ANTHROPIC_API_KEY');
  if (!apiKey) return [];
  const response = await withTimeout('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    }
  });
  if (!response.ok) {
    throw new Error(`Anthropic model discovery failed (${response.status})`);
  }
  const payload = await response.json();
  const models = Array.isArray(payload?.data) ? payload.data.map((entry: any) => entry?.id) : [];
  return toUnique(models.filter((value: unknown): value is string => typeof value === 'string'));
};

const discoverElevenLabsModels = async (): Promise<string[]> => {
  const apiKey = getEnv('ELEVENLABS_API_KEY');
  if (!apiKey) return [];
  const response = await withTimeout('https://api.elevenlabs.io/v1/models', {
    headers: { 'xi-api-key': apiKey }
  });
  if (!response.ok) {
    throw new Error(`ElevenLabs model discovery failed (${response.status})`);
  }
  const payload = await response.json();
  const models = Array.isArray(payload)
    ? payload.map((entry: any) => entry?.model_id || entry?.name)
    : Array.isArray(payload?.models)
      ? payload.models.map((entry: any) => entry?.model_id || entry?.name)
      : [];
  return toUnique(models.filter((value: unknown): value is string => typeof value === 'string'));
};

const discoverByProvider = async (provider: AiProviderId): Promise<string[]> => {
  if (provider === 'openai') return discoverOpenAiModels();
  if (provider === 'gemini') return discoverGeminiModels();
  if (provider === 'anthropic') return discoverAnthropicModels();
  if (provider === 'elevenlabs') return discoverElevenLabsModels();
  return [];
};

export const AI_PROVIDER_CATALOG: Record<AiProviderId, AiProviderCatalogEntry> = providerCatalog;

export const getProviderCatalog = (): AiProviderCatalogEntry[] =>
  Object.values(AI_PROVIDER_CATALOG);

export const isProviderConfigured = (provider: AiProviderId): boolean => {
  const envKey = AI_PROVIDER_CATALOG[provider]?.envKey;
  if (!envKey) return false;
  return Boolean(getEnv(envKey));
};

export const getConfiguredProvidersByCapability = (capability: AiCapability): AiProviderId[] =>
  getProviderCatalog()
    .filter((entry) => entry.capabilities[capability]?.implemented)
    .filter((entry) => isProviderConfigured(entry.id))
    .map((entry) => entry.id);

export const getConfiguredTextProviders = (): AiProviderKey[] =>
  getConfiguredProvidersByCapability('text').filter((provider): provider is AiProviderKey =>
    provider === 'openai' || provider === 'gemini' || provider === 'anthropic'
  );

export const getConfiguredImageProviders = (): AiImageProviderKey[] =>
  getConfiguredProvidersByCapability('image').filter((provider): provider is AiImageProviderKey =>
    provider === 'openai' || provider === 'gemini'
  );

export const getConfiguredAudioProviders = (): AiAudioProviderKey[] =>
  getConfiguredProvidersByCapability('audio').filter((provider): provider is AiAudioProviderKey =>
    provider === 'openai' || provider === 'elevenlabs'
  );

export const discoverProviderModels = async (
  provider: AiProviderId,
  options?: { forceRefresh?: boolean }
): Promise<ProviderDiscoveryResult> => {
  const now = Date.now();
  const cached = discoveryCache.get(provider);
  if (!options?.forceRefresh && cached && cached.expiresAt > now) {
    return cached.value;
  }

  const fallbackModels = registryModelsFor(provider);
  try {
    if (!isProviderConfigured(provider)) {
      const value: ProviderDiscoveryResult = {
        models: fallbackModels,
        source: 'registry',
        updatedAt: new Date().toISOString()
      };
      discoveryCache.set(provider, { value, expiresAt: now + DISCOVERY_TTL_MS });
      return value;
    }

    const discoveredModels = await discoverByProvider(provider);
    const merged = toUnique([...fallbackModels, ...discoveredModels]).sort();
    const value: ProviderDiscoveryResult = {
      models: merged,
      source: 'remote',
      updatedAt: new Date().toISOString()
    };
    discoveryCache.set(provider, { value, expiresAt: now + DISCOVERY_TTL_MS });
    return value;
  } catch (error) {
    const value: ProviderDiscoveryResult = {
      models: fallbackModels,
      source: 'registry',
      updatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Failed to refresh provider models'
    };
    discoveryCache.set(provider, { value, expiresAt: now + DISCOVERY_TTL_MS });
    return value;
  }
};

export const discoverAllProviderModels = async (options?: { forceRefresh?: boolean }) => {
  const entries = await Promise.all(
    getProviderCatalog().map(async (provider) => [provider.id, await discoverProviderModels(provider.id, options)] as const)
  );
  return Object.fromEntries(entries) as Record<AiProviderId, ProviderDiscoveryResult>;
};
