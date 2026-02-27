import { requireAuthor } from '@/lib/auth/auth-helpers';
import { ValidationError } from '@/lib/database/connection';
import { generateSeoMetadata } from './lib/seo.js';
import { generateImage } from './lib/image.js';
import { generateAudio } from './lib/audio.js';
import { getConfiguredProviders } from './lib/index.js';
import { getConfiguredImageProviders } from './lib/image.js';
import { getConfiguredAudioProviders } from './lib/audio.js';
import { AI_MODEL_REGISTRY } from './lib/model-registry.js';
import {
  AI_PROVIDER_CATALOG,
  discoverAllProviderModels,
  getConfiguredProvidersByCapability,
  getProviderCatalog,
  isProviderConfigured
} from './lib/provider-catalog.js';
import { checkUsageCap, getUsageSummary, recordUsageEvent } from './lib/usage.js';
import { normalizeFeatureFlag } from '@/lib/features/flags';
import { SettingsService } from '@/lib/services/settings-service';
import { mediaManager } from '@/lib/services/media-manager';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { getClientIp } from '@/lib/security/request-guards';
import type { AiAudioProviderKey, AiImageProviderKey, AiProviderKey } from './lib/types.js';
import type { FeatureApiHandler, FeatureApiModule } from '../types.js';
import { z } from 'zod';

const settingsService = new SettingsService();

const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

const methodNotAllowed = () => json({ error: 'Method not allowed' }, 405);

const ALLOWED_IMAGE_SIZES = ['1024x1024', '1792x1024', '1024x1792'] as const;
const ALLOWED_IMAGE_SIZES_WITH_LEGACY = [...ALLOWED_IMAGE_SIZES, '1536x1024', '1024x1536'] as const;
const ALLOWED_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const;
const ALLOWED_IMAGE_RESOLUTIONS = ['1K', '2K', '4K'] as const;

const seoPayloadSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(180, 'Title is too long'),
  excerpt: z.string().trim().max(2_000, 'Excerpt is too long').optional().default(''),
  content: z.string().max(120_000, 'Content is too long').optional().default(''),
  tags: z.array(z.string().trim().min(1).max(80)).max(20, 'Too many tags').optional().default([]),
  provider: z.enum(['openai', 'gemini', 'anthropic']).optional(),
  model: z.string().trim().min(1).max(120).optional()
}).strict();

const imagePayloadSchema = z.object({
  prompt: z.string().trim().min(1).max(1_200).optional(),
  title: z.string().trim().min(1).max(180).optional(),
  excerpt: z.string().trim().max(2_000).optional().default(''),
  tags: z.array(z.string().trim().min(1).max(80)).max(20).optional().default([]),
  style: z.string().trim().max(120).optional(),
  provider: z.enum(['openai', 'gemini']).optional(),
  model: z.string().trim().min(1).max(120).optional(),
  size: z.enum(ALLOWED_IMAGE_SIZES_WITH_LEGACY).optional(),
  aspectRatio: z.enum(ALLOWED_ASPECT_RATIOS).optional(),
  resolution: z.enum(ALLOWED_IMAGE_RESOLUTIONS).optional()
}).strict().refine((payload) => Boolean(payload.prompt || payload.title), {
  message: 'Prompt or title is required',
  path: ['prompt']
});

const audioPayloadSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(180, 'Title is too long'),
  content: z.string().min(1, 'Content is required').max(120_000, 'Content is too long'),
  provider: z.enum(['openai', 'elevenlabs']).optional(),
  voice: z.string().trim().min(1).max(120).optional(),
  model: z.string().trim().min(1).max(120).optional(),
  speed: z.number().min(0.25, 'Speed must be at least 0.25').max(2, 'Speed must be 2.0 or lower').optional()
}).strict();

