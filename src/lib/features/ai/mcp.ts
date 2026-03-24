import * as z from 'zod/v4';

import { PostRepository } from '@/lib/database/repositories/post-repository';
import { mediaManager } from '@/lib/services/media-manager';

import { generateImage } from './lib/image.js';
import { generateAudio } from './lib/audio.js';
import { aiConfigService } from './lib/config-service.js';
import { checkUsageCap, recordUsageEvent } from './lib/usage.js';
import type { AiProviderId } from './lib/types.js';
import type { FeatureMcpExtension } from '../types.js';

const postRepo = new PostRepository(true);

const ALLOWED_IMAGE_SIZES = ['1024x1024', '1792x1024', '1024x1792'] as const;
const ALLOWED_IMAGE_SIZES_WITH_LEGACY = [...ALLOWED_IMAGE_SIZES, '1536x1024', '1024x1536'] as const;
const ALLOWED_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const;
const ALLOWED_IMAGE_RESOLUTIONS = ['1K', '2K', '4K'] as const;
const AI_PROVIDER_IDS = ['gateway', 'openai', 'gemini', 'anthropic', 'elevenlabs'] as const;

const imageToolArgsSchema = z.object({
  postId: z.string().uuid(),
  prompt: z.string().trim().min(1).max(1200).optional(),
  style: z.string().trim().max(120).optional(),
  provider: z.enum(AI_PROVIDER_IDS).optional(),
  model: z.string().trim().min(1).max(160).optional(),
  size: z.enum(ALLOWED_IMAGE_SIZES_WITH_LEGACY).optional(),
  aspectRatio: z.enum(ALLOWED_ASPECT_RATIOS).optional(),
  resolution: z.enum(ALLOWED_IMAGE_RESOLUTIONS).optional(),
  attachAsFeatured: z.boolean().optional()
}).strict();

const audioToolArgsSchema = z.object({
  postId: z.string().uuid(),
  provider: z.enum(AI_PROVIDER_IDS).optional(),
  model: z.string().trim().min(1).max(160).optional(),
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

const parseArgs = <T>(schema: z.ZodSchema<T>, args: Record<string, unknown>): T => {
  const parsed = schema.safeParse(args);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(issue?.message || 'Invalid tool arguments');
  }
  return parsed.data;
};

const asProvider = (value: unknown): AiProviderId | undefined => {
  if (value === 'gateway' || value === 'openai' || value === 'gemini' || value === 'anthropic' || value === 'elevenlabs') {
    return value;
  }
  return undefined;
};

const generatePostImage = async (args: Record<string, unknown>) => {
  const input = parseArgs(imageToolArgsSchema, args);
  const post = await postRepo.findByIdWithRelations(input.postId);
  if (!post) {
    throw new Error(`Post not found: ${input.postId}`);
  }

  const config = await aiConfigService.assertFeatureEnabled('image');
  const selection = await aiConfigService.resolveCapabilitySelection(
    config,
    'image',
    asProvider(input.provider),
    input.model
  );
  const usageCap = await checkUsageCap({
    operation: 'image',
    capability: 'image',
    authorId: post.author.id
  });
  if (!usageCap.allowed) {
    throw new Error(`Daily AI image request cap reached (${usageCap.used}/${usageCap.limit}).`);
  }

  const normalizedSizeCandidate = normalizeOpenAiSize(input.size || config.capabilities.image.defaultSize);
  const normalizedSize = ALLOWED_IMAGE_SIZES.includes((normalizedSizeCandidate || '') as typeof ALLOWED_IMAGE_SIZES[number])
    ? normalizedSizeCandidate
    : '1024x1024';
  const normalizedAspectRatio = input.aspectRatio || config.capabilities.image.defaultAspectRatio;
  const normalizedResolution = input.resolution || config.capabilities.image.defaultResolution;

  const prompt = input.prompt || buildImagePrompt(post, input.style);
  const image = await generateImage({
    prompt,
    provider: selection.provider,
    model: selection.model,
    size: normalizedSize,
    aspectRatio: normalizedAspectRatio as any,
    resolution: normalizedResolution as any
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

  const config = await aiConfigService.assertFeatureEnabled('audio');
  const selection = await aiConfigService.resolveCapabilitySelection(
    config,
    'audio',
    asProvider(input.provider),
    input.model,
    input.voice
  );
  const usageCap = await checkUsageCap({
    operation: 'audio',
    capability: 'audio',
    authorId: post.author.id
  });
  if (!usageCap.allowed) {
    throw new Error(`Daily AI audio request cap reached (${usageCap.used}/${usageCap.limit}).`);
  }

  const plainText = stripHtml(post.content).slice(0, 4000);
  if (!plainText) {
    throw new Error('Post content is empty after sanitization.');
  }

  const audio = await generateAudio({
    text: plainText,
    provider: selection.provider,
    model: selection.model,
    voice: selection.voice,
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
      voice: audio.voice ?? selection.voice
    }
  });

  return {
    postId: post.id,
    attachedAsAudio,
    media,
    provider: audio.provider,
    model: audio.model,
    voice: audio.voice ?? selection.voice
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
        provider: z.enum(AI_PROVIDER_IDS).optional(),
        model: z.string().trim().min(1).max(160).optional(),
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
        provider: z.enum(AI_PROVIDER_IDS).optional(),
        model: z.string().trim().min(1).max(160).optional(),
        voice: z.string().trim().min(1).max(120).optional(),
        speed: z.number().min(0.25).max(2).optional(),
        attachAsAudio: z.boolean().optional()
      },
      annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
      handler: generatePostAudio
    }
  ]
};
