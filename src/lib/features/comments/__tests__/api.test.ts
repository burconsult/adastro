import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  requireAdmin: vi.fn(),
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  getSetting: vi.fn(),
  getSettings: vi.fn(),
  from: vi.fn()
}));

vi.mock('@/lib/auth/auth-helpers', () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
  requireAdmin: mocks.requireAdmin
}));

vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit
}));

vi.mock('@/lib/security/request-guards', () => ({
  getClientIp: mocks.getClientIp
}));

vi.mock('@/lib/services/settings-service', () => ({
  SettingsService: vi.fn(() => ({
    getSetting: mocks.getSetting,
    getSettings: mocks.getSettings
  }))
}));

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from
  }
}));

import { COMMENTS_FEATURE_API } from '../api.js';

const createChainedQuery = <T>(result: T) => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn()
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue(result);

  return query;
};

const createInsertQuery = <T>(result: T) => {
  const query = {
    select: vi.fn(),
    single: vi.fn()
  };

  query.select.mockReturnValue(query);
  query.single.mockResolvedValue(result);
  return query;
};

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

const createCountQuery = (count: number, error: unknown = null) => {
  const promise = Promise.resolve({ count, error });
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

describe('comments submit api', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getSetting.mockResolvedValue(true);
    mocks.getSettings.mockImplementation(async (keys: string[]) => {
      const defaults: Record<string, unknown> = {
        'features.comments.enabled': true,
        'features.comments.moderation': false,
        'features.comments.authenticatedOnly': false,
        'features.comments.maxLinks': 3,
        'features.comments.minSecondsToSubmit': 0,
        'features.comments.blockedTerms': [],
        'features.comments.recaptcha.enabled': false,
        'security.recaptcha.enabled': false,
        'security.recaptcha.siteKey': '',
        'security.recaptcha.secretKey': '',
        'security.recaptcha.minScore': 0.5
      };

      return Object.fromEntries(keys.map((key) => [key, defaults[key]]));
    });
    mocks.checkRateLimit.mockReturnValue({ allowed: true, retryAfterSec: 0 });
    mocks.getClientIp.mockReturnValue('127.0.0.1');
    mocks.requireAdmin.mockResolvedValue({ id: 'admin-1' });
  });

  it('uses authenticated user identity instead of submitted name/email', async () => {
    const postsQuery = createChainedQuery({ data: { id: 'post-1', status: 'published' }, error: null });
    const authorsQuery = createChainedQuery({ data: { name: 'Jane Author' }, error: null });
    const insertQuery = createInsertQuery({ data: { id: 'comment-1', status: 'approved' }, error: null });
    const commentsTable = {
      insert: vi.fn().mockReturnValue(insertQuery)
    };

    mocks.getAuthenticatedUser.mockResolvedValue({ id: 'user-1', email: 'jane@example.com' });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'posts') return postsQuery;
      if (table === 'authors') return authorsQuery;
      if (table === 'comments') return commentsTable;
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await COMMENTS_FEATURE_API.handlers.submit({
      request: new Request('http://localhost/api/features/comments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: 'hello-world',
          authorName: 'Spoofed Name',
          authorEmail: 'spoofed@example.com',
          content: 'This is a legitimate comment.'
        })
      }),
      params: {}
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.status).toBe('approved');
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'comments:submit:user:user-1' })
    );
    expect(commentsTable.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        author_name: 'Jane Author',
        author_email: 'jane@example.com',
        content: 'This is a legitimate comment.'
      })
    );
  });

  it('requires guest email when user is not authenticated', async () => {
    const postsQuery = createChainedQuery({ data: { id: 'post-1', status: 'published' }, error: null });
    const commentsTable = {
      insert: vi.fn()
    };

    mocks.getAuthenticatedUser.mockResolvedValue(null);
    mocks.from.mockImplementation((table: string) => {
      if (table === 'posts') return postsQuery;
      if (table === 'comments') return commentsTable;
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await COMMENTS_FEATURE_API.handlers.submit({
      request: new Request('http://localhost/api/features/comments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: 'hello-world',
          authorName: 'Guest Name',
          content: 'Guest comment body'
        })
      }),
      params: {}
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error).toBe('Valid email is required');
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'comments:submit:ip:127.0.0.1' })
    );
    expect(commentsTable.insert).not.toHaveBeenCalled();
  });

  it('strips html from guest comment names and content before storing', async () => {
    const postsQuery = createChainedQuery({ data: { id: 'post-1', status: 'published' }, error: null });
    const insertQuery = createInsertQuery({ data: { id: 'comment-1', status: 'approved' }, error: null });
    const commentsTable = {
      insert: vi.fn().mockReturnValue(insertQuery)
    };

    mocks.getAuthenticatedUser.mockResolvedValue(null);
    mocks.from.mockImplementation((table: string) => {
      if (table === 'posts') return postsQuery;
      if (table === 'comments') return commentsTable;
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await COMMENTS_FEATURE_API.handlers.submit({
      request: new Request('http://localhost/api/features/comments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: 'hello-world',
          authorName: '<b>Guest Name</b>',
          authorEmail: 'guest@example.com',
          content: '<p>Hello <strong>world</strong></p><script>alert(1)</script><p>Visit<br>now</p>'
        })
      }),
      params: {}
    });

    expect(response.status).toBe(200);
    expect(commentsTable.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        author_name: 'Guest Name',
        content: 'Hello world\nVisit\nnow'
      })
    );
  });

  it('rejects guest submits when members-only comments are enabled', async () => {
    const postsQuery = createChainedQuery({ data: { id: 'post-1', status: 'published' }, error: null });
    const commentsTable = {
      insert: vi.fn()
    };

    mocks.getAuthenticatedUser.mockResolvedValue(null);
    mocks.getSettings.mockImplementation(async (keys: string[]) => {
      const defaults: Record<string, unknown> = {
        'features.comments.enabled': true,
        'features.comments.moderation': false,
        'features.comments.authenticatedOnly': true,
        'features.comments.maxLinks': 3,
        'features.comments.minSecondsToSubmit': 0,
        'features.comments.blockedTerms': [],
        'features.comments.recaptcha.enabled': false,
        'security.recaptcha.enabled': false,
        'security.recaptcha.siteKey': '',
        'security.recaptcha.secretKey': '',
        'security.recaptcha.minScore': 0.5
      };

      return Object.fromEntries(keys.map((key) => [key, defaults[key]]));
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'posts') return postsQuery;
      if (table === 'comments') return commentsTable;
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await COMMENTS_FEATURE_API.handlers.submit({
      request: new Request('http://localhost/api/features/comments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: 'hello-world',
          authorName: 'Guest Name',
          authorEmail: 'guest@example.com',
          content: 'Guest comment body'
        })
      }),
      params: {}
    });

    const payload = await response.json();
    expect(response.status).toBe(401);
    expect(payload.error).toBe('Sign in to comment.');
    expect(commentsTable.insert).not.toHaveBeenCalled();
  });

  it('falls back to email-derived name for authenticated users without profile names', async () => {
    const postsQuery = createChainedQuery({ data: { id: 'post-1', status: 'published' }, error: null });
    const authorsQuery = createChainedQuery({ data: null, error: null });
    const profilesQuery = createChainedQuery({ data: null, error: null });
    const insertQuery = createInsertQuery({ data: { id: 'comment-1', status: 'approved' }, error: null });
    const commentsTable = {
      insert: vi.fn().mockReturnValue(insertQuery)
    };

    mocks.getAuthenticatedUser.mockResolvedValue({ id: 'user-2', email: 'alex.writer@example.com' });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'posts') return postsQuery;
      if (table === 'authors') return authorsQuery;
      if (table === 'user_profiles') return profilesQuery;
      if (table === 'comments') return commentsTable;
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await COMMENTS_FEATURE_API.handlers.submit({
      request: new Request('http://localhost/api/features/comments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: 'hello-world',
          content: 'Logged-in comment without profile name'
        })
      }),
      params: {}
    });

    expect(response.status).toBe(200);
    expect(commentsTable.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        author_name: 'Alex Writer',
        author_email: 'alex.writer@example.com'
      })
    );
  });

  it('rejects comment submit when recaptcha is required and token is missing', async () => {
    const postsQuery = createChainedQuery({ data: { id: 'post-1', status: 'published' }, error: null });
    const commentsTable = {
      insert: vi.fn()
    };

    mocks.getAuthenticatedUser.mockResolvedValue(null);
    mocks.getSettings.mockImplementation(async (keys: string[]) => {
      const defaults: Record<string, unknown> = {
        'features.comments.enabled': true,
        'features.comments.moderation': false,
        'features.comments.authenticatedOnly': false,
        'features.comments.maxLinks': 3,
        'features.comments.minSecondsToSubmit': 0,
        'features.comments.blockedTerms': [],
        'features.comments.recaptcha.enabled': true,
        'security.recaptcha.enabled': true,
        'security.recaptcha.siteKey': 'site-key',
        'security.recaptcha.secretKey': 'secret-key',
        'security.recaptcha.minScore': 0.5
      };

      return Object.fromEntries(keys.map((key) => [key, defaults[key]]));
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'posts') return postsQuery;
      if (table === 'comments') return commentsTable;
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await COMMENTS_FEATURE_API.handlers.submit({
      request: new Request('http://localhost/api/features/comments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: 'hello-world',
          authorName: 'Guest Name',
          authorEmail: 'guest@example.com',
          content: 'Guest comment body'
        })
      }),
      params: {}
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error).toBe('Anti-spam verification failed. Please try again.');
    expect(commentsTable.insert).not.toHaveBeenCalled();
  });

  it('returns filtered queue data with summary metadata', async () => {
    const queueQuery = createRangeQuery({
      data: [
        {
          id: 'comment-1',
          post_id: 'post-1',
          author_name: 'Alice',
          author_email: 'alice@example.com',
          content: 'Pending comment',
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
      createCountQuery(8),
      createCountQuery(3),
      createCountQuery(4),
      createCountQuery(1)
    ];

    mocks.from.mockImplementation((table: string) => {
      if (table === 'comments') {
        return commentQueries.shift();
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await COMMENTS_FEATURE_API.handlers.queue({
      request: new Request('http://localhost/api/features/comments/queue?status=pending&limit=50', {
        method: 'GET'
      }),
      params: {}
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.status).toBe('pending');
    expect(payload.summary).toEqual({
      total: 8,
      pending: 3,
      approved: 4,
      rejected: 1
    });
    expect(payload.comments).toHaveLength(1);
    expect(queueQuery.eq).toHaveBeenCalledWith('status', 'pending');
  });

  it('returns feature status for the moderation dashboard', async () => {
    const commentQueries = [
      createCountQuery(12),
      createCountQuery(5),
      createCountQuery(6),
      createCountQuery(1)
    ];

    mocks.getSettings.mockImplementation(async (keys: string[]) => {
      const defaults: Record<string, unknown> = {
        'features.comments.enabled': true,
        'features.comments.moderation': true,
        'features.comments.authenticatedOnly': true,
        'features.comments.maxLinks': 2,
        'features.comments.minSecondsToSubmit': 5,
        'features.comments.blockedTerms': ['spam', 'casino'],
        'features.comments.recaptcha.enabled': true,
        'security.recaptcha.enabled': true,
        'security.recaptcha.siteKey': 'site-key',
        'security.recaptcha.secretKey': 'secret-key',
        'security.recaptcha.minScore': 0.7
      };

      return Object.fromEntries(keys.map((key) => [key, defaults[key]]));
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'comments') {
        return commentQueries.shift();
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await COMMENTS_FEATURE_API.handlers.status({
      request: new Request('http://localhost/api/features/comments/status', {
        method: 'GET'
      }),
      params: {}
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.moderation).toBe(true);
    expect(payload.authenticatedOnly).toBe(true);
    expect(payload.spam).toEqual({
      maxLinks: 2,
      minSecondsToSubmit: 5,
      blockedTermsCount: 2
    });
    expect(payload.recaptcha).toEqual({
      enabled: true,
      required: true,
      configured: true,
      minScore: 0.7
    });
    expect(payload.summary.total).toBe(12);
  });

  it('updates comment status through the moderation api', async () => {
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

    const response = await COMMENTS_FEATURE_API.handlers.moderate({
      request: new Request('http://localhost/api/features/comments/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'comment-1',
          status: 'approved'
        })
      }),
      params: {}
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(commentsTable.update).toHaveBeenCalledWith({ status: 'approved' });
  });
});