const buildImagePrompt = (title: string, excerpt: string, tags: string[], style?: string) => {
  const tagLine = tags.length > 0 ? `Tags: ${tags.join(', ')}` : '';
  const styleLine = style ? `Style: ${style}` : 'Style: modern editorial hero image, clean lighting, minimal clutter.';

  return [
    'Create a high-quality hero image for a blog post.',
    `Title: ${title}`,
    excerpt ? `Excerpt: ${excerpt}` : '',
    tagLine,
    styleLine
  ]
    .filter(Boolean)
    .join('\n');
};

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const normalizeOpenAiSize = (value: string | undefined) => {
  if (value === '1536x1024') return '1792x1024';
  if (value === '1024x1536') return '1024x1792';
  return value;
};

const getAllowedModels = (type: 'text' | 'image' | 'audio', provider: string): string[] => {
  const providerConfig = (AI_MODEL_REGISTRY as Record<string, any>)[provider];
  const models = providerConfig?.[type]?.models;
  if (!Array.isArray(models)) return [];
  return models.filter((model): model is string => typeof model === 'string' && model.trim().length > 0);
};

const resolveProvider = <T extends string>(
  kind: 'text' | 'image' | 'audio',
  configuredProviders: T[],
  requestedProvider: T | undefined,
  defaultProvider: unknown
): { provider?: T; response?: Response } => {
  if (configuredProviders.length === 0) {
    return {
      response: json({ error: `No AI ${kind} providers are configured. Add a provider API key first.` }, 400)
    };
  }

  if (requestedProvider) {
    if (!configuredProviders.includes(requestedProvider)) {
      return {
        response: json({ error: `Provider "${requestedProvider}" is not configured for AI ${kind}.` }, 400)
      };
    }
    return { provider: requestedProvider };
  }

  const fallback = typeof defaultProvider === 'string' ? defaultProvider as T : undefined;
  if (fallback && configuredProviders.includes(fallback)) {
    return { provider: fallback };
  }

  return { provider: configuredProviders[0] };
};

const resolveModel = (
  type: 'text' | 'image' | 'audio',
  provider: string,
  requestedModel: string | undefined,
  defaultModel: unknown
): { model?: string; response?: Response } => {
  const normalizedRequestedModel = typeof requestedModel === 'string' ? requestedModel.trim() : '';
  if (normalizedRequestedModel) {
    const allowedModels = getAllowedModels(type, provider);
    if (allowedModels.length > 0 && !allowedModels.includes(normalizedRequestedModel)) {
      return {
        response: json({ error: `Model "${normalizedRequestedModel}" is not supported by provider "${provider}".` }, 400)
      };
    }
    return { model: normalizedRequestedModel };
  }

  const normalizedDefaultModel = typeof defaultModel === 'string' ? defaultModel.trim() : '';
  if (normalizedDefaultModel.length > 0) {
    return { model: normalizedDefaultModel };
  }

  return { model: getAllowedModels(type, provider)[0] };
};

const applyAiRateLimit = (
  request: Request,
  scope: string,
  userId: string | undefined,
  limit: number,
  windowMs: number
): Response | null => {
  const ip = getClientIp(request);
  const key = userId ? `ai:${scope}:user:${userId}` : `ai:${scope}:ip:${ip}`;
  const rateLimit = checkRateLimit({ key, limit, windowMs });
  if (rateLimit.allowed) return null;

  return new Response(JSON.stringify({ error: 'Too many AI requests. Please retry shortly.' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(rateLimit.retryAfterSec)
    }
  });
};

const parsePayload = async <T extends z.ZodTypeAny>(request: Request, schema: T) => {
  const payload = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(payload);
  if (parsed.success) {
    return { data: parsed.data as z.infer<T> };
  }

  const issue = parsed.error.issues[0];
  return {
    response: json({ error: issue?.message || 'Invalid request payload' }, 400)
  };
};

const handleAiError = (error: unknown, operation: string, fallbackMessage: string): Response => {
  if (error instanceof ValidationError) {
    const status = error.message === 'Authentication required' ? 401 : 403;
    return json({ error: error.message }, status);
  }

  console.error(`${operation} failed:`, error);
  const detail = error instanceof Error
    ? error.message
    : (typeof error === 'string' ? error : '');
  const sanitizedDetail = typeof detail === 'string'
    ? detail
      .replace(/(sk-[A-Za-z0-9_-]+)/g, '[redacted]')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 400)
    : '';

  return json(
    sanitizedDetail
      ? { error: sanitizedDetail, fallbackError: fallbackMessage }
      : { error: fallbackMessage },
    500
  );
};

