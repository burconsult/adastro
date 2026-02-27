import { GoogleGenerativeAI } from '@google/generative-ai';
import { getEnv } from '../../../../env.js';
import { DEFAULT_GEMINI_IMAGE_MODEL, DEFAULT_GEMINI_IMAGE_SIZE, DEFAULT_GEMINI_MODEL, getApiTimeoutMs } from '../config.js';
import type {
  AiProvider,
  AiImageProvider,
  AiImageProviderKey,
  AiProviderKey,
  GenerateContentOptions,
  GenerateContentResponse,
  GenerateImageOptions,
  GenerateImageResponse
} from '../types.js';

const providerKey: AiProviderKey = 'gemini';

let client: GoogleGenerativeAI | null = null;
const apiKey = getEnv('GOOGLE_GENAI_API_KEY');

if (apiKey) {
  client = new GoogleGenerativeAI(apiKey, {
    apiVersion: 'v1beta',
    timeout: getApiTimeoutMs()
  });
} else {
  console.warn('⚠️  GOOGLE_GENAI_API_KEY is not set. Gemini provider is disabled.');
}

const DEFAULT_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUAL_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' }
] as const;

export class GeminiProvider implements AiProvider {
  async generate(options: GenerateContentOptions): Promise<GenerateContentResponse> {
    if (!client) {
      throw new Error('Gemini provider is not configured. Set GOOGLE_GENAI_API_KEY.');
    }

    const {
      prompt,
      system,
      model = DEFAULT_GEMINI_MODEL,
      temperature = 0.7,
      maxOutputTokens = 800
    } = options;

    const generativeModel = client.getGenerativeModel({ model });

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
    const text = response?.text() ?? '';
    const usageMetadata = response?.usageMetadata;

    return {
      text,
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

export function isGeminiConfigured(): boolean {
  return Boolean(apiKey);
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

export class GeminiImageProvider implements AiImageProvider {
  async generateImage(options: GenerateImageOptions): Promise<GenerateImageResponse> {
    if (!apiKey) {
      throw new Error('Gemini provider is not configured. Set GOOGLE_GENAI_API_KEY.');
    }

    const { prompt, model = DEFAULT_GEMINI_IMAGE_MODEL, size, resolution, aspectRatio: ratioOverride } = options;
    const aspectRatio = ratioOverride || sizeToAspectRatio(size);
    const imageSize = shouldIncludeImageSize(model)
      ? (resolution || DEFAULT_GEMINI_IMAGE_SIZE)
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
      provider: 'gemini' as AiImageProviderKey,
      model
    };
  }
}
