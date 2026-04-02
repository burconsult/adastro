import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from '@/lib/database/connection';

const mocks = vi.hoisted(() => ({
  requireAuthor: vi.fn(),
  generateSeoMetadata: vi.fn(),
  generateImage: vi.fn(),
  generateAudio: vi.fn(),
  generateDraftSuggestions: vi.fn(),
  generateEditorialReview: vi.fn(),
  getConfiguredProviders: vi.fn(),
  getConfiguredImageProviders: vi.fn(),
  getConfiguredAudioProviders: vi.fn(),
  getConfiguredProvidersByCapability: vi.fn(),
  getConfiguredImageInputTextProviders: vi.fn(),
  getProviderCatalog: vi.fn(),
  isProviderConfigured: vi.fn(),
  discoverAllProviderModels: vi.fn(),
  discoverProviderVoices: vi.fn(),
  getKnownModelsForProviderCapability: vi.fn(),
  getRegistryModelsForProviderCapability: vi.fn(),
  getSettings: vi.fn(),
  getSettingsByPrefix: vi.fn(),
  updateSettings: vi.fn(),
  uploadMedia: vi.fn(),
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  checkUsageCap: vi.fn(),
  recordUsageEvent: vi.fn(),
  getUsageSummary: vi.fn(),
  findAuthorById: vi.fn(),
  findMediaById: vi.fn(),
  updateMedia: vi.fn(),
  supabaseFrom: vi.fn()
}));

vi.mock('@/lib/auth/auth-helpers', () => ({
  requireAuthor: mocks.requireAuthor
}));

vi.mock('../lib/seo.js', () => ({
  generateSeoMetadata: mocks.generateSeoMetadata
}));

vi.mock('../lib/image.js', () => ({
  generateImage: mocks.generateImage,
  getConfiguredImageProviders: mocks.getConfiguredImageProviders
}));

vi.mock('../lib/audio.js', () => ({
  generateAudio: mocks.generateAudio,
  getConfiguredAudioProviders: mocks.getConfiguredAudioProviders
}));

vi.mock('../lib/editorial.js', () => ({
  generateDraftSuggestions: mocks.generateDraftSuggestions,
  generateEditorialReview: mocks.generateEditorialReview
}));

vi.mock('../lib/index.js', () => ({
  getConfiguredProviders: mocks.getConfiguredProviders
}));

vi.mock('../lib/provider-catalog.js', () => ({
  AI_PROVIDER_CATALOG: {
    gateway: { envKey: 'AI_GATEWAY_API_KEY' },
    openai: { envKey: 'OPENAI_API_KEY' },
    gemini: { envKey: 'GOOGLE_GENAI_API_KEY' },
    anthropic: { envKey: 'ANTHROPIC_API_KEY' },
    elevenlabs: { envKey: 'ELEVENLABS_API_KEY' }
  },
  getConfiguredProvidersByCapability: mocks.getConfiguredProvidersByCapability,
  getConfiguredImageInputTextProviders: mocks.getConfiguredImageInputTextProviders,
  getProviderCatalog: mocks.getProviderCatalog,
  isProviderConfigured: mocks.isProviderConfigured,
  discoverAllProviderModels: mocks.discoverAllProviderModels,
  discoverProviderVoices: mocks.discoverProviderVoices,
  getKnownModelsForProviderCapability: mocks.getKnownModelsForProviderCapability,
  getRegistryModelsForProviderCapability: mocks.getRegistryModelsForProviderCapability
}));

vi.mock('../lib/usage.js', () => ({
  checkUsageCap: mocks.checkUsageCap,
  recordUsageEvent: mocks.recordUsageEvent,
  getUsageSummary: mocks.getUsageSummary
}));

vi.mock('@/lib/services/settings-service', () => ({
  SettingsService: vi.fn(() => ({
    getSettings: mocks.getSettings,
    getSettingsByPrefix: mocks.getSettingsByPrefix,
    updateSettings: mocks.updateSettings
  }))
}));

vi.mock('@/lib/services/media-manager', () => ({
  mediaManager: {
    uploadMedia: mocks.uploadMedia
  }
}));

vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit
}));

vi.mock('@/lib/security/request-guards', () => ({
  getClientIp: mocks.getClientIp
}));

vi.mock('@/lib/database/repositories/author-repository', () => ({
  AuthorRepository: vi.fn(() => ({
    findById: mocks.findAuthorById
  }))
}));

