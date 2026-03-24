import { requireAuthor } from '@/lib/auth/auth-helpers';
import { ValidationError } from '@/lib/database/connection';
import { normalizeFeatureFlag } from '@/lib/features/flags';
import { mediaManager } from '@/lib/services/media-manager';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { getClientIp } from '@/lib/security/request-guards';

import { generateSeoMetadata } from './lib/seo.js';
import { generateImage } from './lib/image.js';
import { generateAudio } from './lib/audio.js';
import { aiConfigService } from './lib/config-service.js';
import { AI_MODEL_REGISTRY } from './lib/model-registry.js';
import {
  AI_PROVIDER_CATALOG,
  discoverAllProviderModels,
  discoverProviderVoices,
  getConfiguredProvidersByCapability,
  getProviderCatalog,
  isProviderConfigured
} from './lib/provider-catalog.js';
import { checkUsageCap, getUsageSummary, recordUsageEvent } from './lib/usage.js';
import type { AiProviderId } from './lib/types.js';
import type { FeatureApiHandler, FeatureApiModule } from '../types.js';
import { z } from 'zod';

const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

const methodNotAllowed = () => json({ error: 'Method not allowed' }, 405);

const ALLOWED_IMAGE_SIZES = ['1024x1024', '1792x1024', '1024x1792'] as const;
const ALLOWED_IMAGE_SIZES_WITH_LEGACY = [...ALLOWED_IMAGE_SIZES, '1536x1024', '1024x1536'] as const;
const ALLOWED_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const;
const ALLOWED_IMAGE_RESOLUTIONS = ['1K', '2K', '4K'] as const;
const AI_PROVIDER_IDS = ['gateway', 'openai', 'gemini', 'anthropic', 'elevenlabs'] as const;

const seoPayloadSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(180, 'Title is too long'),
  excerpt: z.string().trim().max(2_000, 'Excerpt is too long').optional().default(''),
  content: z.string().max(120_000, 'Content is too long').optional().default(''),
  tags: z.array(z.string().trim().min(1).max(80)).max(20, 'Too many tags').optional().default([]),
  provider: z.enum(AI_PROVIDER_IDS).optional(),
  model: z.string().trim().min(1).max(160).optional()
}).strict();

