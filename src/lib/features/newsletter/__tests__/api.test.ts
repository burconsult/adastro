import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  requireAdmin: vi.fn(),
  requireAuthor: vi.fn(),
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  getSettings: vi.fn(),
  from: vi.fn()
}));

vi.mock('@/lib/auth/auth-helpers', () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
  requireAdmin: mocks.requireAdmin,
  requireAuthor: mocks.requireAuthor
}));

vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit
}));

vi.mock('@/lib/security/request-guards', () => ({
  getClientIp: mocks.getClientIp
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

process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || 'newsletter-test-secret';

import { buildNewsletterUnsubscribeToken } from '../lib/service.js';
import { NEWSLETTER_FEATURE_API } from '../api.js';

const createUpdateQuery = (result: any) => ({
  update: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue(result)
  })
});

describe('newsletter api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockReturnValue({ allowed: true, retryAfterSec: 0 });
    mocks.getClientIp.mockReturnValue('127.0.0.1');
    mocks.getAuthenticatedUser.mockResolvedValue(null);
    mocks.requireAdmin.mockResolvedValue({ id: 'admin-1' });
    mocks.requireAuthor.mockResolvedValue({ id: 'author-1' });
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

  it('rejects unauthenticated email-only unsubscribe requests', async () => {
    const response = await NEWSLETTER_FEATURE_API.handlers.unsubscribe({
      request: new Request('http://localhost/api/features/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'reader@example.com' })
      }),
      params: {}
    });

    const payload = await response.json();
    expect(response.status).toBe(401);
    expect(payload.error).toContain('signed unsubscribe link or authenticated session');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('accepts signed unsubscribe links via GET', async () => {
    const token = buildNewsletterUnsubscribeToken('reader@example.com', 60_000);
    const subscribersQuery = createUpdateQuery({ error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'newsletter_subscribers') return subscribersQuery;
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await NEWSLETTER_FEATURE_API.handlers.unsubscribe({
      request: new Request(
        `http://localhost/api/features/newsletter/unsubscribe?token=${encodeURIComponent(token)}`,
        { method: 'GET' }
      ),
      params: {}
    });

    const payload = await response.text();
    expect(response.status).toBe(200);
    expect(payload).toContain('Unsubscribed');
    expect(subscribersQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'unsubscribed',
        source: 'unsubscribe-link'
      })
    );
  });

  it('accepts RFC 8058 one-click unsubscribe POSTs with a signed token', async () => {
    const token = buildNewsletterUnsubscribeToken('reader@example.com', 60_000);
    const subscribersQuery = createUpdateQuery({ error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'newsletter_subscribers') return subscribersQuery;
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await NEWSLETTER_FEATURE_API.handlers.unsubscribe({
      request: new Request(
        `http://localhost/api/features/newsletter/unsubscribe?token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'List-Unsubscribe=One-Click'
        }
      ),
      params: {}
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    expect(subscribersQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'unsubscribed',
        source: 'one-click'
      })
    );
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
  });

  it('returns disabled admin status without querying newsletter tables', async () => {
    const response = await NEWSLETTER_FEATURE_API.handlers['admin-status']({
      request: new Request('http://localhost/api/features/newsletter/admin-status'),
      params: {}
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.enabled).toBe(false);
    expect(payload.subscribers).toMatchObject({
      total: 0,
      subscribed: 0
    });
    expect(payload.campaigns).toMatchObject({
      total: 0,
      completed: 0
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
