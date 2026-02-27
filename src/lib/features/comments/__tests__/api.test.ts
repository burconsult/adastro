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

describe('comments submit api', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getSetting.mockImplementation(async (key: string) => {
      if (key === 'features.comments.moderation') return false;
      if (key === 'features.comments.authenticatedOnly') return false;
      return true;
    });
    mocks.getSettings.mockResolvedValue({
      'features.comments.maxLinks': 3,
      'features.comments.minSecondsToSubmit': 0,
      'features.comments.blockedTerms': []
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

  it('rejects guest submits when members-only comments are enabled', async () => {
    const postsQuery = createChainedQuery({ data: { id: 'post-1', status: 'published' }, error: null });
    const commentsTable = {
      insert: vi.fn()
    };

    mocks.getAuthenticatedUser.mockResolvedValue(null);
    mocks.getSetting.mockImplementation(async (key: string) => {
      if (key === 'features.comments.enabled') return true;
      if (key === 'features.comments.authenticatedOnly') return true;
      if (key === 'features.comments.moderation') return false;
      return true;
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
      if (keys.includes('security.recaptcha.enabled')) {
        return {
          'security.recaptcha.enabled': true,
          'security.recaptcha.siteKey': 'site-key',
          'security.recaptcha.secretKey': 'secret-key',
          'security.recaptcha.minScore': 0.5,
          'features.comments.recaptcha.enabled': true
        };
      }
      return {
        'features.comments.maxLinks': 3,
        'features.comments.minSecondsToSubmit': 0,
        'features.comments.blockedTerms': []
      };
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
});
