import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  setUserRole: vi.fn(),
  inviteUserByEmail: vi.fn()
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

import { POST } from '../invite-user.ts';

const resolveExpectedRedirectBase = (requestUrl: string) => {
  const configuredSiteUrl = typeof import.meta.env.SITE_URL === 'string'
    ? import.meta.env.SITE_URL.trim()
    : '';

  if (configuredSiteUrl) {
    try {
      return new URL(configuredSiteUrl).origin;
    } catch {
      // Fall back to request origin when SITE_URL is invalid.
    }
  }

  return new URL(requestUrl).origin;
};

describe('invite user api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: 'admin-1' });
    mocks.inviteUserByEmail.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null
    });
  });

  it('uses configured SITE_URL callback, falling back to request origin', async () => {
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
        redirectTo: `${expectedRedirectBase}/auth/callback?redirect=%2Fauth%2Freset-password%3Fnext%3D%252Fadmin%252Fposts`
      })
    );
    expect(mocks.setUserRole).toHaveBeenCalledWith('user-1', 'author');
  });

  it('builds a profile redirect for invited reader users', async () => {
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
        redirectTo: `${expectedRedirectBase}/auth/callback?redirect=%2Fauth%2Freset-password%3Fnext%3D%252Fprofile`
      })
    );
    expect(mocks.setUserRole).toHaveBeenCalledWith('user-1', 'reader');
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