const imagePayloadSchema = z.object({
  prompt: z.string().trim().min(1).max(1_200).optional(),
  title: z.string().trim().min(1).max(180).optional(),
  excerpt: z.string().trim().max(2_000).optional().default(''),
  tags: z.array(z.string().trim().min(1).max(80)).max(20).optional().default([]),
  style: z.string().trim().max(120).optional(),
  provider: z.enum(AI_PROVIDER_IDS).optional(),
  model: z.string().trim().min(1).max(160).optional(),
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
  provider: z.enum(AI_PROVIDER_IDS).optional(),
  voice: z.string().trim().min(1).max(120).optional(),
  model: z.string().trim().min(1).max(160).optional(),
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

const asProvider = (value: unknown): AiProviderId | undefined => {
  if (value === 'gateway' || value === 'openai' || value === 'gemini' || value === 'anthropic' || value === 'elevenlabs') {
    return value;
  }
  return undefined;
};

const getAiClientErrorStatus = (message: string): number | null => {
  const normalized = message.trim();

  if (
    normalized === 'AI tools are disabled' ||
    normalized === 'SEO generation is disabled' ||
    normalized === 'AI image generation is disabled' ||
    normalized === 'AI audio generation is disabled'
  ) {
    return 403;
  }

  if (
    /No AI (text|image|audio|video) providers are configured/i.test(normalized) ||
    /Provider ".*" is not configured for AI/i.test(normalized) ||
    /Model ".*" is not supported by provider/i.test(normalized) ||
    /(Gateway|OpenAI|Gemini|Anthropic|ElevenLabs) provider is not configured/i.test(normalized) ||
    /(text|image|audio) generation model is not configured/i.test(normalized) ||
    /ElevenLabs voice is not configured/i.test(normalized)
  ) {
    return 400;
  }

  return null;
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
  const clientStatus = sanitizedDetail ? getAiClientErrorStatus(sanitizedDetail) : null;

  if (clientStatus) {
    console.warn(`${operation} rejected: ${sanitizedDetail}`);
    return json({ error: sanitizedDetail || fallbackMessage }, clientStatus);
  }

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

    const config = await aiConfigService.assertFeatureEnabled('seo');
    const usageCapBlocked = await enforceUsageCap('seo', 'text', user.id);
    if (usageCapBlocked) {
      return usageCapBlocked;
    }

    const selection = await aiConfigService.resolveCapabilitySelection(
      config,
      'text',
      asProvider(payload.provider),
      payload.model
    );

    const seoMetadata = await generateSeoMetadata({
      title: payload.title,
      excerpt: payload.excerpt,
      content: payload.content,
      tags: payload.tags,
      provider: selection.provider,
      model: selection.model
    });

    await recordUsageEvent({
      capability: 'text',
      operation: 'seo',
      provider: selection.provider,
      model: selection.model,
      authUserId: user.id,
      authorId: user.authorId,
      metadata: {
        hasExcerpt: Boolean(payload.excerpt),
        tagCount: payload.tags.length
      }
    });

    return json({
      seoMetadata,
      provider: selection.provider,
      model: selection.model
    });
  } catch (error) {
    return handleAiError(error, 'AI SEO generation', 'Failed to generate SEO metadata');
  }
};

const imageHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    const user = await requireAuthor(request);
    const rateLimited = applyAiRateLimit(request, 'image', user.id, 10, 10 * 60 * 1000);
    if (rateLimited) {
      return rateLimited;
    }

    const parsedPayload = await parsePayload(request, imagePayloadSchema);
    if ('response' in parsedPayload) {
      return parsedPayload.response;
    }
    const payload = parsedPayload.data;

    const config = await aiConfigService.assertFeatureEnabled('image');
    const usageCapBlocked = await enforceUsageCap('image', 'image', user.id);
    if (usageCapBlocked) {
      return usageCapBlocked;
    }

    const selection = await aiConfigService.resolveCapabilitySelection(
      config,
      'image',
      asProvider(payload.provider),
      payload.model
    );

    const prompt = payload.prompt || buildImagePrompt(payload.title || 'Untitled', payload.excerpt, payload.tags, payload.style);
    const normalizedSizeCandidate = normalizeOpenAiSize(payload.size || config.capabilities.image.defaultSize);
    const normalizedSize = ALLOWED_IMAGE_SIZES.includes((normalizedSizeCandidate || '') as typeof ALLOWED_IMAGE_SIZES[number])
      ? normalizedSizeCandidate
      : '1024x1024';
    const normalizedAspectRatio = payload.aspectRatio || config.capabilities.image.defaultAspectRatio;
    const normalizedResolution = payload.resolution || config.capabilities.image.defaultResolution;

    const image = await generateImage({
      prompt,
      provider: selection.provider,
      model: selection.model,
      size: normalizedSize,
      aspectRatio: normalizedAspectRatio as any,
      resolution: normalizedResolution as any
    });

    const baseName = (payload.title || prompt).slice(0, 80).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const filename = `ai-${Date.now()}-${baseName || 'image'}.png`;
    const file = new File([image.data], filename, { type: image.mimeType });

    const result = await mediaManager.uploadMedia({
      file,
      altText: payload.title ? `AI-generated image for "${payload.title}"` : 'AI-generated image',
      caption: payload.style ? `Generated in ${payload.style} style.` : 'AI-generated image',
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
      model: image.model
    });
  } catch (error) {
    return handleAiError(error, 'AI image generation', 'Failed to generate image');
  }
};

