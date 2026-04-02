type UsagePricingMethod = 'exact' | 'estimate' | 'range' | 'unpriced';

type UsagePricingInput = {
  capability: string;
  provider: string;
  model?: string | null;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  metadata?: Record<string, unknown>;
};

export type UsageCostEstimate = {
  method: UsagePricingMethod;
  estimatedUsd: number;
  minimumUsd: number;
  maximumUsd: number;
};

const ONE_MILLION = 1_000_000;
const ONE_THOUSAND = 1_000;
const CHARS_PER_TOKEN_ESTIMATE = 4;

const roundUsd = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

const cost = (value: number, method: UsagePricingMethod): UsageCostEstimate => ({
  method,
  estimatedUsd: roundUsd(value),
  minimumUsd: roundUsd(value),
  maximumUsd: roundUsd(value)
});

const costRange = (minimumUsd: number, maximumUsd: number): UsageCostEstimate => ({
  method: 'range',
  estimatedUsd: roundUsd((minimumUsd + maximumUsd) / 2),
  minimumUsd: roundUsd(minimumUsd),
  maximumUsd: roundUsd(maximumUsd)
});

const unpriced = (): UsageCostEstimate => ({
  method: 'unpriced',
  estimatedUsd: 0,
  minimumUsd: 0,
  maximumUsd: 0
});

const asRecord = (value: unknown): Record<string, unknown> => (
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
);

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const toLower = (value: string | null | undefined) => (value || '').trim().toLowerCase();

const normalizeProviderModel = (provider: string, model?: string | null) => {
  const normalizedProvider = toLower(provider);
  const normalizedModel = toLower(model);

  if (normalizedProvider === 'gateway' && normalizedModel.includes('/')) {
    const [sourceProvider, ...rest] = normalizedModel.split('/');
    const sourceModel = rest.join('/');
    if (sourceProvider && sourceModel) {
      return {
        provider: sourceProvider,
        model: sourceModel
      };
    }
  }

  return {
    provider: normalizedProvider,
    model: normalizedModel
  };
};

const normalizeModelAlias = (model: string, capability: string) => {
  if (!model) return model;

  if (capability === 'image') {
    if (model.startsWith('gpt-image-1-mini')) return 'gpt-image-1-mini';
    if (model.startsWith('gpt-image-1')) return 'gpt-image-1';
    if (model.startsWith('gemini-2.5-flash-image')) return 'gemini-2.5-flash-image';
    if (model.startsWith('gemini-3-pro-image-preview') || model === 'gemini-3-pro') return 'gemini-3-pro-image-preview';
  }

  if (capability === 'audio') {
    if (model.startsWith('gpt-4o-mini-tts')) return 'gpt-4o-mini-tts';
    if (model.startsWith('tts-1-hd')) return 'tts-1-hd';
    if (model === 'tts-1' || model.startsWith('tts-1-')) return 'tts-1';
  }

  if (model.startsWith('gpt-4o-mini')) return 'gpt-4o-mini';
  if (model === 'gpt-4o' || model.startsWith('gpt-4o-')) return 'gpt-4o';
  if (model.startsWith('gpt-5.4-mini')) return 'gpt-5.4-mini';
  if (model.startsWith('gpt-5.4')) return 'gpt-5.4';
  if (model === 'gpt-5' || model.startsWith('gpt-5-')) return 'gpt-5';
  if (model.startsWith('claude-3-5-sonnet')) return 'claude-3-5-sonnet';
  if (model.startsWith('gemini-2.5-pro')) return 'gemini-2.5-pro';
  if (model.startsWith('gemini-2.5-flash')) return 'gemini-2.5-flash';
  if (model.startsWith('gemini-3.1-pro') || model === 'gemini-3-pro' || model.startsWith('gemini-3-pro')) return 'gemini-3-pro';
  if (model.startsWith('gemini-3-flash')) return 'gemini-3-flash';
  if (model.startsWith('eleven_turbo') || model.startsWith('eleven_flash')) return 'elevenlabs-fast';
  if (model.startsWith('eleven_multilingual') || model.startsWith('eleven_v3') || model.startsWith('eleven-v3')) return 'elevenlabs-multilingual';

  return model;
};

const estimateTokenTextCost = (provider: string, model: string, inputTokens: number, outputTokens: number): UsageCostEstimate => {
  if (inputTokens <= 0 && outputTokens <= 0) {
    return unpriced();
  }

  const normalizedModel = normalizeModelAlias(model, 'text');
  const promptIsLarge = inputTokens > 200_000;

  if (provider === 'openai') {
    const price = (() => {
      if (normalizedModel === 'gpt-4o-mini') return { input: 0.15, output: 0.6 };
      if (normalizedModel === 'gpt-4o') return { input: 2.5, output: 10 };
      if (normalizedModel === 'gpt-5.4-mini') return { input: 0.75, output: 4.5 };
      if (normalizedModel === 'gpt-5.4') return { input: 2.5, output: 15 };
      if (normalizedModel === 'gpt-5') return { input: 1.25, output: 10 };
      return null;
    })();

    if (price) {
      return cost((inputTokens / ONE_MILLION) * price.input + (outputTokens / ONE_MILLION) * price.output, 'exact');
    }
  }

  if (provider === 'anthropic' && normalizedModel === 'claude-3-5-sonnet') {
    return cost((inputTokens / ONE_MILLION) * 3 + (outputTokens / ONE_MILLION) * 15, 'exact');
  }

  if (provider === 'gemini') {
    const price = (() => {
      if (normalizedModel === 'gemini-2.5-flash') return { input: 0.3, output: 2.5 };
      if (normalizedModel === 'gemini-2.5-pro') {
        return promptIsLarge ? { input: 2.5, output: 15 } : { input: 1.25, output: 10 };
      }
      if (normalizedModel === 'gemini-3-pro') return { input: 0.25, output: 1.5 };
      if (normalizedModel === 'gemini-3-flash') return { input: 0.5, output: 3 };
      return null;
    })();

    if (price) {
      return cost((inputTokens / ONE_MILLION) * price.input + (outputTokens / ONE_MILLION) * price.output, 'exact');
    }
  }

  return unpriced();
};

