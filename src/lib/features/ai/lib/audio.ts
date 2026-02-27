import { getDefaultAudioProvider } from './config.js';
import { ElevenLabsProvider } from './providers/elevenlabs.js';
import { OpenAiAudioProvider } from './providers/openai.js';
import { getConfiguredAudioProviders as getConfiguredAudioProvidersFromCatalog } from './provider-catalog.js';
import type { AiAudioProvider, AiAudioProviderKey, GenerateAudioOptions, GenerateAudioResponse } from './types.js';

const providers: Partial<Record<AiAudioProviderKey, AiAudioProvider>> = {};

export function getAudioProvider(key: AiAudioProviderKey): AiAudioProvider {
  if (key === 'openai') {
    if (!providers.openai) {
      providers.openai = new OpenAiAudioProvider();
    }
    return providers.openai;
  }

  if (key === 'elevenlabs') {
    if (!providers.elevenlabs) {
      providers.elevenlabs = new ElevenLabsProvider();
    }
    return providers.elevenlabs;
  }

  throw new Error(`Unsupported audio provider: ${key}`);
}

export function getConfiguredAudioProviders(): AiAudioProviderKey[] {
  return getConfiguredAudioProvidersFromCatalog();
}

export async function generateAudio(options: GenerateAudioOptions): Promise<GenerateAudioResponse> {
  const providerKey = options.provider ?? getDefaultAudioProvider();
  const provider = getAudioProvider(providerKey);
  return provider.generateAudio({ ...options, provider: providerKey });
}
