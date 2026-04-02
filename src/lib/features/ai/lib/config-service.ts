import { normalizeFeatureFlag } from '@/lib/features/flags.js';
import { SettingsService } from '@/lib/services/settings-service.js';
import {
  DEFAULT_AUDIO_PROVIDER,
  DEFAULT_IMAGE_ASPECT_RATIO,
  DEFAULT_IMAGE_PROVIDER,
  DEFAULT_IMAGE_RESOLUTION,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_MEDIA_ANALYSIS_MODEL,
  DEFAULT_MEDIA_ANALYSIS_PROVIDER,
  DEFAULT_TEXT_PROVIDER,
  getDefaultModelForCapability,
  getDefaultVoiceForProvider
} from './config.js';
import {
  getConfiguredProvidersByCapability,
  getProviderCatalog,
  getKnownModelsForProviderCapability,
  getRegistryModelsForProviderCapability
} from './provider-catalog.js';
import { ensureAiSettingsUpgraded } from './settings-upgrade.js';
import type { AiCapability, AiProviderId } from './types.js';

export interface AiRuntimeConfig {
  enabled: boolean;
  tools: {
    seo: boolean;
    image: boolean;
    audio: boolean;
    alt: boolean;
  };
  limits: {
    enabled: boolean;
    seoDailyRequests: number;
    imageDailyRequests: number;
    audioDailyRequests: number;
  };
  capabilities: {
    text: {
      defaultProvider: AiProviderId;
      defaultModel: string;
      mediaAnalysisProvider: AiProviderId;
      mediaAnalysisModel: string;
    };
    image: {
      defaultProvider: AiProviderId;
      defaultModel: string;
      defaultSize: string;
      defaultAspectRatio: string;
      defaultResolution: string;
    };
    audio: {
      defaultProvider: AiProviderId;
      defaultModel: string;
      defaultVoice: string;
      narrationIntroByLocale: Record<string, string>;
      narrationOutroByLocale: Record<string, string>;
    };
  };
}

type CapabilitySelection = {
  provider: AiProviderId;
  model?: string;
  voice?: string;
};

const settingsService = new SettingsService();

const asProvider = (value: unknown, fallback: AiProviderId): AiProviderId => {
  if (value === 'gateway' || value === 'openai' || value === 'gemini' || value === 'anthropic' || value === 'elevenlabs') {
    return value;
  }
  return fallback;
};

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;

const asNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const asStringMap = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, itemValue]) => [key.trim().toLowerCase(), typeof itemValue === 'string' ? itemValue.trim() : ''])
      .filter(([key, itemValue]) => key.length > 0 && itemValue.length > 0)
  );
};

const getFallbackModelForProvider = (provider: AiProviderId, capability: AiCapability): string | undefined => {
  const registryModels = getRegistryModelsForProviderCapability(provider, capability);
  return registryModels[0]?.id || getDefaultModelForCapability(capability, provider);
};

