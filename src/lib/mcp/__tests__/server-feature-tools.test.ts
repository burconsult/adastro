import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createAdAstroMcpServer, type AdAstroMcpToolDeps } from '../server';

function createMockDeps(): AdAstroMcpToolDeps {
  return {
    getStatus: vi.fn(async () => ({ app: 'AdAstro', setupCompleted: true })),
    listAuthors: vi.fn(async () => ({ items: [] })),
    listCategories: vi.fn(async () => ({ items: [] })),
    listTags: vi.fn(async () => ({ items: [] })),
    listMedia: vi.fn(async () => ({ assets: [], total: 0 })),
    getMedia: vi.fn(async (id: string) => ({ id })),
    listPosts: vi.fn(async () => ({ items: [], total: 0 })),
    getPost: vi.fn(async (input) => ({ id: input.id ?? 'post-1', slug: input.slug ?? 'post-1' })),
    createPost: vi.fn(async (input) => ({ id: 'new-post', ...input })),
    updatePost: vi.fn(async (input) => ({ ...input })),
    publishPost: vi.fn(async (input) => ({ id: input.id, status: 'published' })),
    unpublishPost: vi.fn(async (input) => ({ id: input.id, status: 'draft' })),
    listPages: vi.fn(async () => ({ items: [], total: 0 })),
    getPage: vi.fn(async (input) => ({ id: input.id ?? 'page-1', slug: input.slug ?? 'page-1' })),
    createPage: vi.fn(async (input) => ({ id: 'new-page', ...input })),
    updatePage: vi.fn(async (input) => ({ ...input })),
    getSettings: vi.fn(async () => ({ 'site.title': 'AdAstro' })),
    updateSettings: vi.fn(async (input) => ({ updatedKeys: Object.keys(input.settings) })),
    getAnalyticsSummary: vi.fn(async ({ days }) => ({ windowDays: days, totalPageViews: 10 }))
  };
}

function parseToolText(result: any) {
  const textBlock = Array.isArray(result.content)
    ? result.content.find((block: any) => block.type === 'text')
    : null;
  expect(textBlock?.text).toBeTruthy();
  return JSON.parse(textBlock.text);
}

describe('AdAstro MCP feature tool registration', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers feature tools returned by the resolver', async () => {
    const deps = createMockDeps();

    const server = await createAdAstroMcpServer(deps, {
      resolveFeatureToolSets: async () => [
        {
          featureId: 'comments',
          tools: [
            {
              name: 'comments_queue_list',
              title: 'List Queue',
              description: 'List pending comments',
              handler: async () => ({ comments: [{ id: 'comment-1' }] })
            }
          ]
        }
      ]
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(clientTransport);

    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name);
    expect(names).toContain('comments_queue_list');

    const queueResult = await client.callTool({
      name: 'comments_queue_list',
      arguments: {}
    });

    const parsed = parseToolText(queueResult);
    expect(parsed.ok).toBe(true);
    expect(parsed.data.comments[0].id).toBe('comment-1');

    await clientTransport.close();
    await server.close();
  });

  it('skips duplicate or invalidly-prefixed feature tools', async () => {
    const deps = createMockDeps();

    const server = await createAdAstroMcpServer(deps, {
      resolveFeatureToolSets: async () => [
        {
          featureId: 'ai',
          tools: [
            {
              name: 'post_create',
              title: 'Duplicate Core Tool',
              description: 'Should be skipped',
              handler: async () => ({ ok: true })
            },
            {
              name: 'generate_image',
              title: 'Invalid Prefix',
              description: 'Should be skipped',
              handler: async () => ({ ok: true })
            },
            {
              name: 'ai_post_image_generate',
              title: 'Generate Image',
              description: 'Valid tool',
              handler: async () => ({ mediaId: 'media-1' })
            }
          ]
        }
      ]
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(clientTransport);

    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name);
    expect(names).toContain('ai_post_image_generate');
    expect(names.filter((name) => name === 'post_create')).toHaveLength(1);
    expect(names).not.toContain('generate_image');

    await clientTransport.close();
    await server.close();
  });

  it('fails closed when feature tool resolver throws', async () => {
    const deps = createMockDeps();

    const server = await createAdAstroMcpServer(deps, {
      resolveFeatureToolSets: async () => {
        throw new Error('resolver failed');
      }
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(clientTransport);

    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name);
    expect(names).toContain('adastro_status');
    expect(names).not.toContain('comments_queue_list');

    await clientTransport.close();
    await server.close();
  });
});
