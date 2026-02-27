import { describe, expect, it, vi } from 'vitest';
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

describe('AdAstro MCP server', () => {
  it('lists tools and executes a status tool', async () => {
    const deps = createMockDeps();
    const server = createAdAstroMcpServer(deps);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(clientTransport);

    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name);
    expect(names).toContain('adastro_status');
    expect(names).toContain('post_create');
    expect(names).toContain('page_update');
    expect(names).toContain('settings_update');

    const statusResult = await client.callTool({
      name: 'adastro_status',
      arguments: {}
    });
    const parsed = parseToolText(statusResult);

    expect(parsed.ok).toBe(true);
    expect(parsed.data.app).toBe('AdAstro');
    expect((deps.getStatus as any).mock.calls.length).toBe(1);

    await clientTransport.close();
    await server.close();
  });

  it('wraps tool errors as MCP tool error results', async () => {
    const deps = createMockDeps();
    (deps.publishPost as any).mockRejectedValueOnce(new Error('publish failed'));
    const server = createAdAstroMcpServer(deps);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(clientTransport);

    const result = await client.callTool({
      name: 'post_publish',
      arguments: { id: '00000000-0000-0000-0000-000000000001' }
    });
    const textBlock = Array.isArray((result as any).content)
      ? (result as any).content.find((block: any) => block.type === 'text')
      : null;

    expect(textBlock?.text).toMatch(/publish failed|mcp error/i);

    await clientTransport.close();
    await server.close();
  });
});