export class AiConfigService {
  async getRuntimeConfig(): Promise<AiRuntimeConfig> {
    await ensureAiSettingsUpgraded(settingsService);

    const settings = await settingsService.getSettings([
      'features.ai.enabled',
      'features.ai.tools.seo.enabled',
      'features.ai.tools.image.enabled',
      'features.ai.tools.audio.enabled',
      'features.ai.tools.alt.enabled',
      'features.ai.limits.enabled',
      'features.ai.limits.seoDailyRequests',
      'features.ai.limits.imageDailyRequests',
      'features.ai.limits.audioDailyRequests',
      'features.ai.capabilities.text.defaultProvider',
      'features.ai.capabilities.text.defaultModel',
      'features.ai.capabilities.text.mediaAnalysisProvider',
      'features.ai.capabilities.text.mediaAnalysisModel',
      'features.ai.capabilities.image.defaultProvider',
      'features.ai.capabilities.image.defaultModel',
      'features.ai.capabilities.image.defaultSize',
      'features.ai.capabilities.image.defaultAspectRatio',
      'features.ai.capabilities.image.defaultResolution',
      'features.ai.capabilities.audio.defaultProvider',
      'features.ai.capabilities.audio.defaultModel',
      'features.ai.capabilities.audio.defaultVoice',
      'features.ai.audio.narrationIntroByLocale',
      'features.ai.audio.narrationOutroByLocale'
    ]);

    const textProvider = asProvider(settings['features.ai.capabilities.text.defaultProvider'], DEFAULT_TEXT_PROVIDER);
    const mediaAnalysisProvider = asProvider(
      settings['features.ai.capabilities.text.mediaAnalysisProvider'],
      DEFAULT_MEDIA_ANALYSIS_PROVIDER
    );
    const imageProvider = asProvider(settings['features.ai.capabilities.image.defaultProvider'], DEFAULT_IMAGE_PROVIDER);
    const audioProvider = asProvider(settings['features.ai.capabilities.audio.defaultProvider'], DEFAULT_AUDIO_PROVIDER);

    return {
      enabled: normalizeFeatureFlag(settings['features.ai.enabled'], false),
      tools: {
        seo: normalizeFeatureFlag(settings['features.ai.tools.seo.enabled'], true),
        image: normalizeFeatureFlag(settings['features.ai.tools.image.enabled'], true),
        audio: normalizeFeatureFlag(settings['features.ai.tools.audio.enabled'], false),
        alt: normalizeFeatureFlag(settings['features.ai.tools.alt.enabled'], true)
      },
      limits: {
        enabled: normalizeFeatureFlag(settings['features.ai.limits.enabled'], false),
        seoDailyRequests: asNumber(settings['features.ai.limits.seoDailyRequests'], 0),
        imageDailyRequests: asNumber(settings['features.ai.limits.imageDailyRequests'], 0),
        audioDailyRequests: asNumber(settings['features.ai.limits.audioDailyRequests'], 0)
      },
      capabilities: {
        text: {
          defaultProvider: textProvider,
          defaultModel: asString(
            settings['features.ai.capabilities.text.defaultModel'],
            getFallbackModelForProvider(textProvider, 'text') || ''
          ),
          mediaAnalysisProvider,
          mediaAnalysisModel: asString(
            settings['features.ai.capabilities.text.mediaAnalysisModel'],
            getFallbackModelForProvider(mediaAnalysisProvider, 'text') || DEFAULT_MEDIA_ANALYSIS_MODEL
          )
        },
        image: {
          defaultProvider: imageProvider,
          defaultModel: asString(
            settings['features.ai.capabilities.image.defaultModel'],
            getFallbackModelForProvider(imageProvider, 'image') || ''
          ),
          defaultSize: asString(settings['features.ai.capabilities.image.defaultSize'], DEFAULT_IMAGE_SIZE),
          defaultAspectRatio: asString(settings['features.ai.capabilities.image.defaultAspectRatio'], DEFAULT_IMAGE_ASPECT_RATIO),
          defaultResolution: asString(settings['features.ai.capabilities.image.defaultResolution'], DEFAULT_IMAGE_RESOLUTION)
        },
        audio: {
          defaultProvider: audioProvider,
          defaultModel: asString(
            settings['features.ai.capabilities.audio.defaultModel'],
            getFallbackModelForProvider(audioProvider, 'audio') || ''
          ),
          defaultVoice: asString(
            settings['features.ai.capabilities.audio.defaultVoice'],
            getDefaultVoiceForProvider(audioProvider) || ''
          ),
          narrationIntroByLocale: asStringMap(settings['features.ai.audio.narrationIntroByLocale']),
          narrationOutroByLocale: asStringMap(settings['features.ai.audio.narrationOutroByLocale'])
        }
      }
    };
  }

