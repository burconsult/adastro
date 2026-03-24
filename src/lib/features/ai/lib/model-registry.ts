export const AI_MODEL_REGISTRY = {
  gateway: {
    text: {
      models: ['openai/gpt-4o-mini', 'openai/gpt-4o', 'anthropic/claude-3-5-sonnet-latest']
    },
    image: {
      models: ['openai/gpt-image-1'],
      sizes: ['1024x1024', '1792x1024', '1024x1792']
    }
  },
  openai: {
    text: {
      models: ['gpt-4o-mini', 'gpt-4o', 'gpt-5']
    },
    image: {
      models: ['gpt-image-1', 'gpt-image-1-mini'],
      sizes: ['1024x1024', '1792x1024', '1024x1792'],
      qualities: ['high', 'medium', 'low'],
      outputFormats: ['png', 'jpeg', 'webp'],
      backgrounds: ['transparent', 'opaque', 'auto']
    },
    audio: {
      models: ['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd'],
      voices: ['alloy']
    }
  },
  gemini: {
    text: {
      models: ['gemini-2.5-flash', 'gemini-3-pro']
    },
    image: {
      models: ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'],
      aspectRatios: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
      resolutions: ['1K', '2K', '4K']
    }
  },
  anthropic: {
    text: {
      models: ['claude-3-5-sonnet-20240620']
    }
  },
  elevenlabs: {
    audio: {
      models: ['eleven_turbo_v2', 'eleven_multilingual_v2'],
      voices: [
        {
          id: 'EXAVITQu4vr4xnSDxMaL',
          name: 'Default ElevenLabs Voice'
        }
      ]
    }
  }
} as const;
