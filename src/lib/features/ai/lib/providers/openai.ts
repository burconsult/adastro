import OpenAI from 'openai';
import {
  DEFAULT_OPENAI_AUDIO_MODEL,
  DEFAULT_OPENAI_IMAGE_MODEL,
  DEFAULT_OPENAI_MODEL,
  getApiTimeoutMs
} from '../config.js';
import { getEnv } from '../../../../env.js';
import type {
  AiProvider,
  AiAudioProvider,
  AiImageProvider,
  AiProviderKey,
  GenerateAudioOptions,
  GenerateAudioResponse,
  GenerateContentOptions,
  GenerateContentResponse,
  GenerateImageOptions,
  GenerateImageResponse
} from '../types.js';

const providerKey: AiProviderKey = 'openai';

if (!getEnv('OPENAI_API_KEY')) {
  console.warn('⚠️  OPENAI_API_KEY is not set. OpenAI provider is disabled.');
}

let client: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = getEnv('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OpenAI provider is not configured. Set OPENAI_API_KEY.');
  }

  if (!client) {
    client = new OpenAI({
      apiKey,
      timeout: getApiTimeoutMs(),
      dangerouslyAllowBrowser: false
    });
  }
  return client;
}

const isObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (isObject(error) && typeof error.message === 'string') return error.message;
  return String(error);
};

const shouldRetryWithoutResponseFormat = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('response_format') || message.includes('json_object');
};

const shouldRetryWithoutTemperature = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('temperature') || message.includes('unsupported parameter');
};

const shouldRetryWithFallbackModel = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('model') && (
      message.includes('not found')
      || message.includes('does not exist')
      || message.includes('do not have access')
      || message.includes('insufficient')
      || message.includes('permission')
    )
  );
};

const shouldRetryWithLegacyImageSize = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('invalid value') && message.includes('supported values') && message.includes('1024x1536');
};

const toLegacyOpenAiImageSize = (size: string): string => {
  if (size === '1792x1024') return '1536x1024';
  if (size === '1024x1792') return '1024x1536';
  return size;
};

export class OpenAiProvider implements AiProvider {
  async generate(options: GenerateContentOptions): Promise<GenerateContentResponse> {
    const {
      prompt,
      system,
      model = DEFAULT_OPENAI_MODEL,
      temperature = 0.7,
      maxOutputTokens = 800,
      responseFormat
    } = options;

    const input = [] as OpenAI.Input[];
    if (system) {
      input.push({ role: 'system', content: system });
    }
    input.push({ role: 'user', content: prompt });

    const requestBase = {
      model,
      input,
      max_output_tokens: maxOutputTokens
    } as const;

    const candidateModels = [model, 'gpt-4o-mini', 'gpt-4o'].filter((candidate, index, arr) => (
      typeof candidate === 'string' && candidate.trim().length > 0 && arr.indexOf(candidate) === index
    ));

    let response: OpenAI.Responses.Response | null = null;
    let lastError: unknown = null;

    for (const candidateModel of candidateModels) {
      const paramAttempts: Array<{ includeTemperature: boolean; includeResponseFormat: boolean }> = [
        { includeTemperature: true, includeResponseFormat: Boolean(responseFormat) },
        { includeTemperature: false, includeResponseFormat: Boolean(responseFormat) },
        { includeTemperature: true, includeResponseFormat: false },
        { includeTemperature: false, includeResponseFormat: false }
      ];

      for (const attempt of paramAttempts) {
        if (!responseFormat && attempt.includeResponseFormat) continue;
        try {
          response = await getClient().responses.create({
            ...requestBase,
            model: candidateModel,
            ...(attempt.includeTemperature ? { temperature } : {}),
            ...(attempt.includeResponseFormat && responseFormat ? { response_format: { type: responseFormat } } : {})
          });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          const retryableParamError = shouldRetryWithoutResponseFormat(error) || shouldRetryWithoutTemperature(error);
          if (retryableParamError) {
            continue;
          }
          if (candidateModel !== model && shouldRetryWithFallbackModel(error)) {
            continue;
          }
          if (candidateModel === model && shouldRetryWithFallbackModel(error)) {
            break;
          }
          throw error;
        }
      }

      if (response) break;
    }

    if (!response) {
      throw (lastError instanceof Error ? lastError : new Error('OpenAI text generation failed.'));
    }

    const text = response.output_text ?? '';
    const usage = response.usage
      ? {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalTokens: response.usage.total_tokens
        }
      : undefined;

    return {
      text,
      provider: providerKey,
      usage,
      model: typeof response.model === 'string' && response.model ? response.model : model,
      raw: response
    };
  }
}

