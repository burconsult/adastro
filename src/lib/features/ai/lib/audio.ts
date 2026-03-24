import { DEFAULT_AUDIO_PROVIDER } from './config.js';
import { generateAudio as runAudioGeneration } from './execution.js';
import { getConfiguredAudioProviders as getConfiguredAudioProvidersFromCatalog } from './provider-catalog.js';
import { getAudioProvider as getRegistryAudioProvider } from './provider-registry.js';
import type { AiProviderId, GenerateAudioOptions, GenerateAudioResponse } from './types.js';

export function getAudioProvider(key: AiProviderId) {
  return getRegistryAudioProvider(key);
}

export function getConfiguredAudioProviders(): AiProviderId[] {
  return getConfiguredAudioProvidersFromCatalog();
}

export async function generateAudio(options: GenerateAudioOptions): Promise<GenerateAudioResponse> {
  const providerKey = options.provider ?? DEFAULT_AUDIO_PROVIDER;
  return runAudioGeneration({ ...options, provider: providerKey });
}
