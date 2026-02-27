import { AnthropicProvider } from './providers/anthropic.js';
import { GeminiProvider } from './providers/gemini.js';
import { OpenAiProvider } from './providers/openai.js';
import { getDefaultProvider } from './config.js';
import { getConfiguredTextProviders } from './provider-catalog.js';
import type { AiProvider, AiProviderKey, GenerateContentOptions, GenerateContentResponse } from './types.js';

const providers: Partial<Record<AiProviderKey, AiProvider>> = {};

export function getProvider(key: AiProviderKey): AiProvider {
  if (key === 'openai') {
    if (!providers.openai) {
      providers.openai = new OpenAiProvider();
    }
    return providers.openai;
  }

  if (key === 'gemini') {
    if (!providers.gemini) {
      providers.gemini = new GeminiProvider();
    }
    return providers.gemini;
  }

  if (key === 'anthropic') {
    if (!providers.anthropic) {
      providers.anthropic = new AnthropicProvider();
    }
    return providers.anthropic;
  }

  throw new Error(`Unsupported AI provider: ${key}`);
}

export async function generateContent(options: GenerateContentOptions): Promise<GenerateContentResponse> {
  const providerKey = (options.provider ?? getDefaultProvider());
  const provider = getProvider(providerKey);
  return provider.generate({ ...options, provider: providerKey });
}

export function getConfiguredProviders(): AiProviderKey[] {
  return getConfiguredTextProviders();
}

export * from './types.js';
