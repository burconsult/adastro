import type { SettingDefinition } from '../../settings/types.js';

export const AI_SETTINGS: SettingDefinition[] = [
  {
    key: 'features.ai.enabled',
    displayName: 'Enable AI Suite',
    description: 'Master switch for all AI tools across the admin and public surfaces.',
    type: 'boolean',
    category: 'extras',
    defaultValue: false
  },
  {
    key: 'features.ai.enableSeo',
    displayName: 'Enable AI SEO',
    description: 'Allow AI-generated SEO metadata.',
    type: 'boolean',
    category: 'extras',
    defaultValue: true
  },
  {
    key: 'features.ai.enableImages',
    displayName: 'Enable AI Images',
    description: 'Allow AI-generated featured images.',
    type: 'boolean',
    category: 'extras',
    defaultValue: true
  },
  {
    key: 'features.ai.enableAudio',
    displayName: 'Enable AI Audio',
    description: 'Allow AI-generated audio narration.',
    type: 'boolean',
    category: 'extras',
    defaultValue: false
  },
  {
    key: 'features.ai.usageCaps.enabled',
    displayName: 'Enable AI Usage Caps',
    description: 'Apply daily request caps per capability and user.',
    type: 'boolean',
    category: 'extras',
    defaultValue: false
  },
  {
    key: 'features.ai.usageCaps.seoDailyRequests',
    displayName: 'SEO Requests Per User / Day',
    description: 'Set to 0 for unlimited.',
    type: 'number',
    category: 'extras',
    defaultValue: 0,
    validation: { min: 0, max: 10000 }
  },
  {
    key: 'features.ai.usageCaps.imageDailyRequests',
    displayName: 'Image Requests Per User / Day',
    description: 'Set to 0 for unlimited.',
    type: 'number',
    category: 'extras',
    defaultValue: 0,
    validation: { min: 0, max: 10000 }
  },
  {
    key: 'features.ai.usageCaps.audioDailyRequests',
    displayName: 'Audio Requests Per User / Day',
    description: 'Set to 0 for unlimited.',
    type: 'number',
    category: 'extras',
    defaultValue: 0,
    validation: { min: 0, max: 10000 }
  },
  {
    key: 'features.ai.defaultProvider.text',
    displayName: 'Default Text Provider',
    description: 'Provider used for AI text generation.',
    type: 'string',
    category: 'extras',
    defaultValue: 'openai',
    validation: { options: ['openai', 'gemini', 'anthropic'] }
  },
  {
    key: 'features.ai.defaultProvider.image',
    displayName: 'Default Image Provider',
    description: 'Provider used for AI image generation.',
    type: 'string',
    category: 'extras',
    defaultValue: 'openai',
    validation: { options: ['openai', 'gemini'] }
  },
  {
    key: 'features.ai.imageSize',
    displayName: 'OpenAI Image Size',
    description: 'Pixel size used for OpenAI image generation.',
    type: 'string',
    category: 'extras',
    defaultValue: '1024x1024',
    validation: { options: ['1024x1024', '1792x1024', '1024x1792'] }
  },
  {
    key: 'features.ai.imageAspectRatio',
    displayName: 'Gemini Aspect Ratio',
    description: 'Aspect ratio for Gemini image generation.',
    type: 'string',
    category: 'extras',
    defaultValue: '1:1',
    validation: { options: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] }
  },
  {
    key: 'features.ai.imageResolution',
    displayName: 'Gemini Image Resolution',
    description: 'Resolution for Gemini image preview models (1K, 2K, 4K).',
    type: 'string',
    category: 'extras',
    defaultValue: '1K',
    validation: { options: ['1K', '2K', '4K'] }
  },
  {
    key: 'features.ai.defaultProvider.audio',
    displayName: 'Default Audio Provider',
    description: 'Provider used for AI audio generation.',
    type: 'string',
    category: 'extras',
    defaultValue: 'openai',
    validation: { options: ['openai', 'elevenlabs'] }
  },
  {
    key: 'features.ai.model.text.openai',
    displayName: 'OpenAI Text Model',
    description: 'Model used for OpenAI text generation.',
    type: 'string',
    category: 'extras',
    defaultValue: 'gpt-4o-mini'
  },
  {
    key: 'features.ai.model.text.gemini',
    displayName: 'Gemini Text Model',
    description: 'Model used for Gemini text generation.',
    type: 'string',
    category: 'extras',
    defaultValue: 'gemini-2.5-flash'
  },
  {
    key: 'features.ai.model.text.anthropic',
    displayName: 'Anthropic Text Model',
    description: 'Model used for Anthropic text generation.',
    type: 'string',
    category: 'extras',
    defaultValue: 'claude-3-5-sonnet-20240620'
  },
  {
    key: 'features.ai.model.image.openai',
    displayName: 'OpenAI Image Model',
    description: 'Model used for OpenAI image generation.',
    type: 'string',
    category: 'extras',
    defaultValue: 'gpt-image-1'
  },
  {
    key: 'features.ai.model.image.gemini',
    displayName: 'Gemini Image Model',
    description: 'Model used for Gemini image generation.',
    type: 'string',
    category: 'extras',
    defaultValue: 'gemini-2.5-flash-image'
  },
  {
    key: 'features.ai.model.audio.openai',
    displayName: 'OpenAI Audio Model',
    description: 'Model used for OpenAI audio generation.',
    type: 'string',
    category: 'extras',
    defaultValue: 'gpt-4o-mini-tts'
  },
  {
    key: 'features.ai.model.audio.elevenlabs',
    displayName: 'ElevenLabs Audio Model',
    description: 'Model used for ElevenLabs audio generation.',
    type: 'string',
    category: 'extras',
    defaultValue: 'eleven_turbo_v2'
  },
  {
    key: 'features.ai.voice.openai',
    displayName: 'OpenAI Voice',
    description: 'Default voice used for OpenAI audio generation.',
    type: 'string',
    category: 'extras',
    defaultValue: 'alloy'
  },
  {
    key: 'features.ai.voice.elevenlabs',
    displayName: 'ElevenLabs Voice ID',
    description: 'Default voice ID for ElevenLabs audio generation.',
    type: 'string',
    category: 'extras',
    defaultValue: 'EXAVITQu4vr4xnSDxMaL'
  }
];