const enforceUsageCap = async (
  operation: 'seo' | 'image' | 'audio',
  capability: 'text' | 'image' | 'audio',
  authUserId: string
): Promise<Response | null> => {
  const cap = await checkUsageCap({ operation, capability, authUserId });
  if (cap.allowed) return null;
  const retryAfter = cap.retryAt ? Math.max(60, Math.ceil((new Date(cap.retryAt).getTime() - Date.now()) / 1000)) : 60;
  return new Response(JSON.stringify({
    error: `Daily AI ${operation} request cap reached (${cap.used}/${cap.limit}).`
  }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfter)
    }
  });
};

const seoHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    const user = await requireAuthor(request);
    const rateLimited = applyAiRateLimit(request, 'seo', user.id, 20, 10 * 60 * 1000);
    if (rateLimited) {
      return rateLimited;
    }

    const parsedPayload = await parsePayload(request, seoPayloadSchema);
    if ('response' in parsedPayload) {
      return parsedPayload.response;
    }
    const payload = parsedPayload.data;

    const settings = await settingsService.getSettings([
      'features.ai.enabled',
      'features.ai.enableSeo',
      'features.ai.defaultProvider.text',
      'features.ai.model.text.openai',
      'features.ai.model.text.gemini',
      'features.ai.model.text.anthropic'
    ]);

    if (!normalizeFeatureFlag(settings['features.ai.enabled'], false)) {
      return json({ error: 'AI tools are disabled' }, 403);
    }

    if (!normalizeFeatureFlag(settings['features.ai.enableSeo'], true)) {
      return json({ error: 'SEO generation is disabled' }, 403);
    }

    const usageCapBlocked = await enforceUsageCap('seo', 'text', user.id);
    if (usageCapBlocked) {
      return usageCapBlocked;
    }

    const configuredProviders = getConfiguredProviders();
    const providerResult = resolveProvider<AiProviderKey>(
      'text',
      configuredProviders,
      payload.provider,
      settings['features.ai.defaultProvider.text']
    );
    if (providerResult.response) {
      return providerResult.response;
    }
    const provider = providerResult.provider as AiProviderKey;

    const modelResult = resolveModel(
      'text',
      provider,
      payload.model,
      provider === 'gemini'
        ? settings['features.ai.model.text.gemini']
        : provider === 'anthropic'
          ? settings['features.ai.model.text.anthropic']
          : settings['features.ai.model.text.openai']
    );
    if (modelResult.response) {
      return modelResult.response;
    }
    const model = modelResult.model;

    const seoMetadata = await generateSeoMetadata({
      title: payload.title,
      excerpt: payload.excerpt,
      content: payload.content,
      tags: payload.tags,
      provider,
      model
    });

    await recordUsageEvent({
      capability: 'text',
      operation: 'seo',
      provider,
      model,
      authUserId: user.id,
      authorId: user.authorId,
      metadata: {
        hasExcerpt: Boolean(payload.excerpt),
        contentLength: payload.content.length,
        tagCount: payload.tags.length
      }
    });

    return json({ seoMetadata, provider });
  } catch (error) {
    return handleAiError(error, 'AI SEO generation', 'Failed to generate SEO metadata');
  }
};

const imageHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    const user = await requireAuthor(request);
    const rateLimited = applyAiRateLimit(request, 'image', user.id, 8, 10 * 60 * 1000);
    if (rateLimited) {
      return rateLimited;
    }

    const parsedPayload = await parsePayload(request, imagePayloadSchema);
    if ('response' in parsedPayload) {
      return parsedPayload.response;
    }
    const payload = parsedPayload.data;

    const settings = await settingsService.getSettings([
      'features.ai.enabled',
      'features.ai.enableImages',
      'features.ai.defaultProvider.image',
      'features.ai.imageSize',
      'features.ai.imageAspectRatio',
      'features.ai.imageResolution',
      'features.ai.model.image.openai',
      'features.ai.model.image.gemini'
    ]);

    if (!normalizeFeatureFlag(settings['features.ai.enabled'], false)) {
      return json({ error: 'AI tools are disabled' }, 403);
    }

    if (!normalizeFeatureFlag(settings['features.ai.enableImages'], true)) {
      return json({ error: 'Image generation is disabled' }, 403);
    }

    const usageCapBlocked = await enforceUsageCap('image', 'image', user.id);
    if (usageCapBlocked) {
      return usageCapBlocked;
    }

    const configuredImageProviders = getConfiguredImageProviders();
    const providerResult = resolveProvider<AiImageProviderKey>(
      'image',
      configuredImageProviders,
      payload.provider,
      settings['features.ai.defaultProvider.image']
    );
    if (providerResult.response) {
      return providerResult.response;
    }
    const provider = providerResult.provider as AiImageProviderKey;

    const modelResult = resolveModel(
      'image',
      provider,
      payload.model,
      provider === 'gemini'
        ? settings['features.ai.model.image.gemini']
        : settings['features.ai.model.image.openai']
    );
    if (modelResult.response) {
      return modelResult.response;
    }
    const model = modelResult.model;

    const normalizedSizeCandidate = normalizeOpenAiSize(payload.size || settings['features.ai.imageSize']);
    const normalizedSize = ALLOWED_IMAGE_SIZES.includes((normalizedSizeCandidate || '') as typeof ALLOWED_IMAGE_SIZES[number])
      ? normalizedSizeCandidate
      : '1024x1024';
    const aspectRatioCandidate = payload.aspectRatio || settings['features.ai.imageAspectRatio'];
    const normalizedAspectRatio = ALLOWED_ASPECT_RATIOS.includes((aspectRatioCandidate || '') as typeof ALLOWED_ASPECT_RATIOS[number])
      ? aspectRatioCandidate
      : '1:1';
    const resolutionCandidate = payload.resolution || settings['features.ai.imageResolution'];
    const normalizedResolution = ALLOWED_IMAGE_RESOLUTIONS.includes((resolutionCandidate || '') as typeof ALLOWED_IMAGE_RESOLUTIONS[number])
      ? resolutionCandidate
      : '1K';

    const prompt = payload.prompt || buildImagePrompt(payload.title || '', payload.excerpt, payload.tags, payload.style);
    const image = await generateImage({
      prompt,
      provider,
      model,
      size: normalizedSize,
      resolution: normalizedResolution,
      aspectRatio: normalizedAspectRatio
    });

    const slugBase = (payload.title || payload.prompt || 'image').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const filename = `ai-${slugBase || 'image'}.png`;
    const file = new File([image.data], filename, { type: image.mimeType });
    const altText = payload.title
      ? `AI-generated image for "${payload.title}"`
      : 'AI-generated image';

    const result = await mediaManager.uploadMedia({
      file,
      altText,
      caption: payload.style ? `Generated in ${payload.style} style.` : undefined,
      uploadedBy: user.authorId
    });

    await recordUsageEvent({
      capability: 'image',
      operation: 'image',
      provider: image.provider,
      model: image.model,
      authUserId: user.id,
      authorId: user.authorId,
      metadata: {
        size: normalizedSize,
        aspectRatio: normalizedAspectRatio,
        resolution: normalizedResolution
      }
    });

    return json({
      media: result.public ?? result.original,
      provider: image.provider,
      model: image.model,
      prompt
    });
  } catch (error) {
    return handleAiError(error, 'AI image generation', 'Failed to generate image');
  }
};

const audioHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    const user = await requireAuthor(request);
    const rateLimited = applyAiRateLimit(request, 'audio', user.id, 6, 10 * 60 * 1000);
    if (rateLimited) {
      return rateLimited;
    }

    const parsedPayload = await parsePayload(request, audioPayloadSchema);
    if ('response' in parsedPayload) {
      return parsedPayload.response;
    }
    const payload = parsedPayload.data;

    const settings = await settingsService.getSettings([
      'features.ai.enabled',
      'features.ai.enableAudio',
      'features.ai.defaultProvider.audio',
      'features.ai.model.audio.openai',
      'features.ai.model.audio.elevenlabs',
      'features.ai.voice.openai',
      'features.ai.voice.elevenlabs'
    ]);

    if (!normalizeFeatureFlag(settings['features.ai.enabled'], false)) {
      return json({ error: 'AI tools are disabled' }, 403);
    }

    if (!normalizeFeatureFlag(settings['features.ai.enableAudio'], true)) {
      return json({ error: 'Audio generation is disabled' }, 403);
    }

    const usageCapBlocked = await enforceUsageCap('audio', 'audio', user.id);
    if (usageCapBlocked) {
      return usageCapBlocked;
    }

    const configuredAudioProviders = getConfiguredAudioProviders();
    const providerResult = resolveProvider<AiAudioProviderKey>(
      'audio',
      configuredAudioProviders,
      payload.provider,
      settings['features.ai.defaultProvider.audio']
    );
    if (providerResult.response) {
      return providerResult.response;
    }
    const provider = providerResult.provider as AiAudioProviderKey;

    const modelResult = resolveModel(
      'audio',
      provider,
      payload.model,
      provider === 'elevenlabs'
        ? settings['features.ai.model.audio.elevenlabs']
        : settings['features.ai.model.audio.openai']
    );
    if (modelResult.response) {
      return modelResult.response;
    }
    const model = modelResult.model;

    const voice = typeof payload.voice === 'string' && payload.voice.trim().length > 0
      ? payload.voice.trim()
      : provider === 'elevenlabs'
        ? settings['features.ai.voice.elevenlabs']
        : settings['features.ai.voice.openai'];
    const speed = payload.speed;

    const plainText = stripHtml(payload.content);
    const trimmed = plainText.slice(0, 4000);
    if (!trimmed) {
      return json({ error: 'Content is required' }, 400);
    }

    const audio = await generateAudio({
      text: trimmed,
      provider,
      voice,
      model,
      speed
    });

    const filename = `ai-${Date.now()}-${payload.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.mp3`;
    const file = new File([audio.data], filename, { type: audio.mimeType });

    const result = await mediaManager.uploadMedia({
      file,
      altText: `Audio narration for "${payload.title}"`,
      caption: 'AI-generated narration',
      uploadedBy: user.authorId
    });

    await recordUsageEvent({
      capability: 'audio',
      operation: 'audio',
      provider: audio.provider,
      model: audio.model,
      authUserId: user.id,
      authorId: user.authorId,
      metadata: {
        voice: audio.voice ?? voice,
        textLength: trimmed.length
      }
    });

    return json({
      media: result.public ?? result.original,
      provider: audio.provider,
      model: audio.model,
      voice: audio.voice
    });
  } catch (error) {
    return handleAiError(error, 'AI audio generation', 'Failed to generate audio');
  }
};

const statusHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    await requireAuthor(request);

    const settings = await settingsService.getSettings(['features.ai.enabled']);

    return json({
      aiEnabled: normalizeFeatureFlag(settings['features.ai.enabled'], false),
      textProviders: getConfiguredProviders(),
      imageProviders: getConfiguredImageProviders(),
      audioProviders: getConfiguredAudioProviders(),
      capabilityProviders: {
        text: getConfiguredProvidersByCapability('text'),
        image: getConfiguredProvidersByCapability('image'),
        audio: getConfiguredProvidersByCapability('audio'),
        video: getConfiguredProvidersByCapability('video')
      }
    });
  } catch (error) {
    return handleAiError(error, 'AI status', 'Unable to load AI status');
  }
};

const modelsHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    await requireAuthor(request);
    const url = new URL(request.url);
    const shouldSync = ['1', 'true', 'yes'].includes((url.searchParams.get('sync') || '').toLowerCase());
    const forceRefresh = ['1', 'true', 'yes'].includes((url.searchParams.get('force') || '').toLowerCase());

    const settings = await settingsService.getSettings([
      'features.ai.model.text.openai',
      'features.ai.model.text.gemini',
      'features.ai.model.text.anthropic',
      'features.ai.model.image.openai',
      'features.ai.model.image.gemini',
      'features.ai.model.audio.openai',
      'features.ai.model.audio.elevenlabs',
      'features.ai.voice.openai',
      'features.ai.voice.elevenlabs'
    ]);

    const discovery = shouldSync ? await discoverAllProviderModels({ forceRefresh }) : undefined;
    const providers = getProviderCatalog().map((entry) => ({
      ...entry,
      configured: isProviderConfigured(entry.id),
      discoveredModels: discovery?.[entry.id]
    }));

    return json({
      registry: AI_MODEL_REGISTRY,
      providers,
      active: {
        openai: {
          text: settings['features.ai.model.text.openai'],
          image: settings['features.ai.model.image.openai'],
          audio: settings['features.ai.model.audio.openai'],
          voice: settings['features.ai.voice.openai']
        },
        gemini: {
          text: settings['features.ai.model.text.gemini'],
          image: settings['features.ai.model.image.gemini']
        },
        anthropic: {
          text: settings['features.ai.model.text.anthropic']
        },
        elevenlabs: {
          audio: settings['features.ai.model.audio.elevenlabs'],
          voice: settings['features.ai.voice.elevenlabs']
        }
      }
    });
  } catch (error) {
    return handleAiError(error, 'AI models', 'Unable to load AI models');
  }
};

const catalogHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    await requireAuthor(request);
    const url = new URL(request.url);
    const shouldSync = ['1', 'true', 'yes'].includes((url.searchParams.get('sync') || '').toLowerCase());
    const forceRefresh = ['1', 'true', 'yes'].includes((url.searchParams.get('force') || '').toLowerCase());

    const discoveredModels = shouldSync ? await discoverAllProviderModels({ forceRefresh }) : undefined;
    const providers = getProviderCatalog().map((provider) => ({
      ...provider,
      configured: isProviderConfigured(provider.id),
      discoveredModels: discoveredModels?.[provider.id]
    }));

    return json({
      providers,
      capabilityProviders: {
        text: getConfiguredProvidersByCapability('text'),
        image: getConfiguredProvidersByCapability('image'),
        audio: getConfiguredProvidersByCapability('audio'),
        video: getConfiguredProvidersByCapability('video')
      },
      configuredEnvKeys: providers.filter((provider) => provider.configured).map((provider) => AI_PROVIDER_CATALOG[provider.id].envKey)
    });
  } catch (error) {
    return handleAiError(error, 'AI provider catalog', 'Unable to load AI provider catalog');
  }
};

const usageHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    await requireAuthor(request);
    const url = new URL(request.url);
    const days = Number.parseInt(url.searchParams.get('days') || '30', 10);

    const caps = await settingsService.getSettings([
      'features.ai.usageCaps.enabled',
      'features.ai.usageCaps.seoDailyRequests',
      'features.ai.usageCaps.imageDailyRequests',
      'features.ai.usageCaps.audioDailyRequests'
    ]);

    const summary = await getUsageSummary(days);

    return json({
      summary,
      caps: {
        enabled: normalizeFeatureFlag(caps['features.ai.usageCaps.enabled'], false),
        seoDailyRequests: caps['features.ai.usageCaps.seoDailyRequests'],
        imageDailyRequests: caps['features.ai.usageCaps.imageDailyRequests'],
        audioDailyRequests: caps['features.ai.usageCaps.audioDailyRequests']
      }
    });
  } catch (error) {
    return handleAiError(error, 'AI usage reporting', 'Unable to load AI usage report');
  }
};

export const AI_FEATURE_API: FeatureApiModule = {
  handlers: {
    seo: seoHandler,
    image: imageHandler,
    audio: audioHandler,
    status: statusHandler,
    models: modelsHandler,
    catalog: catalogHandler,
    usage: usageHandler
  }
};
