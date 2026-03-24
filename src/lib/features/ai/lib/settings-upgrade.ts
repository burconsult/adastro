import type { SettingsService } from '@/lib/services/settings-service.js';
import {
  AI_CONFIG_VERSION,
  AI_SETTING_KEYS,
  DEFAULT_AUDIO_PROVIDER,
  DEFAULT_IMAGE_ASPECT_RATIO,
  DEFAULT_IMAGE_PROVIDER,
  DEFAULT_IMAGE_RESOLUTION,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_TEXT_PROVIDER,
  LEGACY_AI_SETTING_KEYS,
  getDefaultModelForCapability,
  getDefaultVoiceForProvider
} from './config.js';
import type { AiProviderId } from './types.js';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const pickBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const pickNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const asProvider = (value: unknown, fallback: AiProviderId): AiProviderId => {
  if (value === 'gateway' || value === 'openai' || value === 'gemini' || value === 'anthropic' || value === 'elevenlabs') {
    return value;
  }
  return fallback;
};

const pickString = (value: unknown, fallback: string): string =>
  isNonEmptyString(value) ? value.trim() : fallback;

export const buildAiSettingsUpgrade = (source: Record<string, unknown>): Record<string, unknown> => {
  const textProvider = asProvider(
    source['features.ai.capabilities.text.defaultProvider'] ?? source['features.ai.defaultProvider.text'],
    DEFAULT_TEXT_PROVIDER
  );
  const imageProvider = asProvider(
    source['features.ai.capabilities.image.defaultProvider'] ?? source['features.ai.defaultProvider.image'],
    DEFAULT_IMAGE_PROVIDER
  );
  const audioProvider = asProvider(
    source['features.ai.capabilities.audio.defaultProvider'] ?? source['features.ai.defaultProvider.audio'],
    DEFAULT_AUDIO_PROVIDER
  );

  const textModel = pickString(
    source['features.ai.capabilities.text.defaultModel']
      ?? source[`features.ai.model.text.${textProvider}`],
    getDefaultModelForCapability('text', textProvider) || ''
  );
  const imageModel = pickString(
    source['features.ai.capabilities.image.defaultModel']
      ?? source[`features.ai.model.image.${imageProvider}`],
    getDefaultModelForCapability('image', imageProvider) || ''
  );
  const audioModel = pickString(
    source['features.ai.capabilities.audio.defaultModel']
      ?? source[`features.ai.model.audio.${audioProvider}`],
    getDefaultModelForCapability('audio', audioProvider) || ''
  );

  const audioVoice = pickString(
    source['features.ai.capabilities.audio.defaultVoice']
      ?? (audioProvider === 'elevenlabs'
        ? source['features.ai.voice.elevenlabs']
        : source['features.ai.voice.openai']),
    getDefaultVoiceForProvider(audioProvider) || ''
  );

  return {
    'features.ai.configVersion': AI_CONFIG_VERSION,
    'features.ai.tools.seo.enabled': pickBoolean(
      source['features.ai.tools.seo.enabled'] ?? source['features.ai.enableSeo'],
      true
    ),
    'features.ai.tools.image.enabled': pickBoolean(
      source['features.ai.tools.image.enabled'] ?? source['features.ai.enableImages'],
      true
    ),
    'features.ai.tools.audio.enabled': pickBoolean(
      source['features.ai.tools.audio.enabled'] ?? source['features.ai.enableAudio'],
      false
    ),
    'features.ai.limits.enabled': pickBoolean(
      source['features.ai.limits.enabled'] ?? source['features.ai.usageCaps.enabled'],
      false
    ),
    'features.ai.limits.seoDailyRequests': pickNumber(
      source['features.ai.limits.seoDailyRequests'] ?? source['features.ai.usageCaps.seoDailyRequests'],
      0
    ),
    'features.ai.limits.imageDailyRequests': pickNumber(
      source['features.ai.limits.imageDailyRequests'] ?? source['features.ai.usageCaps.imageDailyRequests'],
      0
    ),
    'features.ai.limits.audioDailyRequests': pickNumber(
      source['features.ai.limits.audioDailyRequests'] ?? source['features.ai.usageCaps.audioDailyRequests'],
      0
    ),
    'features.ai.capabilities.text.defaultProvider': textProvider,
    'features.ai.capabilities.text.defaultModel': textModel,
    'features.ai.capabilities.image.defaultProvider': imageProvider,
    'features.ai.capabilities.image.defaultModel': imageModel,
    'features.ai.capabilities.image.defaultSize': pickString(
      source['features.ai.capabilities.image.defaultSize'] ?? source['features.ai.imageSize'],
      DEFAULT_IMAGE_SIZE
    ),
    'features.ai.capabilities.image.defaultAspectRatio': pickString(
      source['features.ai.capabilities.image.defaultAspectRatio'] ?? source['features.ai.imageAspectRatio'],
      DEFAULT_IMAGE_ASPECT_RATIO
    ),
    'features.ai.capabilities.image.defaultResolution': pickString(
      source['features.ai.capabilities.image.defaultResolution'] ?? source['features.ai.imageResolution'],
      DEFAULT_IMAGE_RESOLUTION
    ),
    'features.ai.capabilities.audio.defaultProvider': audioProvider,
    'features.ai.capabilities.audio.defaultModel': audioModel,
    'features.ai.capabilities.audio.defaultVoice': audioVoice
  };
};

export const ensureAiSettingsUpgraded = async (settingsService: SettingsService): Promise<void> => {
  const stored = await settingsService.getSettingsByPrefix('features.ai.');
  const currentVersion = pickNumber(stored['features.ai.configVersion'], 0);
  if (currentVersion >= AI_CONFIG_VERSION) {
    return;
  }

  const resolved = await settingsService.getSettings([
    ...AI_SETTING_KEYS,
    ...LEGACY_AI_SETTING_KEYS
  ]);

  const updates = buildAiSettingsUpgrade(resolved);
  await settingsService.updateSettings(updates);
};
