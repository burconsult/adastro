import { getEnv } from '../../../env.js';
import type { AiCapability, AiProviderId } from './types.js';

export const AI_CONFIG_VERSION = 2;
export const DEFAULT_GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1';

export const DEFAULT_TEXT_PROVIDER: AiProviderId = 'gateway';
export const DEFAULT_IMAGE_PROVIDER: AiProviderId = 'gateway';
export const DEFAULT_AUDIO_PROVIDER: AiProviderId = 'elevenlabs';

export const DEFAULT_TEXT_MODELS: Record<AiProviderId, string | undefined> = {
  gateway: 'openai/gpt-4o-mini',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
  anthropic: 'claude-3-5-sonnet-20240620',
  elevenlabs: undefined
};

export const DEFAULT_IMAGE_MODELS: Record<AiProviderId, string | undefined> = {
  gateway: 'openai/gpt-image-1',
  openai: 'gpt-image-1',
  gemini: 'gemini-2.5-flash-image',
  anthropic: undefined,
  elevenlabs: undefined
};

export const DEFAULT_AUDIO_MODELS: Record<AiProviderId, string | undefined> = {
  gateway: undefined,
  openai: 'gpt-4o-mini-tts',
  gemini: undefined,
  anthropic: undefined,
  elevenlabs: 'eleven_turbo_v2'
};

export const DEFAULT_AUDIO_VOICES: Record<AiProviderId, string | undefined> = {
  gateway: undefined,
  openai: 'alloy',
  gemini: undefined,
  anthropic: undefined,
  elevenlabs: 'EXAVITQu4vr4xnSDxMaL'
};

export const DEFAULT_IMAGE_SIZE = '1024x1024';
export const DEFAULT_IMAGE_ASPECT_RATIO = '1:1';
export const DEFAULT_IMAGE_RESOLUTION = '1K';

export const LEGACY_AI_SETTING_KEYS = [
  'features.ai.enabled',
  'features.ai.enableSeo',
  'features.ai.enableImages',
  'features.ai.enableAudio',
  'features.ai.usageCaps.enabled',
  'features.ai.usageCaps.seoDailyRequests',
  'features.ai.usageCaps.imageDailyRequests',
  'features.ai.usageCaps.audioDailyRequests',
  'features.ai.defaultProvider.text',
  'features.ai.defaultProvider.image',
  'features.ai.defaultProvider.audio',
  'features.ai.model.text.openai',
  'features.ai.model.text.gemini',
  'features.ai.model.text.anthropic',
  'features.ai.model.image.openai',
  'features.ai.model.image.gemini',
  'features.ai.model.audio.openai',
  'features.ai.model.audio.elevenlabs',
  'features.ai.voice.openai',
  'features.ai.voice.elevenlabs',
  'features.ai.imageSize',
  'features.ai.imageAspectRatio',
  'features.ai.imageResolution'
] as const;

export const AI_SETTING_KEYS = [
  'features.ai.enabled',
  'features.ai.configVersion',
  'features.ai.tools.seo.enabled',
  'features.ai.tools.image.enabled',
  'features.ai.tools.audio.enabled',
  'features.ai.limits.enabled',
  'features.ai.limits.seoDailyRequests',
  'features.ai.limits.imageDailyRequests',
  'features.ai.limits.audioDailyRequests',
  'features.ai.capabilities.text.defaultProvider',
  'features.ai.capabilities.text.defaultModel',
  'features.ai.capabilities.image.defaultProvider',
  'features.ai.capabilities.image.defaultModel',
  'features.ai.capabilities.image.defaultSize',
  'features.ai.capabilities.image.defaultAspectRatio',
  'features.ai.capabilities.image.defaultResolution',
  'features.ai.capabilities.audio.defaultProvider',
  'features.ai.capabilities.audio.defaultModel',
  'features.ai.capabilities.audio.defaultVoice'
] as const;

export function getDefaultModelForCapability(capability: AiCapability, provider: AiProviderId): string | undefined {
  if (capability === 'text') return DEFAULT_TEXT_MODELS[provider];
  if (capability === 'image') return DEFAULT_IMAGE_MODELS[provider];
  if (capability === 'audio') return DEFAULT_AUDIO_MODELS[provider];
  return undefined;
}

export function getDefaultVoiceForProvider(provider: AiProviderId): string | undefined {
  return DEFAULT_AUDIO_VOICES[provider];
}

export function getDefaultProviderForCapability(capability: AiCapability): AiProviderId {
  if (capability === 'image') return DEFAULT_IMAGE_PROVIDER;
  if (capability === 'audio') return DEFAULT_AUDIO_PROVIDER;
  return DEFAULT_TEXT_PROVIDER;
}

export function getGatewayBaseUrl(): string {
  return getEnv('AI_GATEWAY_BASE_URL') || DEFAULT_GATEWAY_BASE_URL;
}

export function getApiTimeoutMs(): number {
  return 45_000;
}
