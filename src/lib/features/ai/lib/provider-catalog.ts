import { getEnv } from '../../../env.js';
import { getApiTimeoutMs, getGatewayBaseUrl } from './config.js';
import { AI_MODEL_REGISTRY } from './model-registry.js';
import {
  AI_PROVIDER_REGISTRY,
  getProviderRegistry as getRegisteredProviders,
  supportsCapability
} from './provider-registry.js';
import type {
  AiCapability,
  AiModelDescriptor,
  AiModelSource,
  AiProviderDescriptor,
  AiProviderId,
  AiVoiceDescriptor
} from './types.js';

export type ProviderDiscoveryResult = {
  models: AiModelDescriptor[];
  source: AiModelSource;
  updatedAt: string;
  error?: string;
};

export type ProviderVoiceDiscoveryResult = {
  voices: AiVoiceDescriptor[];
  source: AiModelSource;
  updatedAt: string;
  error?: string;
};

type ProviderDiscoveryCacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const DISCOVERY_TTL_MS = 30 * 60 * 1000;

const modelDiscoveryCache = new Map<AiProviderId, ProviderDiscoveryCacheEntry<ProviderDiscoveryResult>>();
const voiceDiscoveryCache = new Map<AiProviderId, ProviderDiscoveryCacheEntry<ProviderVoiceDiscoveryResult>>();

const toUniqueById = <T extends { id: string }>(values: T[]) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.id.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const nowIso = () => new Date().toISOString();

const withTimeout = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  return fetch(input, {
    ...init,
    signal: AbortSignal.timeout(getApiTimeoutMs())
  });
};

const inferOpenAiLikeCapabilities = (modelId: string): AiCapability[] => {
  const normalized = modelId.toLowerCase();
  if (normalized.includes('image') || normalized.startsWith('dall') || normalized.includes('/imagen')) {
    return ['image'];
  }
  if (normalized.includes('tts') || normalized.startsWith('tts-') || normalized.includes('speech')) {
    return ['audio'];
  }
  return ['text'];
};

const inferGeminiCapabilities = (modelId: string): AiCapability[] => {
  const normalized = modelId.toLowerCase();
  if (normalized.includes('image')) return ['image'];
  return ['text'];
};

const registryModelsFor = (provider: AiProviderId): AiModelDescriptor[] => {
  const providerModels = (AI_MODEL_REGISTRY as Record<string, any>)[provider];
  if (!providerModels || typeof providerModels !== 'object') {
    return [];
  }

  const buckets: AiCapability[] = ['text', 'image', 'audio', 'video'];
  const models: AiModelDescriptor[] = [];

  for (const capability of buckets) {
    const bucketModels = providerModels?.[capability]?.models;
    if (!Array.isArray(bucketModels)) continue;
    for (const model of bucketModels) {
      if (typeof model !== 'string' || !model.trim()) continue;
      models.push({
        id: model,
        name: model,
        provider,
        capabilities: [capability],
        source: 'registry'
      });
    }
  }

  return toUniqueById(models);
};

const registryVoicesFor = (provider: AiProviderId): AiVoiceDescriptor[] => {
  const voices = (AI_MODEL_REGISTRY as Record<string, any>)?.[provider]?.audio?.voices;
  if (!Array.isArray(voices)) return [];

  return voices
    .map((voice: any) => {
      if (typeof voice === 'string') {
        return { id: voice, name: voice, provider, source: 'registry' as const };
      }
      if (voice && typeof voice.id === 'string') {
        return {
          id: voice.id,
          name: typeof voice.name === 'string' && voice.name.trim() ? voice.name : voice.id,
          provider,
          source: 'registry' as const
        };
      }
      return null;
    })
    .filter((voice): voice is AiVoiceDescriptor => Boolean(voice));
};

const normalizeRemoteModels = (
  provider: AiProviderId,
  rows: Array<{ id: string; name?: string; description?: string }>,
  capabilityInferer: (modelId: string) => AiCapability[]
): AiModelDescriptor[] => {
  return toUniqueById(rows
    .map((row) => {
      const capabilities = capabilityInferer(row.id).filter((capability) => supportsCapability(provider, capability));
      if (capabilities.length === 0) return null;
      return {
        id: row.id,
        name: row.name?.trim() || row.id,
        description: row.description,
        provider,
        capabilities,
        source: 'remote' as const,
        updatedAt: nowIso(),
        raw: row
      };
    })
    .filter((model): model is AiModelDescriptor => Boolean(model)));
};

