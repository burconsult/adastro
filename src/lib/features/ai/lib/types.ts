export type AiCapability = 'text' | 'image' | 'audio' | 'video';
export type AiProviderId = 'openai' | 'gemini' | 'anthropic' | 'elevenlabs';
export type AiProviderKey = Extract<AiProviderId, 'openai' | 'gemini' | 'anthropic'>;
export type AiImageProviderKey = 'openai' | 'gemini';
export type AiAudioProviderKey = 'openai' | 'elevenlabs';
export type AiImageResolution = '1K' | '2K' | '4K';

export interface AiProviderCapabilitySupport {
  supported: boolean;
  implemented: boolean;
  supportsModelDiscovery?: boolean;
}

export interface AiProviderCatalogEntry {
  id: AiProviderId;
  label: string;
  envKey: string;
  docsUrl: string;
  pricingUrl?: string;
  capabilities: Record<AiCapability, AiProviderCapabilitySupport>;
}

export interface GenerateContentOptions {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  provider?: AiProviderKey;
  responseFormat?: 'text' | 'json_object';
  metadata?: Record<string, unknown>;
}

export interface GenerateContentResponse {
  text: string;
  provider: AiProviderKey;
  model: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  raw?: unknown;
}

export interface AiProvider {
  generate(options: GenerateContentOptions): Promise<GenerateContentResponse>;
}

export interface GenerateImageOptions {
  prompt: string;
  model?: string;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  resolution?: AiImageResolution;
  aspectRatio?: '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
  provider?: AiImageProviderKey;
}

export interface GenerateImageResponse {
  data: Uint8Array;
  mimeType: string;
  provider: AiImageProviderKey;
  model: string;
}

export interface GenerateAudioOptions {
  text: string;
  voice?: string;
  model?: string;
  speed?: number;
  provider?: AiAudioProviderKey;
}

export interface GenerateAudioResponse {
  data: Uint8Array;
  mimeType: string;
  provider: AiAudioProviderKey;
  model: string;
  voice?: string;
}

export interface AiImageProvider {
  generateImage(options: GenerateImageOptions): Promise<GenerateImageResponse>;
}

export interface AiAudioProvider {
  generateAudio(options: GenerateAudioOptions): Promise<GenerateAudioResponse>;
}
