import { DEFAULT_IMAGE_PROVIDER } from './config.js';
import { generateImage as runImageGeneration } from './execution.js';
import { getConfiguredImageProviders as getConfiguredImageProvidersFromCatalog } from './provider-catalog.js';
import { getImageProvider as getRegistryImageProvider } from './provider-registry.js';
import type { AiProviderId, GenerateImageOptions, GenerateImageResponse } from './types.js';

export function getImageProvider(key: AiProviderId) {
  return getRegistryImageProvider(key);
}

export function getConfiguredImageProviders(): AiProviderId[] {
  return getConfiguredImageProvidersFromCatalog();
}

export async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  const providerKey = options.provider ?? DEFAULT_IMAGE_PROVIDER;
  return runImageGeneration({ ...options, provider: providerKey });
}
