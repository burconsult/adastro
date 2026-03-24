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

import { COMMENTS_FEATURE_MCP_EXTENSION } from '../mcp.js';

const createRangeQuery = <T>(result: T) => {
  const promise = Promise.resolve(result);
  const query: any = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise)
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.range.mockReturnValue(query);

  return query;
};

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

const createUpdateQuery = <T>(result: T) => {
  const query = {
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn()
  };

  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue(result);
  return query;
};

describe('comments mcp extension', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getSettings.mockImplementation(async (keys: string[]) => {
      const defaults: Record<string, unknown> = {
        'features.comments.enabled': true,
        'features.comments.moderation': true,
        'features.comments.authenticatedOnly': false,
        'features.comments.maxLinks': 3,
        'features.comments.minSecondsToSubmit': 2,
        'features.comments.blockedTerms': [],
        'features.comments.recaptcha.enabled': false,
        'security.recaptcha.enabled': false,
        'security.recaptcha.siteKey': '',
        'security.recaptcha.secretKey': '',
        'security.recaptcha.minScore': 0.5
      };

      return Object.fromEntries(keys.map((key) => [key, defaults[key]]));
    });
  });

  it('lists queue items through the shared moderation service', async () => {
    const queueQuery = createRangeQuery({
      data: [
        {
          id: 'comment-1',
          post_id: 'post-1',
          author_name: 'Alice',
          author_email: 'alice@example.com',
          content: 'Needs moderation',
          status: 'pending',
          created_at: '2026-03-20T10:00:00.000Z',
          updated_at: '2026-03-20T10:05:00.000Z',
          posts: {
            id: 'post-1',
            title: 'Hello world',
            slug: 'hello-world',
            locale: 'en'
          }
        }
      ],
      error: null
    });
    const commentQueries = [
      queueQuery,
      createCountQuery(7),
      createCountQuery(3),
      createCountQuery(3),
      createCountQuery(1)
    ];

    mocks.from.mockImplementation((table: string) => {
      if (table === 'comments') {
        return commentQueries.shift();
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const tools = await COMMENTS_FEATURE_MCP_EXTENSION.getTools();
    const listTool = tools.find((tool) => tool.name === 'comments_queue_list');
    expect(listTool).toBeDefined();

    const result = await listTool!.handler({ status: 'pending', limit: 20, offset: 0 }) as any;
    expect(result.comments).toHaveLength(1);
    expect(result.summary.pending).toBe(3);
    expect(queueQuery.eq).toHaveBeenCalledWith('status', 'pending');
  });

  it('updates comment moderation state through the shared service', async () => {
    const updateQuery = createUpdateQuery({
      data: {
        id: 'comment-1',
        post_id: 'post-1',
        status: 'approved',
        updated_at: '2026-03-20T10:10:00.000Z'
      },
      error: null
    });
    const commentsTable = {
      update: vi.fn().mockReturnValue(updateQuery)
    };

    mocks.from.mockImplementation((table: string) => {
      if (table === 'comments') return commentsTable;
      throw new Error(`Unexpected table: ${table}`);
    });

    const tools = await COMMENTS_FEATURE_MCP_EXTENSION.getTools();
    const moderateTool = tools.find((tool) => tool.name === 'comments_moderate');
    expect(moderateTool).toBeDefined();

    const result = await moderateTool!.handler({
      commentId: '11111111-1111-4111-8111-111111111111',
      status: 'approved'
    }) as any;

    expect(result.status).toBe('approved');
    expect(commentsTable.update).toHaveBeenCalledWith({ status: 'approved' });
  });

  it('fails closed when the feature is disabled', async () => {
    mocks.getSettings.mockImplementation(async (keys: string[]) => {
      const defaults: Record<string, unknown> = {
        'features.comments.enabled': false,
        'features.comments.moderation': true,
        'features.comments.authenticatedOnly': false,
        'features.comments.maxLinks': 3,
        'features.comments.minSecondsToSubmit': 2,
        'features.comments.blockedTerms': [],
        'features.comments.recaptcha.enabled': false,
        'security.recaptcha.enabled': false,
        'security.recaptcha.siteKey': '',
        'security.recaptcha.secretKey': '',
        'security.recaptcha.minScore': 0.5
      };

      return Object.fromEntries(keys.map((key) => [key, defaults[key]]));
    });

    const tools = await COMMENTS_FEATURE_MCP_EXTENSION.getTools();
    const listTool = tools.find((tool) => tool.name === 'comments_queue_list');

    await expect(listTool!.handler({})).rejects.toThrow('Comments feature is disabled.');
  });
});