export class OpenAiImageProvider implements AiImageProvider {
  async generateImage(options: GenerateImageOptions): Promise<GenerateImageResponse> {
    const { prompt, model = DEFAULT_OPENAI_IMAGE_MODEL, size = '1024x1024' } = options;
    const candidateModels = [model, 'gpt-image-1', 'gpt-image-1-mini']
      .filter((candidate, index, arr) => arr.indexOf(candidate) === index);

    let response: Awaited<ReturnType<OpenAI['images']['generate']>> | null = null;
    let lastError: unknown = null;

    for (const candidateModel of candidateModels) {
      const requestBase = { model: candidateModel, prompt, size } as const;
      try {
        response = await getClient().images.generate({
          ...requestBase,
          response_format: 'b64_json'
        });
        lastError = null;
        break;
      } catch (firstError) {
        lastError = firstError;
        if (shouldRetryWithoutResponseFormat(firstError)) {
          try {
            response = await getClient().images.generate(requestBase);
            lastError = null;
            break;
          } catch (secondError) {
            lastError = secondError;
          }
        }

        if (shouldRetryWithLegacyImageSize(lastError)) {
          const legacyRequestBase = {
            ...requestBase,
            size: toLegacyOpenAiImageSize(requestBase.size)
          } as const;
          try {
            response = await getClient().images.generate({
              ...legacyRequestBase,
              response_format: 'b64_json'
            });
            lastError = null;
            break;
          } catch (legacyFirstError) {
            lastError = legacyFirstError;
            if (shouldRetryWithoutResponseFormat(legacyFirstError)) {
              try {
                response = await getClient().images.generate(legacyRequestBase);
                lastError = null;
                break;
              } catch (legacySecondError) {
                lastError = legacySecondError;
              }
            }
          }
        }

        if (shouldRetryWithFallbackModel(lastError)) {
          continue;
        }

        throw lastError;
      }
    }

    if (!response) {
      throw (lastError instanceof Error ? lastError : new Error('OpenAI image generation failed.'));
    }

    const image = response.data?.[0];

    const base64Payload = image && (
      (typeof (image as any).b64_json === 'string' && (image as any).b64_json)
      || (typeof (image as any).base64 === 'string' && (image as any).base64)
    );
    if (base64Payload) {
      return {
        data: Buffer.from(base64Payload, 'base64'),
        mimeType: 'image/png',
        provider: providerKey,
        model: typeof (image as any)?.model === 'string' ? (image as any).model : model
      };
    }

    const imageUrl = image && typeof (image as any).url === 'string' ? (image as any).url : null;
    if (imageUrl) {
      const fetched = await fetch(imageUrl);
      if (!fetched.ok) {
        throw new Error(`OpenAI image URL fetch failed (${fetched.status})`);
      }
      const arrayBuffer = await fetched.arrayBuffer();
      const mimeType = fetched.headers.get('content-type') || 'image/png';
      return {
        data: Buffer.from(arrayBuffer),
        mimeType,
        provider: providerKey,
        model: typeof (image as any)?.model === 'string' ? (image as any).model : model
      };
    }

    throw new Error('OpenAI image generation did not return image data.');
  }
}

export class OpenAiAudioProvider implements AiAudioProvider {
  async generateAudio(options: GenerateAudioOptions): Promise<GenerateAudioResponse> {
    const {
      text,
      voice = 'alloy',
      model = DEFAULT_OPENAI_AUDIO_MODEL,
      speed
    } = options;

    const response = await getClient().audio.speech.create({
      model,
      voice,
      input: text,
      format: 'mp3',
      speed
    });

    const arrayBuffer = await response.arrayBuffer();
    return {
      data: Buffer.from(arrayBuffer),
      mimeType: 'audio/mpeg',
      provider: providerKey,
      model,
      voice
    };
  }
}

export function isOpenAiConfigured(): boolean {
  return Boolean(getEnv('OPENAI_API_KEY'));
}