  async assertFeatureEnabled(tool?: 'seo' | 'image' | 'audio' | 'alt'): Promise<AiRuntimeConfig> {
    const config = await this.getRuntimeConfig();
    if (!config.enabled) {
      throw new Error('AI tools are disabled');
    }
    if (tool && !config.tools[tool]) {
      throw new Error(
        tool === 'seo'
          ? 'SEO generation is disabled'
          : tool === 'image'
            ? 'AI image generation is disabled'
            : tool === 'audio'
              ? 'AI audio generation is disabled'
              : 'AI alt text generation is disabled'
      );
    }
    return config;
  }

  async resolveMediaAnalysisSelection(
    config: AiRuntimeConfig,
    requestedProvider?: AiProviderId,
    requestedModel?: string
  ): Promise<CapabilitySelection> {
    const imageAwareProviders = getProviderCatalog()
      .filter((provider) => provider.capabilities.text?.implemented && provider.capabilities.text?.supportsImageInput)
      .map((provider) => provider.id);
    const configuredProviders = getConfiguredProvidersByCapability('text')
      .filter((provider) => imageAwareProviders.includes(provider));

    if (configuredProviders.length === 0) {
      throw new Error('No AI media-analysis providers are configured. Add a compatible provider API key first.');
    }

    const defaults = config.capabilities.text;
    const fallbackProvider = defaults.mediaAnalysisProvider;
    const provider = requestedProvider
      ? requestedProvider
      : configuredProviders.includes(fallbackProvider)
        ? fallbackProvider
        : configuredProviders[0];

    if (!configuredProviders.includes(provider)) {
      throw new Error(`Provider "${provider}" is not configured for AI media analysis.`);
    }

    const fallbackModel = provider === defaults.mediaAnalysisProvider
      ? defaults.mediaAnalysisModel
      : (getFallbackModelForProvider(provider, 'text') || DEFAULT_MEDIA_ANALYSIS_MODEL);
    const model = asString(requestedModel, fallbackModel);

    if (requestedModel) {
      const knownModels = (await getKnownModelsForProviderCapability(provider, 'text')).map((entry) => entry.id);
      if (knownModels.length > 0 && !knownModels.includes(model)) {
        throw new Error(`Model "${model}" is not supported by provider "${provider}".`);
      }
    }

    return { provider, model };
  }

  async resolveCapabilitySelection(
    config: AiRuntimeConfig,
    capability: 'text' | 'image' | 'audio',
    requestedProvider?: AiProviderId,
    requestedModel?: string,
    requestedVoice?: string
  ): Promise<CapabilitySelection> {
    const configuredProviders = getConfiguredProvidersByCapability(capability);
    if (configuredProviders.length === 0) {
      throw new Error(`No AI ${capability} providers are configured. Add a provider API key first.`);
    }

    const defaults = config.capabilities[capability];
    const fallbackProvider = defaults.defaultProvider;
    const provider = requestedProvider
      ? requestedProvider
      : configuredProviders.includes(fallbackProvider)
        ? fallbackProvider
        : configuredProviders[0];

    if (!configuredProviders.includes(provider)) {
      throw new Error(`Provider "${provider}" is not configured for AI ${capability}.`);
    }

    const fallbackModel = provider === defaults.defaultProvider
      ? defaults.defaultModel
      : (getFallbackModelForProvider(provider, capability) || '');

    const model = asString(requestedModel, fallbackModel);
    if (requestedModel) {
      const knownModels = (await getKnownModelsForProviderCapability(provider, capability)).map((entry) => entry.id);
      if (knownModels.length > 0 && !knownModels.includes(model)) {
        throw new Error(`Model "${model}" is not supported by provider "${provider}".`);
      }
    }
    const voice = capability === 'audio'
      ? asString(
          requestedVoice,
          provider === defaults.defaultProvider
            ? defaults.defaultVoice
            : (getDefaultVoiceForProvider(provider) || '')
        )
      : undefined;

    return {
      provider,
      model,
      voice
    };
  }
}

export const aiConfigService = new AiConfigService();
