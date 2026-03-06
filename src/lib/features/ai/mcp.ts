import * as z from 'zod/v4';

import { SettingsService } from '@/lib/services/settings-service';
import { PostRepository } from '@/lib/database/repositories/post-repository';
import { mediaManager } from '@/lib/services/media-manager';
import { normalizeFeatureFlag } from '@/lib/features/flags';

import { generateImage, getConfiguredImageProviders } from './lib/image.js';
import { generateAudio, getConfiguredAudioProviders } from './lib/audio.js';
import { recordUsageEvent } from './lib/usage.js';
import type { AiAudioProviderKey, AiImageProviderKey } from './lib/types.js';
import type { FeatureMcpExtension } from '../types.js';

const settingsService = new SettingsService();
const postRepo = new PostRepository(true);

const ALLOWED_IMAGE_SIZES = ['1024x1024', '1792x1024', '1024x1792'] as const;
const ALLOWED_IMAGE_SIZES_WITH_LEGACY = [...ALLOWED_IMAGE_SIZES, '1536x1024', '1024x1536'] as const;
const ALLOWED_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const;
const ALLOWED_IMAGE_RESOLUTIONS = ['1K', '2K', '4K'] as const;

const imageToolArgsSchema = z.object({
  postId: z.string().uuid(),
  prompt: z.string().trim().min(1).max(1200).optional(),
  style: z.string().trim().max(120).optional(),
  provider: z.enum(['openai', 'gemini']).optional(),
  model: z.string().trim().min(1).max(120).optional(),
  size: z.enum(ALLOWED_IMAGE_SIZES_WITH_LEGACY).optional(),
  aspectRatio: z.enum(ALLOWED_ASPECT_RATIOS).optional(),
  resolution: z.enum(ALLOWED_IMAGE_RESOLUTIONS).optional(),
  attachAsFeatured: z.boolean().optional()
}).strict();

const audioToolArgsSchema = z.object({
  postId: z.string().uuid(),
  provider: z.enum(['openai', 'elevenlabs']).optional(),
  model: z.string().trim().min(1).max(120).optional(),
  voice: z.string().trim().min(1).max(120).optional(),
  speed: z.number().min(0.25).max(2).optional(),
  attachAsAudio: z.boolean().optional()
}).strict();

const normalizeOpenAiSize = (value: string | undefined) => {
  if (value === '1536x1024') return '1792x1024';
  if (value === '1024x1536') return '1024x1792';
  return value;
};

const sanitizeFilenameSegment = (value: string, fallback: string) => {
  const normalized = value.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/(^-|-$)/g, '');
  return normalized || fallback;
};

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const buildImagePrompt = (post: { title: string; excerpt?: string; tags?: { name: string }[] }, style?: string) => {
  const tagLine = Array.isArray(post.tags) && post.tags.length > 0
    ? `Tags: ${post.tags.map((tag) => tag.name).filter(Boolean).slice(0, 8).join(', ')}`
    : '';
  const styleLine = style
    ? `Style: ${style}`
    : 'Style: modern editorial hero image, clean lighting, minimal clutter.';

  return [
    'Create a high-quality hero image for a blog post.',
    `Title: ${post.title}`,
    post.excerpt ? `Excerpt: ${post.excerpt}` : '',
    tagLine,
    styleLine
  ]
    .filter(Boolean)
    .join('\n');
};

const resolveImageProvider = (
  configuredProviders: AiImageProviderKey[],
  requestedProvider: AiImageProviderKey | undefined,
  defaultProvider: unknown
): AiImageProviderKey => {
  if (configuredProviders.length === 0) {
    throw new Error('No AI image providers are configured. Add an image provider API key first.');
  }

  if (requestedProvider) {
    if (!configuredProviders.includes(requestedProvider)) {
      throw new Error(`Provider "${requestedProvider}" is not configured for AI image generation.`);
    }
    return requestedProvider;
  }

  const fallback = typeof defaultProvider === 'string' ? defaultProvider as AiImageProviderKey : undefined;
  if (fallback && configuredProviders.includes(fallback)) {
    return fallback;
  }

  return configuredProviders[0];
};

