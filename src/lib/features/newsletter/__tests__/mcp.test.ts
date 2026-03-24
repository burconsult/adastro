import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  from: vi.fn()
}));

vi.mock('@/lib/services/settings-service', () => ({
  SettingsService: vi.fn(() => ({
    getSettings: mocks.getSettings
  }))
}));

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from
  }
}));

import { NEWSLETTER_FEATURE_MCP_EXTENSION } from '../mcp.js';

const createCountQuery = (count: number) => {
  const promise = Promise.resolve({ count, error: null });
  const query: any = {
    select: vi.fn(),
    eq: vi.fn(),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise)
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(promise);

  return query;
};

describe('newsletter mcp extension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSettings.mockImplementation(async (keys: string[]) =>
      Object.fromEntries(
        keys.map((key) => {
          if (key === 'features.newsletter.enabled') return [key, false];
          if (key === 'features.newsletter.provider') return [key, 'console'];
          if (key === 'site.title') return [key, 'AdAstro'];
          if (key === 'site.url') return [key, 'https://example.com'];
          return [key, undefined];
        })
      )
    );
  });

  it('returns newsletter status even when the feature is disabled', async () => {
    const tools = await NEWSLETTER_FEATURE_MCP_EXTENSION.getTools();
    const statusTool = tools.find((tool) => tool.name === 'newsletter_status');
    const result = await statusTool?.handler({});

    expect(result).toMatchObject({
      enabled: false,
      subscribers: { total: 0 },
      campaigns: { total: 0 }
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('lists subscribers when enabled', async () => {
    mocks.getSettings.mockImplementation(async (keys: string[]) =>
      Object.fromEntries(
        keys.map((key) => {
          if (key === 'features.newsletter.enabled') return [key, true];
          if (key === 'features.newsletter.provider') return [key, 'console'];
          if (key === 'site.title') return [key, 'AdAstro'];
          if (key === 'site.url') return [key, 'https://example.com'];
          return [key, undefined];
        })
      )
    );

    const listQuery = {
      select: vi.fn(),
      order: vi.fn(),
      limit: vi.fn()
    };
    listQuery.select.mockReturnValue(listQuery);
    listQuery.order.mockReturnValue(listQuery);
    listQuery.limit.mockResolvedValue({
      data: [{ id: 'sub-1', email: 'reader@example.com', status: 'subscribed' }],
      error: null
    });

    mocks.from
      .mockImplementationOnce((table: string) => {
        if (table !== 'newsletter_subscribers') {
          throw new Error(`Unexpected table: ${table}`);
        }
        return listQuery;
      })
      .mockImplementationOnce((table: string) => {
        if (table !== 'newsletter_subscribers') {
          throw new Error(`Unexpected table: ${table}`);
        }
        return createCountQuery(1);
      })
      .mockImplementationOnce((table: string) => {
        if (table !== 'newsletter_subscribers') {
          throw new Error(`Unexpected table: ${table}`);
        }
        return createCountQuery(0);
      })
      .mockImplementationOnce((table: string) => {
        if (table !== 'newsletter_subscribers') {
          throw new Error(`Unexpected table: ${table}`);
        }
        return createCountQuery(1);
      })
      .mockImplementationOnce((table: string) => {
        if (table !== 'newsletter_subscribers') {
          throw new Error(`Unexpected table: ${table}`);
        }
        return createCountQuery(0);
      });

    const tools = await NEWSLETTER_FEATURE_MCP_EXTENSION.getTools();
    const listTool = tools.find((tool) => tool.name === 'newsletter_subscribers_list');
    const result = await listTool?.handler({ limit: 25 });

    expect(result).toMatchObject({
      subscribers: [{ email: 'reader@example.com' }]
    });
  });
});
