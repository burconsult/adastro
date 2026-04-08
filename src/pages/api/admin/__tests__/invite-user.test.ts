import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeCanonicalSiteUrl } from '@/lib/url/site-url';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  setUserRole: vi.fn(),
  inviteUserByEmail: vi.fn(),
  getSiteLocaleConfig: vi.fn()
}));

vi.mock('@/lib/auth/auth-helpers', () => ({
  requireAdmin: mocks.requireAdmin,
  authService: {
    setUserRole: mocks.setUserRole
  }
}));

vi.mock('@/lib/auth/author-provisioning', () => ({
  ensureAuthorProfileForAuthUser: vi.fn()
}));

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        inviteUserByEmail: mocks.inviteUserByEmail
      }
    }
  }
}));

vi.mock('@/lib/site-config', () => ({
  getSiteLocaleConfig: mocks.getSiteLocaleConfig
}));

import { POST } from '../invite-user.ts';

const resolveExpectedRedirectBase = (requestUrl: string) => {
  const configuredSiteUrl = typeof import.meta.env.SITE_URL === 'string'
    ? import.meta.env.SITE_URL.trim()
    : process.env.SITE_URL || '';

  return normalizeCanonicalSiteUrl(configuredSiteUrl) || new URL(requestUrl).origin;
};

describe('invite user api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SITE_URL = 'https://adastrocms.vercel.app';
    mocks.requireAdmin.mockResolvedValue({ id: 'admin-1' });
    mocks.getSiteLocaleConfig.mockResolvedValue({ defaultLocale: 'en', locales: ['en'] });
    mocks.inviteUserByEmail.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null
    });
  });

  afterEach(() => {
    delete process.env.SITE_URL;
  });

  it('uses configured SITE_URL for invite callbacks', async () => {
    const requestUrl = 'https://adastrocms.vercel.app/api/admin/invite-user';
    const request = new Request(requestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'writer@example.com',
        role: 'author'
      })
    });
    const expectedRedirectBase = resolveExpectedRedirectBase(requestUrl);

    const response = await POST({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mocks.inviteUserByEmail).toHaveBeenCalledWith(
      'writer@example.com',
      expect.objectContaining({
        redirectTo: `${expectedRedirectBase}/en/auth/callback?redirect=%2Fen%2Fauth%2Freset-password%3Fnext%3D%252Fadmin%252Fposts`
      })
    );
    expect(mocks.setUserRole).toHaveBeenCalledWith('user-1', 'author');
  });

  it('builds a profile redirect for invited reader users', async () => {
    mocks.getSiteLocaleConfig.mockResolvedValueOnce({ defaultLocale: 'nb', locales: ['nb', 'en'] });
    const requestUrl = 'https://adastrocms.vercel.app/api/admin/invite-user';
    const request = new Request(requestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'reader@example.com',
        role: 'reader'
      })
    });
    const expectedRedirectBase = resolveExpectedRedirectBase(requestUrl);

    const response = await POST({ request } as any);

    expect(response.status).toBe(200);
    expect(mocks.inviteUserByEmail).toHaveBeenCalledWith(
      'reader@example.com',
      expect.objectContaining({
        redirectTo: `${expectedRedirectBase}/nb/auth/callback?redirect=%2Fnb%2Fauth%2Freset-password%3Fnext%3D%252Fnb%252Fprofile`
      })
    );
    expect(mocks.setUserRole).toHaveBeenCalledWith('user-1', 'reader');
  });

  it('fails closed when SITE_URL is missing outside local development', async () => {
    delete process.env.SITE_URL;

    const request = new Request('https://adastrocms.vercel.app/api/admin/invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'writer@example.com',
        role: 'author'
      })
    });

    const response = await POST({ request } as any);

    expect(response.status).toBe(500);
    expect(mocks.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('rejects unsupported role values', async () => {
    const request = new Request('https://adastrocms.vercel.app/api/admin/invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'writer@example.com',
        role: 'super-admin'
      })
    });

    const response = await POST({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/invalid role/i);
    expect(mocks.inviteUserByEmail).not.toHaveBeenCalled();
  });
});
