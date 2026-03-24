import React, { useEffect, useMemo, useState } from 'react';
import { normalizeFeatureFlag } from '@/lib/features/flags';
import type { FeatureSettingsPanelProps } from '../../types.js';

interface AiStatus {
  aiEnabled?: boolean;
  textProviders?: string[];
  imageProviders?: string[];
  audioProviders?: string[];
  defaults?: Record<string, any>;
  tools?: Record<string, boolean>;
  capabilityProviders?: Record<string, string[]>;
}

interface AiModelRegistryResponse {
  registry?: Record<string, any>;
  active?: Record<string, any>;
  providers?: Array<{
    id: string;
    label: string;
    envKey: string;
    docsUrl: string;
    pricingUrl?: string;
    configured?: boolean;
    executionMode?: string;
    capabilities?: Record<string, { supported: boolean; implemented: boolean; supportsModelDiscovery?: boolean; supportsVoiceDiscovery?: boolean }>;
    discoveredModels?: {
      models?: Array<{ id: string; name?: string; capabilities?: string[] }>;
      source?: string;
      error?: string;
      updatedAt?: string;
    };
    discoveredVoices?: { voices?: Array<{ id: string; name: string }>; source?: string; error?: string; updatedAt?: string };
  }>;
}

interface AiDiscoveredModel {
  id: string;
  name?: string;
  capabilities?: string[];
}

interface AiProviderCatalogEntry {
  id: string;
  label: string;
  envKey: string;
  docsUrl: string;
  pricingUrl?: string;
  configured?: boolean;
  executionMode?: string;
  capabilities?: Record<string, { supported: boolean; implemented: boolean; supportsModelDiscovery?: boolean; supportsVoiceDiscovery?: boolean }>;
  discoveredModels?: {
    models?: AiDiscoveredModel[];
    source?: string;
    error?: string;
    updatedAt?: string;
  };
  discoveredVoices?: { voices?: Array<{ id: string; name: string }>; source?: string; error?: string; updatedAt?: string };
}

interface AiUsageResponse {
  summary?: {
    days?: number;
    totals?: {
      requests?: number;
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    };
    byCapability?: Record<string, { requests?: number }>;
  };
  caps?: {
    enabled?: boolean;
    seoDailyRequests?: number;
    imageDailyRequests?: number;
    audioDailyRequests?: number;
  };
}

type AiSettingsTab = 'controls' | 'models' | 'usage';

const getRegistryModelsFor = (
  registry: Record<string, any>,
  provider: string,
  capability: 'text' | 'image' | 'audio'
): string[] => {
  const providerRegistry = registry?.[provider];
  const bucket = providerRegistry?.[capability];
  return Array.isArray(bucket?.models) ? bucket.models : [];
};

const getRegistryVoicesFor = (registry: Record<string, any>, provider: string): string[] => {
  const voices = registry?.[provider]?.audio?.voices;
  if (!Array.isArray(voices)) return [];
  return voices
    .map((voice: any) => {
      if (typeof voice === 'string') return voice;
      if (voice && typeof voice.id === 'string') return voice.id;
      return null;
    })
    .filter((voice): voice is string => Boolean(voice));
};

const providerLabel = (provider: string) => {
  if (provider === 'gateway') return 'Vercel AI Gateway';
  if (provider === 'openai') return 'OpenAI';
  if (provider === 'gemini') return 'Gemini';
  if (provider === 'anthropic') return 'Anthropic';
  if (provider === 'elevenlabs') return 'ElevenLabs';
  return provider;
};

const matchesCapabilityFromModelId = (provider: string, capability: 'text' | 'image' | 'audio', modelId: string) => {
  const normalized = modelId.toLowerCase();
  if (capability === 'image') return normalized.includes('image') || normalized.includes('dall') || normalized.includes('imagen');
  if (capability === 'audio') return normalized.includes('tts') || normalized.startsWith('tts-') || provider === 'elevenlabs';
  return !normalized.includes('image') && !normalized.includes('tts');
};

