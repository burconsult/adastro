import { DEFAULT_TEXT_PROVIDER } from './config.js';
import { generateText } from './execution.js';
import { getConfiguredTextProviders } from './provider-catalog.js';
import { getTextProvider } from './provider-registry.js';
import type { AiProviderId, GenerateContentOptions, GenerateContentResponse } from './types.js';

export function getProvider(key: AiProviderId) {
  return getTextProvider(key);
}

export async function generateContent(options: GenerateContentOptions): Promise<GenerateContentResponse> {
  const providerKey = options.provider ?? DEFAULT_TEXT_PROVIDER;
  return generateText({ ...options, provider: providerKey });
}

export function getConfiguredProviders(): AiProviderId[] {
  return getConfiguredTextProviders();
}

export * from './types.js';