vi.mock('@/lib/database/repositories/media-repository', () => ({
  MediaRepository: vi.fn(() => ({
    findById: mocks.findMediaById,
    update: mocks.updateMedia
  }))
}));

vi.mock('@/lib/supabase.js', () => ({
  supabase: {},
  supabaseAdmin: {
    from: mocks.supabaseFrom
  }
}));

import { AI_FEATURE_API } from '../api.js';

const SETTINGS_DEFAULTS: Record<string, unknown> = {
  'features.ai.enabled': true,
  'features.ai.configVersion': 3,
  'features.ai.tools.seo.enabled': true,
  'features.ai.tools.image.enabled': true,
  'features.ai.tools.audio.enabled': true,
  'features.ai.tools.alt.enabled': true,
  'features.ai.capabilities.text.defaultProvider': 'openai',
  'features.ai.capabilities.text.defaultModel': 'gpt-5',
  'features.ai.capabilities.text.mediaAnalysisProvider': 'openai',
  'features.ai.capabilities.text.mediaAnalysisModel': 'gpt-4o-mini',
  'features.ai.capabilities.image.defaultProvider': 'openai',
  'features.ai.capabilities.image.defaultModel': 'gpt-image-1',
  'features.ai.capabilities.image.defaultSize': '1024x1024',
  'features.ai.capabilities.image.defaultAspectRatio': '1:1',
  'features.ai.capabilities.image.defaultResolution': '1K',
  'features.ai.capabilities.audio.defaultProvider': 'openai',
  'features.ai.capabilities.audio.defaultModel': 'gpt-4o-mini-tts',
  'features.ai.capabilities.audio.defaultVoice': 'alloy',
  'features.ai.audio.narrationIntroByLocale': {},
  'features.ai.audio.narrationOutroByLocale': {},
  'features.ai.limits.enabled': false,
  'features.ai.limits.seoDailyRequests': 0,
  'features.ai.limits.imageDailyRequests': 0,
  'features.ai.limits.audioDailyRequests': 0
};