const resolveAudioProvider = (
  configuredProviders: AiAudioProviderKey[],
  requestedProvider: AiAudioProviderKey | undefined,
  defaultProvider: unknown
): AiAudioProviderKey => {
  if (configuredProviders.length === 0) {
    throw new Error('No AI audio providers are configured. Add an audio provider API key first.');
  }

  if (requestedProvider) {
    if (!configuredProviders.includes(requestedProvider)) {
      throw new Error(`Provider "${requestedProvider}" is not configured for AI audio generation.`);
    }
    return requestedProvider;
  }

  const fallback = typeof defaultProvider === 'string' ? defaultProvider as AiAudioProviderKey : undefined;
  if (fallback && configuredProviders.includes(fallback)) {
    return fallback;
  }

  return configuredProviders[0];
};

const resolveModel = (
  requestedModel: string | undefined,
  defaultModel: unknown
): string | undefined => {
  if (requestedModel && requestedModel.trim()) {
    return requestedModel.trim();
  }
  if (typeof defaultModel === 'string' && defaultModel.trim()) {
    return defaultModel.trim();
  }
  return undefined;
};

const parseArgs = <T>(schema: z.ZodSchema<T>, args: Record<string, unknown>): T => {
  const parsed = schema.safeParse(args);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(issue?.message || 'Invalid tool arguments');
  }
  return parsed.data;
};

const generatePostImage = async (args: Record<string, unknown>) => {
  const input = parseArgs(imageToolArgsSchema, args);
  const post = await postRepo.findByIdWithRelations(input.postId);
  if (!post) {
    throw new Error(`Post not found: ${input.postId}`);
  }

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
    throw new Error('AI tools are disabled.');
  }
  if (!normalizeFeatureFlag(settings['features.ai.enableImages'], true)) {
    throw new Error('AI image generation is disabled.');
  }

  const provider = resolveImageProvider(
    getConfiguredImageProviders(),
    input.provider,
    settings['features.ai.defaultProvider.image']
  );

  const model = resolveModel(
    input.model,
    provider === 'gemini'
      ? settings['features.ai.model.image.gemini']
      : settings['features.ai.model.image.openai']
  );

  const normalizedSizeCandidate = normalizeOpenAiSize(input.size || String(settings['features.ai.imageSize'] || ''));
  const normalizedSize = ALLOWED_IMAGE_SIZES.includes((normalizedSizeCandidate || '') as typeof ALLOWED_IMAGE_SIZES[number])
    ? normalizedSizeCandidate
    : '1024x1024';
  const aspectRatioCandidate = input.aspectRatio || String(settings['features.ai.imageAspectRatio'] || '');
  const normalizedAspectRatio = ALLOWED_ASPECT_RATIOS.includes((aspectRatioCandidate || '') as typeof ALLOWED_ASPECT_RATIOS[number])
    ? aspectRatioCandidate
    : '1:1';
  const resolutionCandidate = input.resolution || String(settings['features.ai.imageResolution'] || '');
  const normalizedResolution = ALLOWED_IMAGE_RESOLUTIONS.includes((resolutionCandidate || '') as typeof ALLOWED_IMAGE_RESOLUTIONS[number])
    ? resolutionCandidate
    : '1K';

  const prompt = input.prompt || buildImagePrompt(post, input.style);
  const image = await generateImage({
    prompt,
    provider,
    model,
    size: normalizedSize,
    aspectRatio: normalizedAspectRatio,
    resolution: normalizedResolution
  });

  const filename = `ai-${sanitizeFilenameSegment(post.slug || post.title, 'post')}-${Date.now()}.png`;
  const file = new File([image.data], filename, { type: image.mimeType });

  const uploaded = await mediaManager.uploadMedia({
    file,
    altText: `AI-generated image for "${post.title}"`,
    caption: input.style ? `Generated in ${input.style} style.` : undefined,
    uploadedBy: post.author.id
  });

  const media = uploaded.public ?? uploaded.original;
  const attachAsFeatured = input.attachAsFeatured ?? true;
  if (attachAsFeatured && media?.id) {
    await postRepo.update(post.id, { featuredImageId: media.id });
  }

  await recordUsageEvent({
    capability: 'image',
    operation: 'image',
    provider: image.provider,
    model: image.model,
    authorId: post.author.id,
    metadata: {
      source: 'mcp',
      postId: post.id,
      size: normalizedSize,
      aspectRatio: normalizedAspectRatio,
      resolution: normalizedResolution
    }
  });

  return {
    postId: post.id,
    attachedAsFeatured: attachAsFeatured,
    media,
    provider: image.provider,
    model: image.model,
    prompt
  };
};

