import { getDefaultImageProvider } from './config.js';
import { GeminiImageProvider } from './providers/gemini.js';
import { OpenAiImageProvider } from './providers/openai.js';
import { getConfiguredImageProviders as getConfiguredImageProvidersFromCatalog } from './provider-catalog.js';
import type { AiImageProvider, AiImageProviderKey, GenerateImageOptions, GenerateImageResponse } from './types.js';

const providers: Partial<Record<AiImageProviderKey, AiImageProvider>> = {};

export function getImageProvider(key: AiImageProviderKey): AiImageProvider {
  if (key === 'openai') {
    if (!providers.openai) {
      providers.openai = new OpenAiImageProvider();
    }
    return providers.openai;
  }

  if (key === 'gemini') {
    if (!providers.gemini) {
      providers.gemini = new GeminiImageProvider();
    }
    return providers.gemini;
  }

  throw new Error(`Unsupported image provider: ${key}`);
}

export function getConfiguredImageProviders(): AiImageProviderKey[] {
  return getConfiguredImageProvidersFromCatalog();
}

export async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  const providerKey = options.provider ?? getDefaultImageProvider();
  const provider = getImageProvider(providerKey);
  return provider.generateImage({ ...options, provider: providerKey });
}
