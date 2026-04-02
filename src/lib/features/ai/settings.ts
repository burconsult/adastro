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
    key: 'features.ai.configVersion',
    displayName: 'AI Config Version',
    description: 'Internal AI settings version.',
    type: 'number',
    category: 'extras',
    defaultValue: 3,
    adminSurface: 'hidden'
  },
  {
    key: 'features.ai.tools.seo.enabled',
    displayName: 'Enable AI SEO',
    description: 'Allow AI-generated SEO metadata.',
    type: 'boolean',
    category: 'extras',
    defaultValue: true
  },
  {
    key: 'features.ai.tools.image.enabled',
    displayName: 'Enable AI Images',
    description: 'Allow AI-generated featured images.',
    type: 'boolean',
    category: 'extras',
    defaultValue: true
  },
  {
    key: 'features.ai.tools.audio.enabled',
    displayName: 'Enable AI Audio',
    description: 'Allow AI-generated audio narration.',
    type: 'boolean',
    category: 'extras',
    defaultValue: false
  },
  {
    key: 'features.ai.tools.alt.enabled',
    displayName: 'Enable AI Alt Text',
    description: 'Allow manual AI-generated alt text for uploaded images.',
    type: 'boolean',
    category: 'extras',
    defaultValue: true
  },
  {
    key: 'features.ai.limits.enabled',
    displayName: 'Enable AI Usage Caps',
    description: 'Apply daily request caps per capability and user.',
    type: 'boolean',
    category: 'extras',
    defaultValue: false
  },
  {
    key: 'features.ai.limits.seoDailyRequests',
    displayName: 'SEO Requests Per User / Day',
    description: 'Set to 0 for unlimited.',
    type: 'number',
    category: 'extras',
    defaultValue: 0,
    validation: { min: 0, max: 10000 }
  },
  {
    key: 'features.ai.limits.imageDailyRequests',
    displayName: 'Image Requests Per User / Day',
    description: 'Set to 0 for unlimited.',
    type: 'number',
    category: 'extras',
    defaultValue: 0,
    validation: { min: 0, max: 10000 }
  },
  {
    key: 'features.ai.limits.audioDailyRequests',
    displayName: 'Audio Requests Per User / Day',
    description: 'Set to 0 for unlimited.',
    type: 'number',
    category: 'extras',
    defaultValue: 0,
    validation: { min: 0, max: 10000 }
  },
  {
    key: 'features.ai.capabilities.text.defaultProvider',
    displayName: 'Default Text Provider',
    description: 'Provider used for AI text generation.',
    type: 'string',
    category: 'extras',
    defaultValue: 'gateway',
    validation: { options: ['gateway', 'openai', 'gemini', 'anthropic'] }
  },
  {
    key: 'features.ai.capabilities.text.defaultModel',
    displayName: 'Default Text Model',
    description: 'Default model used for AI text generation.',
    type: 'string',
    category: 'extras',
    defaultValue: 'openai/gpt-4o-mini'
  },
  {
    key: 'features.ai.capabilities.text.mediaAnalysisProvider',
    displayName: 'Media Analysis Provider',
    description: 'Provider used for image-aware text tasks such as alt text generation.',
    type: 'string',
    category: 'extras',
    defaultValue: 'gateway',
    validation: { options: ['gateway', 'openai', 'gemini'] }
  },
  {
    key: 'features.ai.capabilities.text.mediaAnalysisModel',
    displayName: 'Media Analysis Model',
    description: 'Vision-capable model used for image-aware text tasks.',
    type: 'string',
    category: 'extras',
    defaultValue: 'openai/gpt-4o-mini'
  },
  {
    key: 'features.ai.capabilities.image.defaultProvider',
    displayName: 'Default Image Provider',
    description: 'Provider used for AI image generation.',
    type: 'string',
    category: 'extras',
    defaultValue: 'gateway',
    validation: { options: ['gateway', 'openai', 'gemini'] }
  },
  {
    key: 'features.ai.capabilities.image.defaultModel',
    displayName: 'Default Image Model',
    description: 'Default model used for AI image generation.',
    type: 'string',
    category: 'extras',
    defaultValue: 'openai/gpt-image-1'
  },
  {
    key: 'features.ai.capabilities.image.defaultSize',
    displayName: 'Default Image Size',
    description: 'Pixel size used for OpenAI-compatible image generation.',
    type: 'string',
    category: 'extras',
    defaultValue: '1024x1024',
    validation: { options: ['1024x1024', '1792x1024', '1024x1792'] }
  },
  {
    key: 'features.ai.capabilities.image.defaultAspectRatio',
    displayName: 'Default Image Aspect Ratio',
    description: 'Aspect ratio for providers that support image aspect controls.',
    type: 'string',
    category: 'extras',
    defaultValue: '1:1',
    validation: { options: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] }
  },
  {
    key: 'features.ai.capabilities.image.defaultResolution',
    displayName: 'Default Image Resolution',
    description: 'Resolution for providers that support image resolution controls.',
    type: 'string',
    category: 'extras',
    defaultValue: '1K',
    validation: { options: ['1K', '2K', '4K'] }
  },
  {
    key: 'features.ai.capabilities.audio.defaultProvider',
    displayName: 'Default Audio Provider',
    description: 'Provider used for AI audio generation.',
    type: 'string',
    category: 'extras',
    defaultValue: 'elevenlabs',
    validation: { options: ['openai', 'elevenlabs'] }
  },
  {
    key: 'features.ai.capabilities.audio.defaultModel',
    displayName: 'Default Audio Model',
    description: 'Default model used for AI audio generation.',
    type: 'string',
    category: 'extras',
    defaultValue: 'eleven_turbo_v2'
  },
  {
    key: 'features.ai.capabilities.audio.defaultVoice',
    displayName: 'Default Audio Voice',
    description: 'Default voice used for AI audio generation.',
    type: 'string',
    category: 'extras',
    defaultValue: 'EXAVITQu4vr4xnSDxMaL'
  },
  {
    key: 'features.ai.audio.narrationIntroByLocale',
    displayName: 'Narration Intro By Locale',
    description: 'JSON map keyed by locale. Supports {{postTitle}}, {{siteTitle}}, {{authorName}}, and {{locale}} tokens.',
    type: 'json',
    category: 'extras',
    defaultValue: {}
  },
  {
    key: 'features.ai.audio.narrationOutroByLocale',
    displayName: 'Narration Outro By Locale',
    description: 'JSON map keyed by locale. Supports {{postTitle}}, {{siteTitle}}, {{authorName}}, and {{locale}} tokens.',
    type: 'json',
    category: 'extras',
    defaultValue: {}
  }
];
