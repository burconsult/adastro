import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resetPassword: vi.fn(),
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn()
}));

vi.mock('../../../../lib/auth/auth-helpers.js', () => ({
  authService: {
    resetPassword: mocks.resetPassword
  }
}));

vi.mock('../../../../lib/security/rate-limit.js', () => ({
  checkRateLimit: mocks.checkRateLimit
}));

vi.mock('../../../../lib/security/request-guards.js', () => ({
  getClientIp: mocks.getClientIp
}));

import { POST } from '../forgot-password.ts';

describe('forgot password api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClientIp.mockReturnValue('127.0.0.1');
    mocks.checkRateLimit.mockReturnValue({ allowed: true, retryAfterSec: 0 });
    mocks.resetPassword.mockResolvedValue(undefined);
  });

  it('validates email input', async () => {
    const request = new Request('https://adastrocms.vercel.app/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalid' })
    });

    const response = await POST({ request } as any);
    expect(response.status).toBe(400);
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  it('returns generic success message without user enumeration', async () => {
    const request = new Request('https://adastrocms.vercel.app/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'reader@example.com' })
    });

    const response = await POST({ request } as any);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(String(payload.message).toLowerCase()).toContain('if an account exists');
    const expectedSiteUrl = (import.meta.env.SITE_URL as string | undefined)?.trim() || 'https://adastrocms.vercel.app';
    expect(mocks.resetPassword).toHaveBeenCalledWith(
      { email: 'reader@example.com' },
      { siteUrl: expectedSiteUrl }
    );
  });
});