const audioHandler: FeatureApiHandler = async ({ request }) => {
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    const user = await requireAuthor(request);
    const rateLimited = applyAiRateLimit(request, 'audio', user.id, 10, 10 * 60 * 1000);
    if (rateLimited) {
      return rateLimited;
    }

    const parsedPayload = await parsePayload(request, audioPayloadSchema);
    if ('response' in parsedPayload) {
      return parsedPayload.response;
    }
    const payload = parsedPayload.data;

    const config = await aiConfigService.assertFeatureEnabled('audio');
    const usageCapBlocked = await enforceUsageCap('audio', 'audio', user.id);
    if (usageCapBlocked) {
      return usageCapBlocked;
    }

    const selection = await aiConfigService.resolveCapabilitySelection(
      config,
      'audio',
      asProvider(payload.provider),
      payload.model,
      payload.voice
    );

    const plainText = stripHtml(payload.content);
    const trimmed = plainText.slice(0, 4000);
    if (!trimmed) {
      return json({ error: 'Content is required' }, 400);
    }

    const audio = await generateAudio({
      text: trimmed,
      provider: selection.provider,
      voice: selection.voice,
      model: selection.model,
      speed: payload.speed
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
        voice: audio.voice ?? selection.voice,
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
    const config = await aiConfigService.getRuntimeConfig();

    return json({
      aiEnabled: config.enabled,
      textProviders: getConfiguredProvidersByCapability('text'),
      imageProviders: getConfiguredProvidersByCapability('image'),
      audioProviders: getConfiguredProvidersByCapability('audio'),
      defaults: config.capabilities,
      tools: config.tools,
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
    const config = await aiConfigService.getRuntimeConfig();

    const discovery = shouldSync ? await discoverAllProviderModels({ forceRefresh }) : undefined;
    const elevenlabsVoices = shouldSync ? await discoverProviderVoices('elevenlabs', { forceRefresh }) : undefined;
    const providers = getProviderCatalog().map((entry) => ({
      ...entry,
      configured: isProviderConfigured(entry.id),
      discoveredModels: discovery?.[entry.id]
        ? {
            models: discovery[entry.id].models,
            source: discovery[entry.id].source,
            error: discovery[entry.id].error,
            updatedAt: discovery[entry.id].updatedAt
          }
        : undefined,
      discoveredVoices: entry.id === 'elevenlabs' && elevenlabsVoices
        ? {
            voices: elevenlabsVoices.voices,
            source: elevenlabsVoices.source,
            error: elevenlabsVoices.error,
            updatedAt: elevenlabsVoices.updatedAt
          }
        : undefined
    }));

    return json({
      registry: AI_MODEL_REGISTRY,
      providers,
      active: config.capabilities
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
    const config = await aiConfigService.getRuntimeConfig();

    const discoveredModels = shouldSync ? await discoverAllProviderModels({ forceRefresh }) : undefined;
    const elevenlabsVoices = shouldSync ? await discoverProviderVoices('elevenlabs', { forceRefresh }) : undefined;

    const providers = getProviderCatalog().map((provider) => ({
      ...provider,
      configured: isProviderConfigured(provider.id),
      discoveredModels: discoveredModels?.[provider.id]
        ? {
            models: discoveredModels[provider.id].models,
            source: discoveredModels[provider.id].source,
            error: discoveredModels[provider.id].error,
            updatedAt: discoveredModels[provider.id].updatedAt
          }
        : undefined,
      discoveredVoices: provider.id === 'elevenlabs' && elevenlabsVoices
        ? {
            voices: elevenlabsVoices.voices,
            source: elevenlabsVoices.source,
            error: elevenlabsVoices.error,
            updatedAt: elevenlabsVoices.updatedAt
          }
        : undefined
    }));

    return json({
      providers,
      defaults: config.capabilities,
      tools: config.tools,
      capabilityProviders: {
        text: getConfiguredProvidersByCapability('text'),
        image: getConfiguredProvidersByCapability('image'),
        audio: getConfiguredProvidersByCapability('audio'),
        video: getConfiguredProvidersByCapability('video')
      },
      configuredEnvKeys: providers
        .filter((provider) => provider.configured)
        .map((provider) => AI_PROVIDER_CATALOG[provider.id].envKey)
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
    const config = await aiConfigService.getRuntimeConfig();
    const summary = await getUsageSummary(days);

    return json({
      summary,
      caps: {
        enabled: normalizeFeatureFlag(config.limits.enabled, false),
        seoDailyRequests: config.limits.seoDailyRequests,
        imageDailyRequests: config.limits.imageDailyRequests,
        audioDailyRequests: config.limits.audioDailyRequests
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