const normalizeOpenAiImageSize = (value: unknown) => {
  const normalized = String(value || '').trim();
  if (normalized === '1792x1024') return '1536x1024';
  if (normalized === '1024x1792') return '1024x1536';
  return normalized;
};

const estimateOpenAiImageCost = (model: string, requestCount: number, metadata?: Record<string, unknown>): UsageCostEstimate => {
  const normalizedModel = normalizeModelAlias(model, 'image');
  const size = normalizeOpenAiImageSize(metadata?.size);

  const prices = (() => {
    if (normalizedModel === 'gpt-image-1') {
      return {
        '1024x1024': { low: 0.011, medium: 0.042, high: 0.167 },
        '1024x1536': { low: 0.016, medium: 0.063, high: 0.25 },
        '1536x1024': { low: 0.016, medium: 0.063, high: 0.25 }
      } as const;
    }
    if (normalizedModel === 'gpt-image-1-mini') {
      return {
        '1024x1024': { low: 0.005, medium: 0.011, high: 0.036 },
        '1024x1536': { low: 0.006, medium: 0.015, high: 0.052 },
        '1536x1024': { low: 0.006, medium: 0.015, high: 0.052 }
      } as const;
    }
    return null;
  })();

  if (!prices) return unpriced();
  const sizeKey = (size === '1024x1024' || size === '1024x1536' || size === '1536x1024') ? size : '1024x1024';
  const selected = prices[sizeKey];
  return costRange(selected.low * requestCount, selected.high * requestCount);
};

const normalizeGeminiResolution = (metadata?: Record<string, unknown>) => {
  const resolution = toLower(String(metadata?.resolution || ''));
  if (resolution === '2k' || resolution === '4k' || resolution === '1k') return resolution;
  return '1k';
};

const estimateGeminiImageCost = (model: string, requestCount: number, metadata?: Record<string, unknown>): UsageCostEstimate => {
  const normalizedModel = normalizeModelAlias(model, 'image');
  const resolution = normalizeGeminiResolution(metadata);

  if (normalizedModel === 'gemini-2.5-flash-image') {
    if (resolution !== '1k') {
      return unpriced();
    }
    return cost(0.039 * requestCount, 'estimate');
  }

  if (normalizedModel === 'gemini-3-pro-image-preview') {
    if (resolution === '4k') {
      return cost(0.24 * requestCount, 'estimate');
    }
    return cost(0.134 * requestCount, 'estimate');
  }

  return unpriced();
};

const estimateTextToSpeechCost = (provider: string, model: string, requestCount: number, metadata?: Record<string, unknown>): UsageCostEstimate => {
  const normalizedModel = normalizeModelAlias(model, 'audio');
  const textLength = toNumber(metadata?.textLength, 0);
  if (textLength <= 0) {
    return unpriced();
  }

  if (provider === 'openai') {
    const estimatedInputTokens = textLength / CHARS_PER_TOKEN_ESTIMATE;
    if (normalizedModel === 'tts-1') {
      return cost((estimatedInputTokens / ONE_MILLION) * 15 * requestCount, 'estimate');
    }
    if (normalizedModel === 'tts-1-hd') {
      return cost((estimatedInputTokens / ONE_MILLION) * 30 * requestCount, 'estimate');
    }
    return unpriced();
  }

  if (provider === 'elevenlabs') {
    const thousands = textLength / ONE_THOUSAND;
    if (normalizedModel === 'elevenlabs-fast') {
      return costRange(thousands * 0.06 * requestCount, thousands * 0.15 * requestCount);
    }
    if (normalizedModel === 'elevenlabs-multilingual') {
      return costRange(thousands * 0.12 * requestCount, thousands * 0.3 * requestCount);
    }
  }

  return unpriced();
};

export const estimateUsageCost = (input: UsagePricingInput): UsageCostEstimate => {
  const { provider, model } = normalizeProviderModel(input.provider, input.model);
  const metadata = asRecord(input.metadata);
  const normalizedCapability = toLower(input.capability);

  if (normalizedCapability === 'text') {
    const fromTokens = estimateTokenTextCost(provider, model, input.inputTokens, input.outputTokens);
    if (fromTokens.method !== 'unpriced') {
      return fromTokens;
    }
  }

  if (normalizedCapability === 'image') {
    if (provider === 'openai') {
      return estimateOpenAiImageCost(model, input.requestCount, metadata);
    }
    if (provider === 'gemini') {
      return estimateGeminiImageCost(model, input.requestCount, metadata);
    }
  }

  if (normalizedCapability === 'audio') {
    return estimateTextToSpeechCost(provider, model, input.requestCount, metadata);
  }

  return unpriced();
};
