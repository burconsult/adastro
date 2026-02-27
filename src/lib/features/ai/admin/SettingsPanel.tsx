import React, { useEffect, useMemo, useState } from 'react';
import { normalizeFeatureFlag } from '@/lib/features/flags';
import type { FeatureSettingsPanelProps } from '../../types.js';

interface AiStatus {
  aiEnabled?: boolean;
  textProviders?: string[];
  imageProviders?: string[];
  audioProviders?: string[];
  capabilityProviders?: Record<string, string[]>;
}

interface AiModelRegistryResponse {
  registry?: Record<string, any>;
  active?: Record<string, any>;
}

interface AiProviderCatalogResponse {
  providers?: Array<{
    id: string;
    label: string;
    envKey: string;
    docsUrl: string;
    pricingUrl?: string;
    configured?: boolean;
    capabilities?: Record<string, { supported: boolean; implemented: boolean; supportsModelDiscovery?: boolean }>;
    discoveredModels?: { models?: string[]; source?: string; error?: string; updatedAt?: string };
  }>;
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

export const AiSettingsPanel: React.FC<FeatureSettingsPanelProps> = ({
  getSetting,
  getValue,
  renderSetting,
  t
}) => {
  const aiEnabled = normalizeFeatureFlag(getValue('features.ai.enabled'), false);
  const seoEnabled = aiEnabled && normalizeFeatureFlag(getValue('features.ai.enableSeo'), true);
  const imageEnabled = aiEnabled && normalizeFeatureFlag(getValue('features.ai.enableImages'), true);
  const audioEnabled = aiEnabled && normalizeFeatureFlag(getValue('features.ai.enableAudio'), true);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [aiModels, setAiModels] = useState<AiModelRegistryResponse | null>(null);
  const [aiCatalog, setAiCatalog] = useState<AiProviderCatalogResponse | null>(null);
  const [aiUsage, setAiUsage] = useState<AiUsageResponse | null>(null);
  const [aiModelsError, setAiModelsError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AiSettingsTab>('controls');

  useEffect(() => {
    if (!aiEnabled) {
      setAiStatus(null);
      setAiModels(null);
      setAiCatalog(null);
      setAiUsage(null);
      setAiModelsError(null);
      setActiveTab('controls');
      return;
    }

    let cancelled = false;
    const loadAiData = async () => {
      try {
        const [statusResponse, modelsResponse, catalogResponse, usageResponse] = await Promise.all([
          fetch('/api/features/ai/status'),
          fetch('/api/features/ai/models'),
          fetch('/api/features/ai/catalog'),
          fetch('/api/features/ai/usage?days=30')
        ]);

        const statusPayload = statusResponse.ok ? await statusResponse.json() : null;
        const modelPayload = modelsResponse.ok ? await modelsResponse.json() : null;
        const catalogPayload = catalogResponse.ok ? await catalogResponse.json() : null;
        const usagePayload = usageResponse.ok ? await usageResponse.json() : null;

        if (!cancelled) {
          setAiStatus(statusPayload);
          setAiModels(modelPayload);
          setAiCatalog(catalogPayload);
          setAiUsage(usagePayload);
          setAiModelsError(modelsResponse.ok ? null : 'Unable to load AI model settings.');
        }
      } catch (aiError) {
        if (!cancelled) {
          setAiStatus(null);
          setAiModels(null);
          setAiCatalog(null);
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

  const textDefaultProvider = getValue('features.ai.defaultProvider.text') || 'openai';
  const imageDefaultProvider = getValue('features.ai.defaultProvider.image') || 'openai';
  const audioDefaultProvider = getValue('features.ai.defaultProvider.audio') || 'openai';

  const textProviders = Array.isArray(aiStatus?.textProviders) ? aiStatus?.textProviders ?? [] : [];
  const imageProviders = Array.isArray(aiStatus?.imageProviders) ? aiStatus?.imageProviders ?? [] : [];
  const audioProviders = Array.isArray(aiStatus?.audioProviders) ? aiStatus?.audioProviders ?? [] : [];

  const providerEnvMap: Record<string, string> = {
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
        `No AI provider keys detected. Add API keys (${Object.values(providerEnvMap).join(', ')}) in your host environment variables (Vercel/Netlify project settings), then redeploy.`
      );
      return warnings;
    }

    if (seoEnabled && textProviders.length === 0) {
      warnings.push('SEO generation is enabled but no text providers are configured.');
    } else if (seoEnabled && !textProviders.includes(textDefaultProvider)) {
      warnings.push(`Default text provider (${textDefaultProvider}) is not configured. Set ${providerEnvMap[textDefaultProvider] || 'the matching API key'}.`);
    }

    if (imageEnabled && imageProviders.length === 0) {
      warnings.push('Image generation is enabled but no image providers are configured.');
    } else if (imageEnabled && !imageProviders.includes(imageDefaultProvider)) {
      warnings.push(`Default image provider (${imageDefaultProvider}) is not configured. Set ${providerEnvMap[imageDefaultProvider] || 'the matching API key'}.`);
    }

    if (audioEnabled && audioProviders.length === 0) {
      warnings.push('Audio narration is enabled but no audio providers are configured.');
    } else if (audioEnabled && !audioProviders.includes(audioDefaultProvider)) {
      warnings.push(`Default audio provider (${audioDefaultProvider}) is not configured. Set ${providerEnvMap[audioDefaultProvider] || 'the matching API key'}.`);
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
  const optionMap: Record<string, string[] | undefined> = {
    'features.ai.model.text.openai': registry?.openai?.text?.models,
    'features.ai.model.text.gemini': registry?.gemini?.text?.models,
    'features.ai.model.text.anthropic': registry?.anthropic?.text?.models,
    'features.ai.model.image.openai': registry?.openai?.image?.models,
    'features.ai.model.image.gemini': registry?.gemini?.image?.models,
    'features.ai.model.audio.openai': registry?.openai?.audio?.models,
    'features.ai.model.audio.elevenlabs': registry?.elevenlabs?.audio?.models,
    'features.ai.imageSize': registry?.openai?.image?.sizes,
    'features.ai.imageAspectRatio': registry?.gemini?.image?.aspectRatios,
    'features.ai.imageResolution': registry?.gemini?.image?.resolutions
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

  const renderModelList = (label: string, models?: string[]) => (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {models && models.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {models.map((model) => (
            <span key={model} className="badge badge-secondary text-xs">
              {model}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No models reported.</p>
      )}
    </div>
  );

  const providerCatalog = Array.isArray(aiCatalog?.providers) ? aiCatalog.providers : [];
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
            AI tools are disabled. Enable the suite to configure providers and models.
          </div>
        )}
      </div>

      {activeTab === 'controls' && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-4 space-y-4">
              <div>
                <h3 className="text-base font-semibold">{t('settings.features.ai.capabilities.title', 'Capabilities')}</h3>
                <p className="text-xs text-muted-foreground">{t('settings.features.ai.capabilities.description', 'Turn on the AI surfaces you want available.')}</p>
              </div>
              {renderGroup(['features.ai.enableSeo', 'features.ai.enableImages', 'features.ai.enableAudio'], { disabled: !aiEnabled })}
            </div>

            <div className="card p-4 space-y-4">
              <div>
                <h3 className="text-base font-semibold">{t('settings.features.ai.providers.title', 'Providers')}</h3>
                <p className="text-xs text-muted-foreground">{t('settings.features.ai.providers.description', 'Select defaults for text, image, and audio generation.')}</p>
              </div>
              {renderGroup(['features.ai.defaultProvider.text', 'features.ai.defaultProvider.image', 'features.ai.defaultProvider.audio'], { disabled: !aiEnabled })}
            </div>
          </div>

          <div className="card p-4 space-y-4">
            <div>
              <h3 className="text-base font-semibold">{t('settings.features.ai.images.title', 'Image Generation')}</h3>
              <p className="text-xs text-muted-foreground">{t('settings.features.ai.images.description', 'Choose output dimensions for each provider family.')}</p>
            </div>
            {renderGroup(['features.ai.imageSize', 'features.ai.imageAspectRatio', 'features.ai.imageResolution'], { disabled: !aiEnabled })}
          </div>

          <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
            AI content tools appear in Post Editor and Media only while this feature is active.
            Use the Features catalog page to deactivate and fully hide AI UI surfaces.
          </div>
        </>
      )}

      {activeTab === 'models' && aiEnabled && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-4 space-y-4">
              <div>
                <h3 className="text-base font-semibold">{t('settings.features.ai.models.title', 'Models')}</h3>
                <p className="text-xs text-muted-foreground">{t('settings.features.ai.models.description', 'Pin the exact model for each provider.')}</p>
              </div>
              {renderGroup([
                'features.ai.model.text.openai',
                'features.ai.model.text.gemini',
                'features.ai.model.text.anthropic',
                'features.ai.model.image.openai',
                'features.ai.model.image.gemini',
                'features.ai.model.audio.openai',
                'features.ai.model.audio.elevenlabs'
              ], { disabled: !aiEnabled })}
              <div className="pt-2">
                {renderGroup(['features.ai.voice.openai', 'features.ai.voice.elevenlabs'], { disabled: !aiEnabled })}
              </div>
            </div>

            <div className="card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold">{t('settings.features.ai.registry.title', 'Model Registry')}</h3>
                  <p className="text-xs text-muted-foreground">{t('settings.features.ai.registry.description', 'Built-in and provider model catalogs.')}</p>
                </div>
                {aiModelsError && (
                  <span className="text-xs text-destructive">{aiModelsError}</span>
                )}
              </div>
              <div className="space-y-4">
                {renderModelList('OpenAI', registry?.openai?.text?.models)}
                {renderModelList('Gemini', registry?.gemini?.text?.models)}
                {renderModelList('Anthropic', registry?.anthropic?.text?.models)}
                {renderModelList('Image (OpenAI)', registry?.openai?.image?.models)}
                {renderModelList('Image (Gemini)', registry?.gemini?.image?.models)}
                {renderModelList('Audio', [
                  ...(registry?.openai?.audio?.models ?? []),
                  ...(registry?.elevenlabs?.audio?.models ?? [])
                ])}
              </div>
            </div>
          </div>

          <div className="card p-4 space-y-4">
            <div>
              <h3 className="text-base font-semibold">Provider Catalog</h3>
              <p className="text-xs text-muted-foreground">Capability map, env keys, and docs/pricing links for each provider.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {providerCatalog.length > 0 ? providerCatalog.map((provider) => {
                const capabilityChips = Object.entries(provider.capabilities || {})
                  .filter(([, capability]) => capability?.implemented)
                  .map(([name]) => name);
                const discovered = provider.discoveredModels?.models ?? [];
                return (
                  <div key={provider.id} className="rounded-md border border-border/60 p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{provider.label}</p>
                      <span className={`badge badge-secondary ${provider.configured ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : ''}`}>
                        {provider.configured ? 'configured' : 'missing key'}
                      </span>
                    </div>
                    <p className="text-muted-foreground">Env key: {provider.envKey}</p>
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
                    {provider.discoveredModels?.error && (
                      <p className="text-amber-700">{provider.discoveredModels.error}</p>
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
              'features.ai.usageCaps.enabled',
              'features.ai.usageCaps.seoDailyRequests',
              'features.ai.usageCaps.imageDailyRequests',
              'features.ai.usageCaps.audioDailyRequests'
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
