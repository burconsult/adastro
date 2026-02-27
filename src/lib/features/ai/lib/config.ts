import type { AiProviderKey } from './types.js';

export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';
export const DEFAULT_GEMINI_IMAGE_SIZE = '1K';
export const DEFAULT_ANTHROPIC_MODEL = 'claude-3-5-sonnet-20240620';
export const DEFAULT_OPENAI_IMAGE_MODEL = 'gpt-image-1';
export const DEFAULT_OPENAI_AUDIO_MODEL = 'gpt-4o-mini-tts';
export const DEFAULT_ELEVENLABS_MODEL = 'eleven_turbo_v2';
export const DEFAULT_ELEVENLABS_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';

export function getDefaultProvider(): AiProviderKey {
  return 'openai';
}

export function getDefaultImageProvider(): 'openai' | 'gemini' {
  return 'openai';
}

export function getDefaultAudioProvider(): 'openai' | 'elevenlabs' {
  return 'openai';
}

export function getApiTimeoutMs(): number {
  return 45_000;
}
