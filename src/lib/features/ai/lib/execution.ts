import { getAudioProvider, getImageProvider, getTextProvider } from './provider-registry.js';
import {
  DEFAULT_AUDIO_PROVIDER,
  DEFAULT_IMAGE_PROVIDER,
  DEFAULT_TEXT_PROVIDER
} from './config.js';
import type {
  GenerateAudioOptions,
  GenerateAudioResponse,
  GenerateImageOptions,
  GenerateImageResponse,
  GenerateTextOptions,
  GenerateTextResponse
} from './types.js';

export async function generateText(options: GenerateTextOptions): Promise<GenerateTextResponse> {
  const providerKey = options.provider ?? DEFAULT_TEXT_PROVIDER;
  return getTextProvider(providerKey).generateText({ ...options, provider: providerKey });
}

export async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  const providerKey = options.provider ?? DEFAULT_IMAGE_PROVIDER;
  return getImageProvider(providerKey).generateImage({ ...options, provider: providerKey });
}

export async function generateAudio(options: GenerateAudioOptions): Promise<GenerateAudioResponse> {
  const providerKey = options.provider ?? DEFAULT_AUDIO_PROVIDER;
  return getAudioProvider(providerKey).generateAudio({ ...options, provider: providerKey });
}
