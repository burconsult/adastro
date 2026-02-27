export const AI_MODEL_REGISTRY = {
  openai: {
    text: {
      models: ['gpt-4o-mini', 'gpt-4o', 'gpt-5']
    },
    image: {
      models: ['gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'],
      sizes: ['1024x1024', '1792x1024', '1024x1792'],
      qualities: ['high', 'medium', 'low'],
      outputFormats: ['png', 'jpeg', 'webp'],
      backgrounds: ['transparent', 'opaque', 'auto']
    },
    audio: {
      models: ['gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15', 'tts-1', 'tts-1-hd']
    }
  },
  gemini: {
    text: {
      models: ['gemini-3-pro', 'gemini-2.5-flash']
    },
    image: {
      models: ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image'],
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
      models: ['eleven_turbo_v2']
    }
  }
} as const;
