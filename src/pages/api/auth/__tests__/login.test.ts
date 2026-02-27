import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  buildAccessTokenCookie: vi.fn(),
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn()
}));

vi.mock('../../../../lib/auth/auth-helpers.js', () => ({
  authService: {
    signIn: mocks.signIn
  }
}));

vi.mock('../../../../lib/auth/cookies.js', () => ({
  buildAccessTokenCookie: mocks.buildAccessTokenCookie
}));

vi.mock('../../../../lib/security/rate-limit.js', () => ({
  checkRateLimit: mocks.checkRateLimit
}));

vi.mock('../../../../lib/security/request-guards.js', () => ({
  getClientIp: mocks.getClientIp
}));

import { POST } from '../login.ts';

describe('auth login api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClientIp.mockReturnValue('127.0.0.1');
    mocks.checkRateLimit.mockReturnValue({ allowed: true, retryAfterSec: 0 });
    mocks.signIn.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'author@example.com',
        role: 'author'
      },
      session: {
        access_token: 'token-1',
        expires_in: 3600
      }
    });
    mocks.buildAccessTokenCookie.mockReturnValue('sb-access-token=token-1');
  });

  it('returns role-safe redirect for non-admin users', async () => {
    const request = new Request('https://adastrocms.vercel.app/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'author@example.com',
        password: 'StrongPass123!',
        redirect: '/admin/users'
      })
    });

    const response = await POST({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.redirect).toBe('/admin/posts');
    expect(payload.user.role).toBe('author');
  });
});
