import { GatewayImageProvider, GatewayTextProvider } from './providers/gateway.js';
import { OpenAiAudioProvider, OpenAiImageProvider, OpenAiTextProvider } from './providers/openai.js';
import { GeminiImageProvider, GeminiTextProvider } from './providers/gemini.js';
import { AnthropicTextProvider } from './providers/anthropic.js';
import { ElevenLabsAudioProvider } from './providers/elevenlabs.js';
import type {
  AiAudioProvider,
  AiCapability,
  AiImageProvider,
  AiProviderDescriptor,
  AiProviderId,
  AiTextProvider
} from './types.js';

type ProviderModule = {
  descriptor: AiProviderDescriptor;
  createTextProvider?: () => AiTextProvider;
  createImageProvider?: () => AiImageProvider;
  createAudioProvider?: () => AiAudioProvider;
};

const textProviders = new Map<AiProviderId, AiTextProvider>();
const imageProviders = new Map<AiProviderId, AiImageProvider>();
const audioProviders = new Map<AiProviderId, AiAudioProvider>();

const createCapabilitySupport = (
  implemented: Partial<Record<AiCapability, { supportsModelDiscovery?: boolean; supportsVoiceDiscovery?: boolean }>>
) => ({
  text: {
    supported: Boolean(implemented.text),
    implemented: Boolean(implemented.text),
    supportsModelDiscovery: implemented.text?.supportsModelDiscovery
  },
  image: {
    supported: Boolean(implemented.image),
    implemented: Boolean(implemented.image),
    supportsModelDiscovery: implemented.image?.supportsModelDiscovery
  },
  audio: {
    supported: Boolean(implemented.audio),
    implemented: Boolean(implemented.audio),
    supportsModelDiscovery: implemented.audio?.supportsModelDiscovery,
    supportsVoiceDiscovery: implemented.audio?.supportsVoiceDiscovery
  },
  video: {
    supported: Boolean(implemented.video),
    implemented: Boolean(implemented.video),
    supportsModelDiscovery: implemented.video?.supportsModelDiscovery
  }
});

const PROVIDER_MODULES: Record<AiProviderId, ProviderModule> = {
  gateway: {
    descriptor: {
      id: 'gateway',
      label: 'Vercel AI Gateway',
      envKey: 'AI_GATEWAY_API_KEY',
      docsUrl: 'https://vercel.com/docs/ai-gateway',
      pricingUrl: 'https://vercel.com/docs/ai-gateway',
      executionMode: 'gateway',
      capabilities: createCapabilitySupport({
        text: { supportsModelDiscovery: true },
        image: { supportsModelDiscovery: true }
      })
    },
    createTextProvider: () => new GatewayTextProvider(),
    createImageProvider: () => new GatewayImageProvider()
  },
  openai: {
    descriptor: {
      id: 'openai',
      label: 'OpenAI',
      envKey: 'OPENAI_API_KEY',
      docsUrl: 'https://platform.openai.com/docs/models',
      pricingUrl: 'https://openai.com/api/pricing',
      executionMode: 'direct',
      capabilities: createCapabilitySupport({
        text: { supportsModelDiscovery: true },
        image: { supportsModelDiscovery: true },
        audio: { supportsModelDiscovery: true }
      })
    },
    createTextProvider: () => new OpenAiTextProvider(),
    createImageProvider: () => new OpenAiImageProvider(),
    createAudioProvider: () => new OpenAiAudioProvider()
  },
  gemini: {
    descriptor: {
      id: 'gemini',
      label: 'Google Gemini',
      envKey: 'GOOGLE_GENAI_API_KEY',
      docsUrl: 'https://ai.google.dev/gemini-api/docs/models',
      pricingUrl: 'https://ai.google.dev/pricing',
      executionMode: 'direct',
      capabilities: createCapabilitySupport({
        text: { supportsModelDiscovery: true },
        image: { supportsModelDiscovery: true }
      })
    },
    createTextProvider: () => new GeminiTextProvider(),
    createImageProvider: () => new GeminiImageProvider()
  },
  anthropic: {
    descriptor: {
      id: 'anthropic',
      label: 'Anthropic',
      envKey: 'ANTHROPIC_API_KEY',
      docsUrl: 'https://docs.anthropic.com/en/docs/about-claude/models',
      pricingUrl: 'https://www.anthropic.com/pricing#api',
      executionMode: 'direct',
      capabilities: createCapabilitySupport({
        text: { supportsModelDiscovery: true }
      })
    },
    createTextProvider: () => new AnthropicTextProvider()
  },
  elevenlabs: {
    descriptor: {
      id: 'elevenlabs',
      label: 'ElevenLabs',
      envKey: 'ELEVENLABS_API_KEY',
      docsUrl: 'https://elevenlabs.io/docs/api-reference/models',
      pricingUrl: 'https://elevenlabs.io/pricing',
      executionMode: 'direct',
      capabilities: createCapabilitySupport({
        audio: { supportsModelDiscovery: true, supportsVoiceDiscovery: true }
      })
    },
    createAudioProvider: () => new ElevenLabsAudioProvider()
  }
};

export const AI_PROVIDER_REGISTRY: Record<AiProviderId, ProviderModule> = PROVIDER_MODULES;

export const getProviderRegistry = (): AiProviderDescriptor[] =>
  Object.values(PROVIDER_MODULES).map((entry) => entry.descriptor);

export const getProviderDescriptor = (provider: AiProviderId): AiProviderDescriptor | undefined =>
  PROVIDER_MODULES[provider]?.descriptor;

export const supportsCapability = (provider: AiProviderId, capability: AiCapability): boolean =>
  Boolean(PROVIDER_MODULES[provider]?.descriptor.capabilities[capability]?.implemented);

export const getTextProvider = (provider: AiProviderId): AiTextProvider => {
  const module = PROVIDER_MODULES[provider];
  if (!module?.createTextProvider) {
    throw new Error(`Provider "${provider}" does not support AI text generation.`);
  }
  if (!textProviders.has(provider)) {
    textProviders.set(provider, module.createTextProvider());
  }
  return textProviders.get(provider)!;
};

export const getImageProvider = (provider: AiProviderId): AiImageProvider => {
  const module = PROVIDER_MODULES[provider];
  if (!module?.createImageProvider) {
    throw new Error(`Provider "${provider}" does not support AI image generation.`);
  }
  if (!imageProviders.has(provider)) {
    imageProviders.set(provider, module.createImageProvider());
  }
  return imageProviders.get(provider)!;
};

export const getAudioProvider = (provider: AiProviderId): AiAudioProvider => {
  const module = PROVIDER_MODULES[provider];
  if (!module?.createAudioProvider) {
    throw new Error(`Provider "${provider}" does not support AI audio generation.`);
  }
  if (!audioProviders.has(provider)) {
    audioProviders.set(provider, module.createAudioProvider());
  }
  return audioProviders.get(provider)!;
};
