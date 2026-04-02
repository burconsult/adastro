import OpenAI from 'openai';
import { getEnv } from '../../../../env.js';
import {
  DEFAULT_IMAGE_MODELS,
  DEFAULT_TEXT_MODELS,
  getApiTimeoutMs,
  getGatewayBaseUrl
} from '../config.js';
import type {
  AiImageProvider,
  AiProviderId,
  AiTextProvider,
  GenerateImageOptions,
  GenerateImageResponse,
  GenerateTextOptions,
  GenerateTextResponse
} from '../types.js';

const providerKey: AiProviderId = 'gateway';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = getEnv('AI_GATEWAY_API_KEY');
  if (!apiKey) {
    throw new Error('Vercel AI Gateway is not configured. Set AI_GATEWAY_API_KEY.');
  }

  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL: getGatewayBaseUrl(),
      timeout: getApiTimeoutMs(),
      dangerouslyAllowBrowser: false
    });
  }

  return client;
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
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
      || message.includes('unsupported')
      || message.includes('permission')
    )
  );
};

const inferGatewayFallbackTextModels = (model: string): string[] => {
  const candidates = [
    model,
    DEFAULT_TEXT_MODELS.gateway,
    'openai/gpt-4o',
    'anthropic/claude-3-5-sonnet-latest'
  ];
  return candidates.filter((candidate, index, arr) => Boolean(candidate) && arr.indexOf(candidate) === index) as string[];
};

const inferGatewayFallbackImageModels = (model: string): string[] => {
  const candidates = [model, DEFAULT_IMAGE_MODELS.gateway];
  return candidates.filter((candidate, index, arr) => Boolean(candidate) && arr.indexOf(candidate) === index) as string[];
};

export class GatewayTextProvider implements AiTextProvider {
  async generateText(options: GenerateTextOptions): Promise<GenerateTextResponse> {
    const {
      prompt,
      system,
      model = DEFAULT_TEXT_MODELS.gateway,
      temperature = 0.7,
      maxOutputTokens = 800,
      responseFormat,
      images = []
    } = options;

    if (!model) {
      throw new Error('Gateway text generation model is not configured.');
    }

    const input = [] as OpenAI.Input[];
    if (system) {
      input.push({ role: 'system', content: system });
    }
    if (images.length > 0) {
      input.push({
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          ...images.map((image) => ({
            type: 'input_image',
            image_url: image.url
          }))
        ] as any
      });
    } else {
      input.push({ role: 'user', content: prompt });
    }

    let response: OpenAI.Responses.Response | null = null;
    let lastError: unknown = null;
    const candidateModels = inferGatewayFallbackTextModels(model);

    for (const candidateModel of candidateModels) {
      const paramAttempts = [
        { includeTemperature: true, includeResponseFormat: Boolean(responseFormat) },
        { includeTemperature: false, includeResponseFormat: Boolean(responseFormat) },
        { includeTemperature: true, includeResponseFormat: false },
        { includeTemperature: false, includeResponseFormat: false }
      ];

      for (const attempt of paramAttempts) {
        if (!responseFormat && attempt.includeResponseFormat) continue;
        try {
          response = await getClient().responses.create({
            model: candidateModel,
            input,
            max_output_tokens: maxOutputTokens,
            ...(attempt.includeTemperature ? { temperature } : {}),
            ...(attempt.includeResponseFormat && responseFormat ? { response_format: { type: responseFormat } } : {})
          });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (shouldRetryWithoutResponseFormat(error) || shouldRetryWithoutTemperature(error)) {
            continue;
          }
          if (shouldRetryWithFallbackModel(error)) {
            break;
          }
          throw error;
        }
      }

      if (response) break;
    }

    if (!response) {
      throw (lastError instanceof Error ? lastError : new Error('Gateway text generation failed.'));
    }

    return {
      text: response.output_text ?? '',
      provider: providerKey,
      usage: response.usage
        ? {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            totalTokens: response.usage.total_tokens
          }
        : undefined,
      model: typeof response.model === 'string' && response.model ? response.model : model,
      raw: response
    };
  }
}

export class GatewayImageProvider implements AiImageProvider {
  async generateImage(options: GenerateImageOptions): Promise<GenerateImageResponse> {
    const { prompt, model = DEFAULT_IMAGE_MODELS.gateway, size = '1024x1024' } = options;

    if (!model) {
      throw new Error('Gateway image generation model is not configured.');
    }

    let response: Awaited<ReturnType<OpenAI['images']['generate']>> | null = null;
    let lastError: unknown = null;
    const candidateModels = inferGatewayFallbackImageModels(model);

    for (const candidateModel of candidateModels) {
      try {
        response = await getClient().images.generate({
          model: candidateModel,
          prompt,
          size,
          response_format: 'b64_json'
        });
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (shouldRetryWithoutResponseFormat(error)) {
          try {
            response = await getClient().images.generate({
              model: candidateModel,
              prompt,
              size
            });
            lastError = null;
            break;
          } catch (fallbackError) {
            lastError = fallbackError;
          }
        }

        if (shouldRetryWithFallbackModel(lastError)) {
          continue;
        }

        throw lastError;
      }
    }

    if (!response) {
      throw (lastError instanceof Error ? lastError : new Error('Gateway image generation failed.'));
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
        throw new Error(`Gateway image URL fetch failed (${fetched.status})`);
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

    throw new Error('Gateway image generation did not return image data.');
  }
}
