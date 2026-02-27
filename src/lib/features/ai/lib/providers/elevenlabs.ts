import { getEnv } from '../../../../env.js';
import { DEFAULT_ELEVENLABS_MODEL, DEFAULT_ELEVENLABS_VOICE_ID, getApiTimeoutMs } from '../config.js';
import type { AiAudioProvider, AiAudioProviderKey, GenerateAudioOptions, GenerateAudioResponse } from '../types.js';

const providerKey: AiAudioProviderKey = 'elevenlabs';
const apiKey = getEnv('ELEVENLABS_API_KEY');

if (!apiKey) {
  console.warn('⚠️  ELEVENLABS_API_KEY is not set. ElevenLabs provider is disabled.');
}

export class ElevenLabsProvider implements AiAudioProvider {
  async generateAudio(options: GenerateAudioOptions): Promise<GenerateAudioResponse> {
    if (!apiKey) {
      throw new Error('ElevenLabs provider is not configured. Set ELEVENLABS_API_KEY.');
    }

    const {
      text,
      voice = DEFAULT_ELEVENLABS_VOICE_ID,
      model = DEFAULT_ELEVENLABS_MODEL
    } = options;

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.8
        }
      }),
      signal: AbortSignal.timeout(getApiTimeoutMs())
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`ElevenLabs request failed: ${response.status} ${response.statusText} ${errorText}`.trim());
    }

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

export function isElevenLabsConfigured(): boolean {
  return Boolean(apiKey);
}
