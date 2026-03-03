import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  buildAccessTokenCookie: vi.fn()
}));

vi.mock('../../../../lib/auth/auth-helpers.js', () => ({
  authService: {
    signOut: mocks.signOut
  }
}));

vi.mock('../../../../lib/auth/cookies.js', () => ({
  buildAccessTokenCookie: mocks.buildAccessTokenCookie
}));

import { POST } from '../logout.ts';

describe('auth logout api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildAccessTokenCookie.mockReturnValue('sb-access-token=; Max-Age=0');
  });

  it('always clears auth cookie on success', async () => {
    mocks.signOut.mockResolvedValue(undefined);

    const request = new Request('https://adastrocms.vercel.app/api/auth/logout', {
      method: 'POST'
    });

    const response = await POST({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mocks.buildAccessTokenCookie).toHaveBeenCalledWith('', 0, request.url);
    expect(response.headers.get('set-cookie')).toContain('sb-access-token=');
  });

  it('still clears auth cookie when supabase signOut fails', async () => {
    mocks.signOut.mockRejectedValue(new Error('Auth session missing!'));

    const request = new Request('https://adastrocms.vercel.app/api/auth/logout', {
      method: 'POST'
    });

    const response = await POST({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mocks.buildAccessTokenCookie).toHaveBeenCalledWith('', 0, request.url);
    expect(response.headers.get('set-cookie')).toContain('sb-access-token=');
  });
});