export const AiSettingsPanel: React.FC<FeatureSettingsPanelProps> = ({
  getSetting,
  getValue,
  renderSetting,
  t
}) => {
  const aiEnabled = normalizeFeatureFlag(getValue('features.ai.enabled'), false);
  const seoEnabled = aiEnabled && normalizeFeatureFlag(getValue('features.ai.tools.seo.enabled'), true);
  const imageEnabled = aiEnabled && normalizeFeatureFlag(getValue('features.ai.tools.image.enabled'), true);
  const audioEnabled = aiEnabled && normalizeFeatureFlag(getValue('features.ai.tools.audio.enabled'), false);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [aiModels, setAiModels] = useState<AiModelRegistryResponse | null>(null);
  const [aiUsage, setAiUsage] = useState<AiUsageResponse | null>(null);
  const [aiModelsError, setAiModelsError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AiSettingsTab>('controls');

  useEffect(() => {
    if (!aiEnabled) {
      setAiStatus(null);
      setAiModels(null);
      setAiUsage(null);
      setAiModelsError(null);
      setActiveTab('controls');
      return;
    }

    let cancelled = false;
    const loadAiData = async () => {
      try {
        const [statusResponse, modelsResponse, usageResponse] = await Promise.all([
          fetch('/api/features/ai/status'),
          fetch('/api/features/ai/models?sync=true'),
          fetch('/api/features/ai/usage?days=30')
        ]);

        const statusPayload = statusResponse.ok ? await statusResponse.json() : null;
        const modelPayload = modelsResponse.ok ? await modelsResponse.json() : null;
        const usagePayload = usageResponse.ok ? await usageResponse.json() : null;

        if (!cancelled) {
          setAiStatus(statusPayload);
          setAiModels(modelPayload);
          setAiUsage(usagePayload);
          setAiModelsError(modelsResponse.ok ? null : 'Unable to load AI model settings.');
        }
      } catch (aiError) {
        if (!cancelled) {
          setAiStatus(null);
          setAiModels(null);
          setAiUsage(null);
          setAiModelsError(aiError instanceof Error ? aiError.message : 'Unable to load AI status.');
        }
      }
    };

    void loadAiData();

    return () => {
      cancelled = true;
    };
  }, [aiEnabled]);

  const textDefaultProvider = getValue('features.ai.capabilities.text.defaultProvider') || 'gateway';
  const imageDefaultProvider = getValue('features.ai.capabilities.image.defaultProvider') || 'gateway';
  const audioDefaultProvider = getValue('features.ai.capabilities.audio.defaultProvider') || 'elevenlabs';

  const textProviders = Array.isArray(aiStatus?.textProviders) ? aiStatus.textProviders ?? [] : [];
  const imageProviders = Array.isArray(aiStatus?.imageProviders) ? aiStatus.imageProviders ?? [] : [];
  const audioProviders = Array.isArray(aiStatus?.audioProviders) ? aiStatus.audioProviders ?? [] : [];

  const providerEnvMap: Record<string, string> = {
    gateway: 'AI_GATEWAY_API_KEY',
    openai: 'OPENAI_API_KEY',
    gemini: 'GOOGLE_GENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    elevenlabs: 'ELEVENLABS_API_KEY'
  };

  const aiWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!aiEnabled) return warnings;

    if (!aiStatus) {
      warnings.push('AI status is unavailable. Save settings and refresh to validate provider keys.');
      return warnings;
    }

    if (textProviders.length === 0 && imageProviders.length === 0 && audioProviders.length === 0) {
      warnings.push(
        `No AI provider keys detected. Add API keys (${Object.values(providerEnvMap).join(', ')}) in your host environment variables, then redeploy.`
      );
      return warnings;
    }

    if (seoEnabled && textProviders.length === 0) {
      warnings.push('SEO generation is enabled but no text providers are configured.');
    } else if (seoEnabled && !textProviders.includes(textDefaultProvider)) {
      warnings.push(`Default text provider (${providerLabel(textDefaultProvider)}) is not configured. Set ${providerEnvMap[textDefaultProvider] || 'the matching API key'}.`);
    }

    if (imageEnabled && imageProviders.length === 0) {
      warnings.push('Image generation is enabled but no image providers are configured.');
    } else if (imageEnabled && !imageProviders.includes(imageDefaultProvider)) {
      warnings.push(`Default image provider (${providerLabel(imageDefaultProvider)}) is not configured. Set ${providerEnvMap[imageDefaultProvider] || 'the matching API key'}.`);
    }

    if (audioEnabled && audioProviders.length === 0) {
      warnings.push('Audio narration is enabled but no audio providers are configured.');
    } else if (audioEnabled && !audioProviders.includes(audioDefaultProvider)) {
      warnings.push(`Default audio provider (${providerLabel(audioDefaultProvider)}) is not configured. Set ${providerEnvMap[audioDefaultProvider] || 'the matching API key'}.`);
    }

    return warnings;
  }, [
    aiEnabled,
    aiStatus,
    audioDefaultProvider,
    audioEnabled,
    audioProviders,
    imageDefaultProvider,
    imageEnabled,
    imageProviders,
    seoEnabled,
    textDefaultProvider,
    textProviders
  ]);

  const registry = aiModels?.registry ?? {};
  const providers: AiProviderCatalogEntry[] = Array.isArray(aiModels?.providers) ? aiModels.providers : [];

  const getProviderOptionsFor = (
    capability: 'text' | 'image' | 'audio',
    fallback: string[]
  ): string[] => {
    const dynamicOptions = providers
      .filter((provider) => provider.capabilities?.[capability]?.implemented)
      .map((provider) => provider.id);
    return dynamicOptions.length > 0 ? dynamicOptions : fallback;
  };

  const getDiscoveredModelsFor = (provider: string, capability: 'text' | 'image' | 'audio'): string[] => {
    const providerEntry = providers.find((entry) => entry.id === provider);
    const discoveredEntries = Array.isArray(providerEntry?.discoveredModels?.models)
      ? providerEntry?.discoveredModels?.models ?? []
      : [];
    const bucketModels = getRegistryModelsFor(registry, provider, capability);
    const filteredDiscovered = discoveredEntries
      .filter((model) => {
        if (Array.isArray(model.capabilities) && model.capabilities.length > 0) {
          return model.capabilities.includes(capability);
        }
        return matchesCapabilityFromModelId(provider, capability, model.id);
      })
      .map((model) => model.id);
    return [...new Set([...filteredDiscovered, ...bucketModels])];
  };

  const getDiscoveredVoicesFor = (provider: string): string[] => {
    const providerEntry = providers.find((entry) => entry.id === provider);
    const discovered = Array.isArray(providerEntry?.discoveredVoices?.voices)
      ? providerEntry?.discoveredVoices?.voices?.map((voice) => voice.id) ?? []
      : [];
    return [...new Set([...discovered, ...getRegistryVoicesFor(registry, provider)])];
  };

  const optionMap: Record<string, string[] | undefined> = {
    'features.ai.capabilities.text.defaultProvider': getProviderOptionsFor('text', ['gateway', 'openai', 'gemini', 'anthropic']),
    'features.ai.capabilities.image.defaultProvider': getProviderOptionsFor('image', ['gateway', 'openai', 'gemini']),
    'features.ai.capabilities.audio.defaultProvider': getProviderOptionsFor('audio', ['elevenlabs', 'openai']),
    'features.ai.capabilities.text.defaultModel': getDiscoveredModelsFor(String(textDefaultProvider), 'text'),
    'features.ai.capabilities.image.defaultModel': getDiscoveredModelsFor(String(imageDefaultProvider), 'image'),
    'features.ai.capabilities.audio.defaultModel': getDiscoveredModelsFor(String(audioDefaultProvider), 'audio'),
    'features.ai.capabilities.audio.defaultVoice': audioDefaultProvider === 'elevenlabs'
      ? getDiscoveredVoicesFor('elevenlabs')
      : undefined,
    'features.ai.capabilities.image.defaultSize': registry?.openai?.image?.sizes || registry?.gateway?.image?.sizes,
    'features.ai.capabilities.image.defaultAspectRatio': registry?.gemini?.image?.aspectRatios,
    'features.ai.capabilities.image.defaultResolution': registry?.gemini?.image?.resolutions
  };

  const renderGroup = (keys: string[], options?: { disabled?: boolean }) => (
    <div className="space-y-4">
      {keys.map((key) => {
        const setting = getSetting(key);
        if (!setting) return null;
        return (
          <div key={key} className="border-b border-border/60 pb-4 last:border-b-0">
            {renderSetting(setting, {
              disabled: options?.disabled,
              options: optionMap[key]
            })}
          </div>
        );
      })}
    </div>
  );

  const providerCatalog = providers;
  const usageSummary = aiUsage?.summary;
  const usageTotals = usageSummary?.totals;
  const capabilityUsage = usageSummary?.byCapability ?? {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-card/40 p-2">
        <button
          type="button"
          className={`btn h-9 px-4 text-sm ${activeTab === 'controls' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('controls')}
        >
          Controls
        </button>
        <button
          type="button"
          className={`btn h-9 px-4 text-sm ${activeTab === 'models' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('models')}
          disabled={!aiEnabled}
        >
          Models
        </button>
        <button
          type="button"
          className={`btn h-9 px-4 text-sm ${activeTab === 'usage' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('usage')}
          disabled={!aiEnabled}
        >
          Usage & Limits
        </button>
      </div>

      <div className="card p-4 space-y-4">
        <div>
          <h3 className="text-base font-semibold">{t('settings.features.ai.title', 'AI Suite')}</h3>
          <p className="text-xs text-muted-foreground">{t('settings.features.ai.description', 'Enable or pause every AI feature in the app.')}</p>
        </div>
        {renderGroup(['features.ai.enabled'])}
        {aiEnabled ? (
          aiWarnings.length > 0 ? (
            <div className="rounded-md border border-amber-300/50 bg-amber-50/70 p-3 text-xs text-amber-900">
              <ul className="space-y-1">
                {aiWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-md border border-emerald-200/70 bg-emerald-50/70 p-3 text-xs text-emerald-900">
              AI providers detected and ready.
            </div>
          )
        ) : (
          <div className="rounded-md border border-border/60 bg-muted/50 p-3 text-xs text-muted-foreground">
            AI tools are disabled. Enable the suite to configure per-capability providers and models.
          </div>
        )}
      </div>

      {activeTab === 'controls' && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-4 space-y-4">
              <div>
                <h3 className="text-base font-semibold">Capabilities</h3>
                <p className="text-xs text-muted-foreground">Turn on the AI surfaces you want available.</p>
              </div>
              {renderGroup(['features.ai.tools.seo.enabled', 'features.ai.tools.image.enabled', 'features.ai.tools.audio.enabled'], { disabled: !aiEnabled })}
            </div>

            <div className="card p-4 space-y-4">
              <div>
                <h3 className="text-base font-semibold">Per-Capability Providers</h3>
                <p className="text-xs text-muted-foreground">Choose the default provider independently for text, image, and audio.</p>
              </div>
              {renderGroup([
                'features.ai.capabilities.text.defaultProvider',
                'features.ai.capabilities.image.defaultProvider',
                'features.ai.capabilities.audio.defaultProvider'
              ], { disabled: !aiEnabled })}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-4 space-y-4">
              <div>
                <h3 className="text-base font-semibold">Image Defaults</h3>
                <p className="text-xs text-muted-foreground">Use OpenAI-compatible size settings or Gemini image controls depending on provider.</p>
              </div>
              {renderGroup([
                'features.ai.capabilities.image.defaultSize',
                'features.ai.capabilities.image.defaultAspectRatio',
                'features.ai.capabilities.image.defaultResolution'
              ], { disabled: !aiEnabled })}
            </div>

            <div className="card p-4 space-y-4">
              <div>
                <h3 className="text-base font-semibold">Provider Health</h3>
                <p className="text-xs text-muted-foreground">Current capability availability from configured env keys.</p>
              </div>
              <div className="space-y-2 text-xs">
                <p>Text providers: {textProviders.length > 0 ? textProviders.map(providerLabel).join(', ') : 'none'}</p>
                <p>Image providers: {imageProviders.length > 0 ? imageProviders.map(providerLabel).join(', ') : 'none'}</p>
                <p>Audio providers: {audioProviders.length > 0 ? audioProviders.map(providerLabel).join(', ') : 'none'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
            Text, image, and audio defaults are independent. Mixed provider modality support is expected and supported.
          </div>
        </>
      )}

      {activeTab === 'models' && aiEnabled && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-4 space-y-4">
              <div>
                <h3 className="text-base font-semibold">Active Defaults</h3>
                <p className="text-xs text-muted-foreground">Pin the current model for each capability and set the default audio voice.</p>
              </div>
              {renderGroup([
                'features.ai.capabilities.text.defaultModel',
                'features.ai.capabilities.image.defaultModel',
                'features.ai.capabilities.audio.defaultModel',
                'features.ai.capabilities.audio.defaultVoice'
              ], { disabled: !aiEnabled })}
            </div>

            <div className="card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold">Discovered Catalog</h3>
                  <p className="text-xs text-muted-foreground">Registry fallbacks plus remote provider discovery when available.</p>
                </div>
                {aiModelsError && (
                  <span className="text-xs text-destructive">{aiModelsError}</span>
                )}
              </div>
              <div className="space-y-4 text-xs">
                <div>
                  <p className="font-semibold">Text ({providerLabel(String(textDefaultProvider))})</p>
                  <p className="text-muted-foreground">{getDiscoveredModelsFor(String(textDefaultProvider), 'text').slice(0, 8).join(', ') || 'No models reported.'}</p>
                </div>
                <div>
                  <p className="font-semibold">Image ({providerLabel(String(imageDefaultProvider))})</p>
                  <p className="text-muted-foreground">{getDiscoveredModelsFor(String(imageDefaultProvider), 'image').slice(0, 8).join(', ') || 'No models reported.'}</p>
                </div>
                <div>
                  <p className="font-semibold">Audio ({providerLabel(String(audioDefaultProvider))})</p>
                  <p className="text-muted-foreground">{getDiscoveredModelsFor(String(audioDefaultProvider), 'audio').slice(0, 8).join(', ') || 'No models reported.'}</p>
                </div>
                {audioDefaultProvider === 'elevenlabs' && (
                  <div>
                    <p className="font-semibold">ElevenLabs Voices</p>
                    <p className="text-muted-foreground">{getDiscoveredVoicesFor('elevenlabs').slice(0, 8).join(', ') || 'No voices reported.'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card p-4 space-y-4">
            <div>
              <h3 className="text-base font-semibold">Provider Catalog</h3>
              <p className="text-xs text-muted-foreground">Capability map, env keys, discovery health, and docs/pricing links for each provider.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {providerCatalog.length > 0 ? providerCatalog.map((provider) => {
                const capabilityChips = Object.entries(provider.capabilities || {})
                  .filter(([, capability]) => capability?.implemented)
                  .map(([name]) => name);
                const discovered = provider.discoveredModels?.models ?? [];
                const discoveredVoices = provider.discoveredVoices?.voices ?? [];
                return (
                  <div key={provider.id} className="rounded-md border border-border/60 p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{provider.label}</p>
                      <span className={`badge badge-secondary ${provider.configured ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : ''}`}>
                        {provider.configured ? 'configured' : 'missing key'}
                      </span>
                    </div>
                    <p className="text-muted-foreground">Env key: {provider.envKey}</p>
                    <p className="text-muted-foreground">Execution: {provider.executionMode || 'direct'}</p>
                    <p className="text-muted-foreground">
                      Capabilities: {capabilityChips.length > 0 ? capabilityChips.join(', ') : 'none'}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <a href={provider.docsUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">Docs</a>
                      {provider.pricingUrl && (
                        <a href={provider.pricingUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">Pricing</a>
                      )}
                    </div>
                    {discovered.length > 0 && (
                      <p className="text-muted-foreground">Discovered models: {discovered.slice(0, 6).join(', ')}{discovered.length > 6 ? '…' : ''}</p>
                    )}
                    {discoveredVoices.length > 0 && (
                      <p className="text-muted-foreground">Discovered voices: {discoveredVoices.slice(0, 4).map((voice) => voice.name).join(', ')}</p>
                    )}
                    {provider.discoveredModels?.error && (
                      <p className="text-amber-700">{provider.discoveredModels.error}</p>
                    )}
                    {provider.discoveredVoices?.error && (
                      <p className="text-amber-700">{provider.discoveredVoices.error}</p>
                    )}
                  </div>
                );
              }) : (
                <p className="text-xs text-muted-foreground">Provider catalog unavailable.</p>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'usage' && aiEnabled && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-4 space-y-4">
            <div>
              <h3 className="text-base font-semibold">Usage Caps</h3>
              <p className="text-xs text-muted-foreground">Optional per-user daily limits. Set 0 to keep unlimited.</p>
            </div>
            {renderGroup([
              'features.ai.limits.enabled',
              'features.ai.limits.seoDailyRequests',
              'features.ai.limits.imageDailyRequests',
              'features.ai.limits.audioDailyRequests'
            ], { disabled: !aiEnabled })}
          </div>

          <div className="card p-4 space-y-4">
            <div>
              <h3 className="text-base font-semibold">Usage Report (Last {usageSummary?.days ?? 30} Days)</h3>
              <p className="text-xs text-muted-foreground">Simple request and token totals from `ai_usage_events`.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-border/60 p-2">
                <p className="text-muted-foreground">Requests</p>
                <p className="text-sm font-semibold">{usageTotals?.requests ?? 0}</p>
              </div>
              <div className="rounded-md border border-border/60 p-2">
                <p className="text-muted-foreground">Total Tokens</p>
                <p className="text-sm font-semibold">{usageTotals?.totalTokens ?? 0}</p>
              </div>
              <div className="rounded-md border border-border/60 p-2">
                <p className="text-muted-foreground">Input Tokens</p>
                <p className="text-sm font-semibold">{usageTotals?.inputTokens ?? 0}</p>
              </div>
              <div className="rounded-md border border-border/60 p-2">
                <p className="text-muted-foreground">Output Tokens</p>
                <p className="text-sm font-semibold">{usageTotals?.outputTokens ?? 0}</p>
              </div>
            </div>
            <div className="space-y-1 text-xs">
              {Object.entries(capabilityUsage).length > 0 ? Object.entries(capabilityUsage).map(([capability, row]) => (
                <p key={capability} className="flex items-center justify-between">
                  <span className="capitalize">{capability}</span>
                  <span>{row?.requests ?? 0} requests</span>
                </p>
              )) : (
                <p className="text-muted-foreground">No AI usage logged yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