const discoverGatewayModels = async (): Promise<AiModelDescriptor[]> => {
  const apiKey = getEnv('AI_GATEWAY_API_KEY');
  if (!apiKey) return [];

  const response = await withTimeout(`${getGatewayBaseUrl()}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  if (!response.ok) {
    throw new Error(`Gateway model discovery failed (${response.status})`);
  }
  const payload = await response.json();
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return normalizeRemoteModels('gateway', rows, inferOpenAiLikeCapabilities);
};

const discoverOpenAiModels = async (): Promise<AiModelDescriptor[]> => {
  const apiKey = getEnv('OPENAI_API_KEY');
  if (!apiKey) return [];

  const response = await withTimeout('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  if (!response.ok) {
    throw new Error(`OpenAI model discovery failed (${response.status})`);
  }
  const payload = await response.json();
  const rows = Array.isArray(payload?.data)
    ? payload.data.map((entry: any) => ({
        id: String(entry?.id || ''),
        name: String(entry?.id || ''),
        description: typeof entry?.owned_by === 'string' ? `Owned by ${entry.owned_by}` : undefined
      }))
    : [];
  return normalizeRemoteModels('openai', rows, inferOpenAiLikeCapabilities);
};

const discoverGeminiModels = async (): Promise<AiModelDescriptor[]> => {
  const apiKey = getEnv('GOOGLE_GENAI_API_KEY');
  if (!apiKey) return [];

  const response = await withTimeout(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
  if (!response.ok) {
    throw new Error(`Gemini model discovery failed (${response.status})`);
  }
  const payload = await response.json();
  const rows = Array.isArray(payload?.models)
    ? payload.models.map((entry: any) => ({
        id: String(entry?.name || '').replace(/^models\//, ''),
        name: String(entry?.displayName || entry?.name || '').replace(/^models\//, ''),
        description: typeof entry?.description === 'string' ? entry.description : undefined
      }))
    : [];
  return normalizeRemoteModels('gemini', rows, inferGeminiCapabilities);
};

const discoverAnthropicModels = async (): Promise<AiModelDescriptor[]> => {
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
  const rows = Array.isArray(payload?.data)
    ? payload.data.map((entry: any) => ({
        id: String(entry?.id || ''),
        name: String(entry?.name || entry?.id || ''),
        description: typeof entry?.description === 'string' ? entry.description : undefined
      }))
    : [];
  return normalizeRemoteModels('anthropic', rows, () => ['text']);
};

const discoverElevenLabsModels = async (): Promise<AiModelDescriptor[]> => {
  const apiKey = getEnv('ELEVENLABS_API_KEY');
  if (!apiKey) return [];

  const response = await withTimeout('https://api.elevenlabs.io/v1/models', {
    headers: { 'xi-api-key': apiKey }
  });
  if (!response.ok) {
    throw new Error(`ElevenLabs model discovery failed (${response.status})`);
  }
  const payload = await response.json();
  const rows = Array.isArray(payload)
    ? payload.map((entry: any) => ({
        id: String(entry?.model_id || entry?.name || ''),
        name: String(entry?.name || entry?.model_id || ''),
        description: typeof entry?.description === 'string' ? entry.description : undefined
      }))
    : [];
  return normalizeRemoteModels('elevenlabs', rows, () => ['audio']);
};

const discoverElevenLabsVoices = async (): Promise<AiVoiceDescriptor[]> => {
  const apiKey = getEnv('ELEVENLABS_API_KEY');
  if (!apiKey) return [];

  const response = await withTimeout('https://api.elevenlabs.io/v1/voices/search?page_size=100', {
    headers: { 'xi-api-key': apiKey }
  });
  if (!response.ok) {
    throw new Error(`ElevenLabs voice discovery failed (${response.status})`);
  }

  const payload = await response.json();
  const voices = Array.isArray(payload?.voices) ? payload.voices : [];
  return toUniqueById(voices
    .map((voice: any) => {
      const id = typeof voice?.voice_id === 'string' ? voice.voice_id : '';
      if (!id) return null;
      return {
        id,
        name: typeof voice?.name === 'string' && voice.name.trim() ? voice.name : id,
        provider: 'elevenlabs' as const,
        source: 'remote' as const,
        updatedAt: nowIso(),
        raw: voice
      };
    })
    .filter((voice): voice is AiVoiceDescriptor => Boolean(voice)));
};

const discoverByProvider = async (provider: AiProviderId): Promise<AiModelDescriptor[]> => {
  if (provider === 'gateway') return discoverGatewayModels();
  if (provider === 'openai') return discoverOpenAiModels();
  if (provider === 'gemini') return discoverGeminiModels();
  if (provider === 'anthropic') return discoverAnthropicModels();
  if (provider === 'elevenlabs') return discoverElevenLabsModels();
  return [];
};

export const AI_PROVIDER_CATALOG: Record<AiProviderId, AiProviderDescriptor> = Object.fromEntries(
  getRegisteredProviders().map((provider) => [provider.id, provider])
) as Record<AiProviderId, AiProviderDescriptor>;

export const getProviderCatalog = (): AiProviderDescriptor[] =>
  getRegisteredProviders();

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

export const getConfiguredTextProviders = (): AiProviderId[] =>
  getConfiguredProvidersByCapability('text');

export const getConfiguredImageProviders = (): AiProviderId[] =>
  getConfiguredProvidersByCapability('image');

export const getConfiguredAudioProviders = (): AiProviderId[] =>
  getConfiguredProvidersByCapability('audio');

export const getRegistryModelsForProvider = (provider: AiProviderId): AiModelDescriptor[] =>
  registryModelsFor(provider);

export const getRegistryModelsForProviderCapability = (provider: AiProviderId, capability: AiCapability): AiModelDescriptor[] =>
  registryModelsFor(provider).filter((model) => model.capabilities.includes(capability));

export const getRegistryVoicesForProvider = (provider: AiProviderId): AiVoiceDescriptor[] =>
  registryVoicesFor(provider);

export const getKnownModelsForProviderCapability = async (
  provider: AiProviderId,
  capability: AiCapability,
  options?: { forceRefresh?: boolean }
): Promise<AiModelDescriptor[]> => {
  const discovery = await discoverProviderModels(provider, options);
  return discovery.models.filter((model) => model.capabilities.includes(capability));
};

export const discoverProviderModels = async (
  provider: AiProviderId,
  options?: { forceRefresh?: boolean }
): Promise<ProviderDiscoveryResult> => {
  const now = Date.now();
  const cached = modelDiscoveryCache.get(provider);
  if (!options?.forceRefresh && cached && cached.expiresAt > now) {
    return cached.value;
  }

  const fallbackModels = registryModelsFor(provider);
  try {
    if (!isProviderConfigured(provider)) {
      const value: ProviderDiscoveryResult = {
        models: fallbackModels,
        source: 'registry',
        updatedAt: nowIso()
      };
      modelDiscoveryCache.set(provider, { value, expiresAt: now + DISCOVERY_TTL_MS });
      return value;
    }

    const discoveredModels = await discoverByProvider(provider);
    const merged = toUniqueById([...fallbackModels, ...discoveredModels]);
    const value: ProviderDiscoveryResult = {
      models: merged,
      source: discoveredModels.length > 0 ? 'remote' : 'registry',
      updatedAt: nowIso()
    };
    modelDiscoveryCache.set(provider, { value, expiresAt: now + DISCOVERY_TTL_MS });
    return value;
  } catch (error) {
    const value: ProviderDiscoveryResult = {
      models: fallbackModels,
      source: 'registry',
      updatedAt: nowIso(),
      error: error instanceof Error ? error.message : 'Failed to refresh provider models'
    };
    modelDiscoveryCache.set(provider, { value, expiresAt: now + DISCOVERY_TTL_MS });
    return value;
  }
};

export const discoverAllProviderModels = async (options?: { forceRefresh?: boolean }) => {
  const entries = await Promise.all(
    getProviderCatalog().map(async (provider) => [provider.id, await discoverProviderModels(provider.id, options)] as const)
  );
  return Object.fromEntries(entries) as Record<AiProviderId, ProviderDiscoveryResult>;
};

export const discoverProviderVoices = async (
  provider: AiProviderId,
  options?: { forceRefresh?: boolean }
): Promise<ProviderVoiceDiscoveryResult> => {
  const now = Date.now();
  const cached = voiceDiscoveryCache.get(provider);
  if (!options?.forceRefresh && cached && cached.expiresAt > now) {
    return cached.value;
  }

  const fallbackVoices = registryVoicesFor(provider);
  try {
    if (provider !== 'elevenlabs' || !isProviderConfigured(provider)) {
      const value: ProviderVoiceDiscoveryResult = {
        voices: fallbackVoices,
        source: 'registry',
        updatedAt: nowIso()
      };
      voiceDiscoveryCache.set(provider, { value, expiresAt: now + DISCOVERY_TTL_MS });
      return value;
    }

    const discoveredVoices = await discoverElevenLabsVoices();
    const merged = toUniqueById([...fallbackVoices, ...discoveredVoices]);
    const value: ProviderVoiceDiscoveryResult = {
      voices: merged,
      source: discoveredVoices.length > 0 ? 'remote' : 'registry',
      updatedAt: nowIso()
    };
    voiceDiscoveryCache.set(provider, { value, expiresAt: now + DISCOVERY_TTL_MS });
    return value;
  } catch (error) {
    const value: ProviderVoiceDiscoveryResult = {
      voices: fallbackVoices,
      source: 'registry',
      updatedAt: nowIso(),
      error: error instanceof Error ? error.message : 'Failed to refresh provider voices'
    };
    voiceDiscoveryCache.set(provider, { value, expiresAt: now + DISCOVERY_TTL_MS });
    return value;
  }
};
