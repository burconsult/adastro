export type AiCapability = 'text' | 'image' | 'audio' | 'video';
export type AiProviderId = 'gateway' | 'openai' | 'gemini' | 'anthropic' | 'elevenlabs';
export type AiImageResolution = '1K' | '2K' | '4K';
export type AiModelSource = 'registry' | 'remote';
export type AiProviderExecutionMode = 'gateway' | 'direct';

export interface AiProviderCapabilitySupport {
  supported: boolean;
  implemented: boolean;
  supportsModelDiscovery?: boolean;
  supportsVoiceDiscovery?: boolean;
}

export interface AiProviderDescriptor {
  id: AiProviderId;
  label: string;
  envKey: string;
  docsUrl: string;
  pricingUrl?: string;
  executionMode: AiProviderExecutionMode;
  capabilities: Record<AiCapability, AiProviderCapabilitySupport>;
}

export interface AiModelDescriptor {
  id: string;
  name: string;
  provider: AiProviderId;
  capabilities: AiCapability[];
  source: AiModelSource;
  updatedAt?: string;
  description?: string;
  raw?: unknown;
}

export interface AiVoiceDescriptor {
  id: string;
  name: string;
  provider: AiProviderId;
  source: AiModelSource;
  updatedAt?: string;
  raw?: unknown;
}

export interface GenerateTextOptions {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  provider?: AiProviderId;
  responseFormat?: 'text' | 'json_object';
  metadata?: Record<string, unknown>;
}

export interface GenerateTextResponse {
  text: string;
  provider: AiProviderId;
  model: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  raw?: unknown;
}

export type GenerateContentOptions = GenerateTextOptions;
export type GenerateContentResponse = GenerateTextResponse;

export interface GenerateImageOptions {
  prompt: string;
  model?: string;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  resolution?: AiImageResolution;
  aspectRatio?: '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
  provider?: AiProviderId;
}

export interface GenerateImageResponse {
  data: Uint8Array;
  mimeType: string;
  provider: AiProviderId;
  model: string;
}

export interface GenerateAudioOptions {
  text: string;
  voice?: string;
  model?: string;
  speed?: number;
  provider?: AiProviderId;
}

export interface GenerateAudioResponse {
  data: Uint8Array;
  mimeType: string;
  provider: AiProviderId;
  model: string;
  voice?: string;
}

export interface AiTextProvider {
  generateText(options: GenerateTextOptions): Promise<GenerateTextResponse>;
}

export interface AiImageProvider {
  generateImage(options: GenerateImageOptions): Promise<GenerateImageResponse>;
}

export interface AiAudioProvider {
  generateAudio(options: GenerateAudioOptions): Promise<GenerateAudioResponse>;
}

export interface AiCapabilityExecutor {
  text?: AiTextProvider;
  image?: AiImageProvider;
  audio?: AiAudioProvider;
}

export type AiProvider = AiTextProvider;
export type AiProviderKey = AiProviderId;
export type AiImageProviderKey = AiProviderId;
export type AiAudioProviderKey = AiProviderId;
