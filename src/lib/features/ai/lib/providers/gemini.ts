import { GoogleGenerativeAI } from '@google/generative-ai';
import { getEnv } from '../../../../env.js';
import { DEFAULT_IMAGE_MODELS, DEFAULT_TEXT_MODELS, getApiTimeoutMs } from '../config.js';
import type {
  AiImageProvider,
  AiProviderId,
  AiTextProvider,
  GenerateImageOptions,
  GenerateImageResponse,
  GenerateTextOptions,
  GenerateTextResponse
} from '../types.js';

const providerKey: AiProviderId = 'gemini';

const DEFAULT_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUAL_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' }
] as const;

let client: GoogleGenerativeAI | null = null;
let clientApiKey: string | null = null;

function getClient(): GoogleGenerativeAI {
  const apiKey = getEnv('GOOGLE_GENAI_API_KEY');
  if (!apiKey) {
    throw new Error('Gemini provider is not configured. Set GOOGLE_GENAI_API_KEY.');
  }

  if (!client || clientApiKey !== apiKey) {
    client = new GoogleGenerativeAI(apiKey, {
      apiVersion: 'v1beta',
      timeout: getApiTimeoutMs()
    });
    clientApiKey = apiKey;
  }

  return client;
}

const sizeToAspectRatio = (size?: GenerateImageOptions['size']): string => {
  switch (size) {
    case '1792x1024':
      return '16:9';
    case '1024x1792':
      return '9:16';
    case '1024x1024':
    default:
      return '1:1';
  }
};

const shouldIncludeImageSize = (model: string): boolean =>
  model.includes('image-preview') || model.includes('pro-image');

export class GeminiTextProvider implements AiTextProvider {
  async generateText(options: GenerateTextOptions): Promise<GenerateTextResponse> {
    const {
      prompt,
      system,
      model = DEFAULT_TEXT_MODELS.gemini,
      temperature = 0.7,
      maxOutputTokens = 800
    } = options;

    if (!model) {
      throw new Error('Gemini text generation model is not configured.');
    }

    const generativeModel = getClient().getGenerativeModel({ model });
    const result = await generativeModel.generateContent({
      contents: [
        ...(system ? [{ role: 'user', parts: [{ text: system }] }] : []),
        { role: 'user', parts: [{ text: prompt }] }
      ],
      generationConfig: {
        temperature,
        maxOutputTokens,
        topP: 0.95
      },
      safetySettings: DEFAULT_SAFETY_SETTINGS as unknown as any
    });

    const response = result.response;
    const usageMetadata = response?.usageMetadata;

    return {
      text: response?.text() ?? '',
      provider: providerKey,
      model,
      usage: usageMetadata
        ? {
            inputTokens: usageMetadata.promptTokenCount,
            outputTokens: usageMetadata.candidatesTokenCount,
            totalTokens: usageMetadata.totalTokenCount
          }
        : undefined,
      raw: response
    };
  }
}

export class GeminiImageProvider implements AiImageProvider {
  async generateImage(options: GenerateImageOptions): Promise<GenerateImageResponse> {
    const apiKey = getEnv('GOOGLE_GENAI_API_KEY');
    if (!apiKey) {
      throw new Error('Gemini provider is not configured. Set GOOGLE_GENAI_API_KEY.');
    }

    const { prompt, model = DEFAULT_IMAGE_MODELS.gemini, size, resolution, aspectRatio: ratioOverride } = options;
    if (!model) {
      throw new Error('Gemini image generation model is not configured.');
    }

    const aspectRatio = ratioOverride || sizeToAspectRatio(size);
    const imageSize = shouldIncludeImageSize(model)
      ? (resolution || '1K')
      : undefined;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          imageConfig: {
            aspectRatio,
            ...(imageSize ? { imageSize } : {})
          }
        }
      }),
      signal: AbortSignal.timeout(getApiTimeoutMs())
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Gemini image request failed: ${response.status} ${response.statusText} ${errorText}`.trim());
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((part: any) => part?.inlineData?.data || part?.inline_data?.data);
    const inlineData = imagePart?.inlineData ?? imagePart?.inline_data;

    if (!inlineData?.data) {
      throw new Error('Gemini image generation did not return image data.');
    }

    return {
      data: Buffer.from(inlineData.data, 'base64'),
      mimeType: inlineData.mimeType || 'image/png',
      provider: providerKey,
      model
    };
  }
}
