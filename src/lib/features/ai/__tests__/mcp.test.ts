import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findByIdWithRelations: vi.fn(),
  updatePost: vi.fn(),
  uploadMedia: vi.fn(),
  generateImage: vi.fn(),
  generateAudio: vi.fn(),
  assertFeatureEnabled: vi.fn(),
  resolveCapabilitySelection: vi.fn(),
  checkUsageCap: vi.fn(),
  recordUsageEvent: vi.fn()
}));

vi.mock('@/lib/database/repositories/post-repository', () => ({
  PostRepository: vi.fn(() => ({
    findByIdWithRelations: mocks.findByIdWithRelations,
    update: mocks.updatePost
  }))
}));

vi.mock('@/lib/services/media-manager', () => ({
  mediaManager: {
    uploadMedia: mocks.uploadMedia
  }
}));

vi.mock('../lib/image.js', () => ({
  generateImage: mocks.generateImage
}));

vi.mock('../lib/audio.js', () => ({
  generateAudio: mocks.generateAudio
}));

vi.mock('../lib/config-service.js', () => ({
  aiConfigService: {
    assertFeatureEnabled: mocks.assertFeatureEnabled,
    resolveCapabilitySelection: mocks.resolveCapabilitySelection
  }
}));

vi.mock('../lib/usage.js', () => ({
  checkUsageCap: mocks.checkUsageCap,
  recordUsageEvent: mocks.recordUsageEvent
}));

import { AI_FEATURE_MCP_EXTENSION } from '../mcp.js';

const POST_ID = '11111111-1111-4111-8111-111111111111';

const getTool = async (name: string) => {
  const tools = await AI_FEATURE_MCP_EXTENSION.getTools();
  const tool = tools.find((entry) => entry.name === name);
  expect(tool).toBeTruthy();
  return tool!;
};

describe('AI feature MCP tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.findByIdWithRelations.mockResolvedValue({
      id: POST_ID,
      slug: 'test-post',
      title: 'Test Post',
      excerpt: 'Excerpt',
      content: '<p>Post content</p>',
      tags: [{ name: 'AI' }],
      author: { id: 'author-1' }
    });
    mocks.assertFeatureEnabled.mockResolvedValue({
      capabilities: {
        image: { defaultSize: '1024x1024', defaultAspectRatio: '1:1', defaultResolution: '1K' },
        audio: { defaultVoice: 'alloy' }
      }
    });
    mocks.resolveCapabilitySelection.mockResolvedValue({
      provider: 'openai',
      model: 'gpt-image-1',
      voice: 'alloy'
    });
    mocks.checkUsageCap.mockResolvedValue({ allowed: true });
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
    mocks.uploadMedia.mockResolvedValue({
      public: { id: 'asset-1', url: 'https://example.com/asset.png' },
      original: null
    });
    mocks.updatePost.mockResolvedValue(undefined);
    mocks.recordUsageEvent.mockResolvedValue(undefined);
  });

  it('enforces image usage caps with author-based accounting', async () => {
    mocks.checkUsageCap.mockResolvedValueOnce({ allowed: false, limit: 1, used: 1 });

    const tool = await getTool('ai_post_image_generate');

    await expect(tool.handler({ postId: POST_ID })).rejects.toThrow(/cap reached/i);
    expect(mocks.checkUsageCap).toHaveBeenCalledWith({
      operation: 'image',
      capability: 'image',
      authorId: 'author-1'
    });
    expect(mocks.generateImage).not.toHaveBeenCalled();
  });

  it('enforces audio usage caps with author-based accounting', async () => {
    mocks.checkUsageCap.mockResolvedValueOnce({ allowed: false, limit: 2, used: 2 });

    const tool = await getTool('ai_post_audio_generate');

    await expect(tool.handler({ postId: POST_ID })).rejects.toThrow(/cap reached/i);
    expect(mocks.checkUsageCap).toHaveBeenCalledWith({
      operation: 'audio',
      capability: 'audio',
      authorId: 'author-1'
    });
    expect(mocks.generateAudio).not.toHaveBeenCalled();
  });

  it('records successful image generation after caps pass', async () => {
    const tool = await getTool('ai_post_image_generate');

    const result = await tool.handler({ postId: POST_ID, attachAsFeatured: true });
    expect(result).toMatchObject({
      postId: POST_ID,
      attachedAsFeatured: true,
      provider: 'openai',
      model: 'gpt-image-1'
    });
    expect(mocks.recordUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      capability: 'image',
      operation: 'image',
      authorId: 'author-1'
    }));
  });
});