const createRequest = (path: string, method: string, body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('AI feature API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireAuthor.mockResolvedValue({
      id: 'user-1',
      authorId: 'author-1',
      role: 'author',
      email: 'author@example.com'
    });
    mocks.getConfiguredProviders.mockReturnValue(['openai']);
    mocks.getConfiguredImageProviders.mockReturnValue(['openai']);
    mocks.getConfiguredAudioProviders.mockReturnValue(['openai']);
    mocks.getConfiguredProvidersByCapability.mockImplementation((capability: string) => {
      if (capability === 'text') return ['openai'];
      if (capability === 'image') return ['openai'];
      if (capability === 'audio') return ['openai'];
      return [];
    });
    mocks.getConfiguredImageInputTextProviders.mockReturnValue(['openai']);
    mocks.getProviderCatalog.mockReturnValue([
      {
        id: 'openai',
        label: 'OpenAI',
        envKey: 'OPENAI_API_KEY',
        docsUrl: 'https://example.com/docs',
        pricingUrl: 'https://example.com/pricing',
        capabilities: {
          text: { implemented: true, supportsImageInput: true },
          image: { implemented: true },
          audio: { implemented: true }
        }
      }
    ]);
    mocks.isProviderConfigured.mockReturnValue(true);
    mocks.discoverAllProviderModels.mockResolvedValue({
      openai: {
        models: [{ id: 'gpt-5', name: 'gpt-5', provider: 'openai', capabilities: ['text'], source: 'registry' }],
        source: 'registry',
        updatedAt: new Date().toISOString()
      }
    });
    mocks.discoverProviderVoices.mockResolvedValue({
      voices: [{ id: 'EXAVITQu4vr4xnSDxMaL', name: 'Default ElevenLabs Voice' }],
      source: 'registry',
      updatedAt: new Date().toISOString()
    });
    mocks.getKnownModelsForProviderCapability.mockImplementation(async (provider: string, capability: string) => {
      if (provider === 'openai' && capability === 'text') return [{ id: 'gpt-5' }];
      if (provider === 'openai' && capability === 'image') return [{ id: 'gpt-image-1' }];
      if (provider === 'openai' && capability === 'audio') return [{ id: 'gpt-4o-mini-tts' }];
      if (provider === 'elevenlabs' && capability === 'audio') return [{ id: 'eleven_turbo_v2' }];
      if (provider === 'gemini' && capability === 'text') return [{ id: 'gemini-2.5-flash' }];
      if (provider === 'gemini' && capability === 'image') return [{ id: 'gemini-2.5-flash-image' }];
      if (provider === 'anthropic' && capability === 'text') return [{ id: 'claude-3-5-sonnet-20240620' }];
      if (provider === 'gateway' && capability === 'text') return [{ id: 'openai/gpt-5' }];
      if (provider === 'gateway' && capability === 'image') return [{ id: 'openai/gpt-image-1' }];
      return [];
    });
    mocks.getRegistryModelsForProviderCapability.mockImplementation((provider: string, capability: string) => {
      if (provider === 'openai' && capability === 'text') return [{ id: 'gpt-5' }];
      if (provider === 'openai' && capability === 'image') return [{ id: 'gpt-image-1' }];
      if (provider === 'openai' && capability === 'audio') return [{ id: 'gpt-4o-mini-tts' }];
      if (provider === 'elevenlabs' && capability === 'audio') return [{ id: 'eleven_turbo_v2' }];
      if (provider === 'gemini' && capability === 'text') return [{ id: 'gemini-2.5-flash' }];
      if (provider === 'gemini' && capability === 'image') return [{ id: 'gemini-2.5-flash-image' }];
      if (provider === 'anthropic' && capability === 'text') return [{ id: 'claude-3-5-sonnet-20240620' }];
      if (provider === 'gateway' && capability === 'text') return [{ id: 'openai/gpt-5' }];
      if (provider === 'gateway' && capability === 'image') return [{ id: 'openai/gpt-image-1' }];
      return [];
    });
    mocks.getSettings.mockImplementation(async (keys: string[]) =>
      Object.fromEntries(keys.map((key) => [key, SETTINGS_DEFAULTS[key]]))
    );
    mocks.getSettingsByPrefix.mockResolvedValue({ 'features.ai.configVersion': 3 });
    mocks.updateSettings.mockResolvedValue(undefined);
    mocks.checkRateLimit.mockReturnValue({ allowed: true, retryAfterSec: 0, remaining: 99 });
    mocks.getClientIp.mockReturnValue('127.0.0.1');
    mocks.checkUsageCap.mockResolvedValue({ allowed: true });
    mocks.recordUsageEvent.mockResolvedValue(undefined);
    mocks.getUsageSummary.mockResolvedValue({
      days: 30,
      totals: {
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costs: {
          estimatedUsd: 0,
          minimumUsd: 0,
          maximumUsd: 0,
          exactRequests: 0,
          estimatedRequests: 0,
          rangeRequests: 0,
          pricedRequests: 0,
          unpricedRequests: 0
        }
      },
      byCapability: {},
      byOperation: {},
      byProvider: {},
      byModel: {},
      byDay: {}
    });
    mocks.generateSeoMetadata.mockResolvedValue({
      seoMetadata: { metaTitle: 'Generated' },
      provider: 'openai',
      model: 'gpt-5',
      usage: {
        inputTokens: 120,
        outputTokens: 60,
        totalTokens: 180
      }
    });
    mocks.generateImage.mockResolvedValue({
      data: new Uint8Array([1, 2, 3]),
      mimeType: 'image/png',
      provider: 'openai',
      model: 'gpt-image-1'
    });
    mocks.generateAudio.mockResolvedValue({
      data: new Uint8Array([1, 2, 3]),
      mimeType: 'audio/mpeg',
      provider: 'openai',
      model: 'gpt-4o-mini-tts',
      voice: 'alloy'
    });
    mocks.generateDraftSuggestions.mockResolvedValue({
      provider: 'openai',
      model: 'gpt-5',
      suggestions: {
        titleSuggestions: ['A stronger title'],
        excerpt: 'Suggested excerpt',
        slug: 'a-stronger-title',
        seo: {
          metaTitle: 'SEO title',
          metaDescription: 'SEO description',
          keywords: ['alpha']
        },
        categoryIds: ['cat-1'],
        tagIds: ['tag-1'],
        tagNames: ['Alpha'],
        unmatchedTagNames: [],
        notes: ['Lead with the strongest angle.']
      }
    });
    mocks.generateEditorialReview.mockResolvedValue({
      provider: 'openai',
      model: 'gpt-5',
      review: {
        summary: 'Good draft with a few gaps.',
        heuristics: [{ field: 'seo', message: 'SEO description is missing.' }],
        aiWarnings: [{ field: 'excerpt', message: 'Excerpt could be more specific.' }],
        quickWins: ['Add a more specific excerpt.']
      }
    });
    mocks.findAuthorById.mockResolvedValue({
      id: 'author-1',
      name: 'Author Name'
    });
    mocks.findMediaById.mockResolvedValue({
      id: 'asset-1',
      filename: 'asset.png',
      url: 'https://example.com/asset.png',
      storagePath: 'asset.png',
      mimeType: 'image/png',
      fileSize: 100,
      createdAt: new Date(),
      altText: ''
    });
    mocks.updateMedia.mockResolvedValue({
      id: 'asset-1',
      altText: 'Generated alt text'
    });
    mocks.uploadMedia.mockResolvedValue({
      public: { id: 'asset-1', url: 'https://example.com/asset.png' },
      original: null
    });
    mocks.supabaseFrom.mockImplementation(() => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({ data: { uploaded_by: 'author-1' }, error: null }))
      };
      return query;
    });
  });

  it('returns 429 when SEO generation is rate-limited', async () => {
    mocks.checkRateLimit.mockReturnValue({ allowed: false, retryAfterSec: 42, remaining: 0 });

    const response = await AI_FEATURE_API.handlers.seo({
      request: createRequest('/api/features/ai/seo', 'POST', { title: 'Hello' }),
      params: {}
    });

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('42');
    expect(mocks.generateSeoMetadata).not.toHaveBeenCalled();
  });

  it('returns draft assist suggestions', async () => {
    const response = await AI_FEATURE_API.handlers.draft({
      request: createRequest('/api/features/ai/draft', 'POST', {
        title: 'Draft title',
        content: 'Draft body',
        seoMetadata: {
          metaTitle: 'Existing title',
          metaDescription: 'Existing description',
          openGraph: {
            title: 'OG title',
            description: 'OG description'
          },
          twitterCard: {
            card: 'summary_large_image',
            title: 'Twitter title',
            description: 'Twitter description'
          },
          alternateLocales: [
            { locale: 'nb', slug: 'utkast-tittel' }
          ]
        },
        categories: [{ id: 'cat-1', name: 'News', slug: 'news' }],
        tags: [{ id: 'tag-1', name: 'Alpha', slug: 'alpha' }]
      }),
      params: {}
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.suggestions?.slug).toBe('a-stronger-title');
    expect(mocks.generateDraftSuggestions).toHaveBeenCalled();
  });

  it('returns editorial QA results', async () => {
    const response = await AI_FEATURE_API.handlers.review({
      request: createRequest('/api/features/ai/review', 'POST', {
        title: 'Draft title',
        content: 'Draft body',
        seoMetadata: {
          metaTitle: 'Existing title',
          metaDescription: 'Existing description',
          openGraph: {
            title: 'OG title',
            description: 'OG description'
          },
          twitterCard: {
            card: 'summary_large_image',
            title: 'Twitter title',
            description: 'Twitter description'
          },
          alternateLocales: [
            { locale: 'nb', slug: 'utkast-tittel' }
          ]
        },
        categories: [{ id: 'cat-1', name: 'News', slug: 'news' }],
        tags: [{ id: 'tag-1', name: 'Alpha', slug: 'alpha' }],
        hasFeaturedImage: false
      }),
      params: {}
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.review?.summary).toBe('Good draft with a few gaps.');
    expect(mocks.generateEditorialReview).toHaveBeenCalled();
  });

  it('rejects image requests for unconfigured providers', async () => {
    mocks.getConfiguredImageProviders.mockReturnValue(['openai']);

    const response = await AI_FEATURE_API.handlers.image({
      request: createRequest('/api/features/ai/image', 'POST', {
        provider: 'gemini',
        prompt: 'Generate a poster'
      }),
      params: {}
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/not configured/i);
    expect(mocks.generateImage).not.toHaveBeenCalled();
  });

  it('rejects unsupported audio models for the selected provider', async () => {
    const response = await AI_FEATURE_API.handlers.audio({
      request: createRequest('/api/features/ai/audio', 'POST', {
        title: 'Audio title',
        content: 'Audio content',
        provider: 'openai',
        model: 'bad-model'
      }),
      params: {}
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/not supported/i);
    expect(mocks.generateAudio).not.toHaveBeenCalled();
  });

  it('accepts explicit audio models discovered remotely even when absent from the static registry', async () => {
    mocks.getKnownModelsForProviderCapability.mockResolvedValueOnce([{ id: 'remote-audio-model' }]);
    mocks.getRegistryModelsForProviderCapability.mockReturnValueOnce([]);
    mocks.generateAudio.mockResolvedValueOnce({
      data: new Uint8Array([1, 2, 3]),
      mimeType: 'audio/mpeg',
      provider: 'openai',
      model: 'remote-audio-model',
      voice: 'alloy'
    });

    const response = await AI_FEATURE_API.handlers.audio({
      request: createRequest('/api/features/ai/audio', 'POST', {
        title: 'Audio title',
        content: 'Audio content',
        provider: 'openai',
        model: 'remote-audio-model'
      }),
      params: {}
    });

    expect(response.status).toBe(200);
    expect(mocks.generateAudio).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'openai',
      model: 'remote-audio-model'
    }));
  });

  it('returns 429 when daily usage cap is reached', async () => {
    mocks.checkUsageCap.mockResolvedValueOnce({
      allowed: false,
      limit: 1,
      used: 1,
      retryAt: new Date(Date.now() + 60_000).toISOString()
    });

    const response = await AI_FEATURE_API.handlers.image({
      request: createRequest('/api/features/ai/image', 'POST', {
        title: 'Image title',
        prompt: 'Generate'
      }),
      params: {}
    });

    const payload = await response.json();
    expect(response.status).toBe(429);
    expect(payload.error).toMatch(/cap reached/i);
    expect(mocks.generateImage).not.toHaveBeenCalled();
  });

  it('maps auth validation failures to 401 for status endpoint', async () => {
    mocks.requireAuthor.mockRejectedValue(new ValidationError('Authentication required'));

    const response = await AI_FEATURE_API.handlers.status({
      request: createRequest('/api/features/ai/status', 'GET'),
      params: {}
    });

    const payload = await response.json();
    expect(response.status).toBe(401);
    expect(payload.error).toBe('Authentication required');
  });

  it('returns sanitized 500 errors for failed SEO provider calls', async () => {
    mocks.generateSeoMetadata.mockRejectedValue(new Error('upstream provider details'));

    const response = await AI_FEATURE_API.handlers.seo({
      request: createRequest('/api/features/ai/seo', 'POST', {
        title: 'A title',
        content: 'A body'
      }),
      params: {}
    });

    const payload = await response.json();
    expect(response.status).toBe(500);
    expect(payload.error).toBe('upstream provider details');
    expect(payload.fallbackError).toBe('Failed to generate SEO metadata');
    expect(JSON.stringify(payload)).not.toMatch(/sk-[a-z0-9_-]+/i);
  });

  it('accepts valid image generation requests and uploads media', async () => {
    const response = await AI_FEATURE_API.handlers.image({
      request: createRequest('/api/features/ai/image', 'POST', {
        title: 'Ship launch',
        prompt: 'A starship launch over ocean'
      }),
      params: {}
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.media?.id).toBe('asset-1');
    expect(mocks.generateImage).toHaveBeenCalled();
    expect(mocks.uploadMedia).toHaveBeenCalled();
  });

  it('returns usage summary payload for usage endpoint', async () => {
    mocks.getUsageSummary.mockResolvedValueOnce({
      days: 7,
      totals: {
        requests: 5,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costs: {
          estimatedUsd: 1.25,
          minimumUsd: 1.25,
          maximumUsd: 1.25,
          exactRequests: 2,
          estimatedRequests: 1,
          rangeRequests: 1,
          pricedRequests: 4,
          unpricedRequests: 1
        }
      },
      byCapability: {
        text: { requests: 2, costs: { estimatedUsd: 0.75, minimumUsd: 0.75, maximumUsd: 0.75, exactRequests: 2, estimatedRequests: 0, rangeRequests: 0, pricedRequests: 2, unpricedRequests: 0 } },
        image: { requests: 3, costs: { estimatedUsd: 0.5, minimumUsd: 0.3, maximumUsd: 0.8, exactRequests: 0, estimatedRequests: 1, rangeRequests: 1, pricedRequests: 2, unpricedRequests: 1 } }
      },
      byOperation: {},
      byProvider: {},
      byModel: {},
      byDay: {}
    });

    const response = await AI_FEATURE_API.handlers.usage({
      request: createRequest('/api/features/ai/usage?days=7', 'GET'),
      params: {}
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.summary?.days).toBe(7);
    expect(payload.summary?.totals?.requests).toBe(5);
  });
});