const generatePostAudio = async (args: Record<string, unknown>) => {
  const input = parseArgs(audioToolArgsSchema, args);
  const post = await postRepo.findByIdWithRelations(input.postId);
  if (!post) {
    throw new Error(`Post not found: ${input.postId}`);
  }

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
    throw new Error('AI tools are disabled.');
  }
  if (!normalizeFeatureFlag(settings['features.ai.enableAudio'], true)) {
    throw new Error('AI audio generation is disabled.');
  }

  const provider = resolveAudioProvider(
    getConfiguredAudioProviders(),
    input.provider,
    settings['features.ai.defaultProvider.audio']
  );

  const model = resolveModel(
    input.model,
    provider === 'elevenlabs'
      ? settings['features.ai.model.audio.elevenlabs']
      : settings['features.ai.model.audio.openai']
  );

  const voice = input.voice || (
    provider === 'elevenlabs'
      ? String(settings['features.ai.voice.elevenlabs'] || '')
      : String(settings['features.ai.voice.openai'] || '')
  );

  const plainText = stripHtml(post.content).slice(0, 4000);
  if (!plainText) {
    throw new Error('Post content is empty after sanitization.');
  }

  const audio = await generateAudio({
    text: plainText,
    provider,
    model,
    voice,
    speed: input.speed
  });

  const filename = `ai-${sanitizeFilenameSegment(post.slug || post.title, 'post')}-${Date.now()}.mp3`;
  const file = new File([audio.data], filename, { type: audio.mimeType });

  const uploaded = await mediaManager.uploadMedia({
    file,
    altText: `AI-generated audio narration for "${post.title}"`,
    caption: 'AI-generated narration',
    uploadedBy: post.author.id
  });

  const media = uploaded.public ?? uploaded.original;
  const attachAsAudio = input.attachAsAudio ?? true;
  if (attachAsAudio && media?.id) {
    await postRepo.update(post.id, { audioAssetId: media.id });
  }

  await recordUsageEvent({
    capability: 'audio',
    operation: 'audio',
    provider: audio.provider,
    model: audio.model,
    authorId: post.author.id,
    metadata: {
      source: 'mcp',
      postId: post.id,
      textLength: plainText.length,
      voice: audio.voice ?? voice
    }
  });

  return {
    postId: post.id,
    attachedAsAudio,
    media,
    provider: audio.provider,
    model: audio.model,
    voice: audio.voice ?? voice
  };
};

export const AI_FEATURE_MCP_EXTENSION: FeatureMcpExtension = {
  getTools: () => [
    {
      name: 'ai_post_image_generate',
      title: 'Generate Post Image',
      description: 'Generate an AI image for a post and optionally set it as featured image.',
      inputSchema: {
        postId: z.string().uuid(),
        prompt: z.string().trim().min(1).max(1200).optional(),
        style: z.string().trim().max(120).optional(),
        provider: z.enum(['openai', 'gemini']).optional(),
        model: z.string().trim().min(1).max(120).optional(),
        size: z.enum(ALLOWED_IMAGE_SIZES_WITH_LEGACY).optional(),
        aspectRatio: z.enum(ALLOWED_ASPECT_RATIOS).optional(),
        resolution: z.enum(ALLOWED_IMAGE_RESOLUTIONS).optional(),
        attachAsFeatured: z.boolean().optional()
      },
      annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
      handler: generatePostImage
    },
    {
      name: 'ai_post_audio_generate',
      title: 'Generate Post Audio',
      description: 'Generate AI narration for a post and optionally set it as the post audio asset.',
      inputSchema: {
        postId: z.string().uuid(),
        provider: z.enum(['openai', 'elevenlabs']).optional(),
        model: z.string().trim().min(1).max(120).optional(),
        voice: z.string().trim().min(1).max(120).optional(),
        speed: z.number().min(0.25).max(2).optional(),
        attachAsAudio: z.boolean().optional()
      },
      annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
      handler: generatePostAudio
    }
  ]
};
