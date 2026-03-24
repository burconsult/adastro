import { getEnv } from '../../../../env.js';
import { DEFAULT_AUDIO_MODELS, DEFAULT_AUDIO_VOICES, getApiTimeoutMs } from '../config.js';
import type { AiAudioProvider, AiProviderId, GenerateAudioOptions, GenerateAudioResponse } from '../types.js';

const providerKey: AiProviderId = 'elevenlabs';

export class ElevenLabsAudioProvider implements AiAudioProvider {
  async generateAudio(options: GenerateAudioOptions): Promise<GenerateAudioResponse> {
    const apiKey = getEnv('ELEVENLABS_API_KEY');
    if (!apiKey) {
      throw new Error('ElevenLabs provider is not configured. Set ELEVENLABS_API_KEY.');
    }

    const {
      text,
      voice = DEFAULT_AUDIO_VOICES.elevenlabs,
      model = DEFAULT_AUDIO_MODELS.elevenlabs
    } = options;

    if (!voice) {
      throw new Error('ElevenLabs voice is not configured.');
    }
    if (!model) {
      throw new Error('ElevenLabs audio generation model is not configured.');
    }

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
