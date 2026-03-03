import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  buildAccessTokenCookie: vi.fn()
}));

vi.mock('../../../../lib/supabase.js', () => ({
  createSupabaseServerClient: () => ({
    auth: {
      verifyOtp: mocks.verifyOtp
    }
  })
}));

vi.mock('../../../../lib/auth/cookies.js', () => ({
  buildAccessTokenCookie: mocks.buildAccessTokenCookie
}));

import { POST } from '../verify-otp.ts';

describe('auth verify otp api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildAccessTokenCookie.mockReturnValue('sb-access-token=token-1');
    mocks.verifyOtp.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-1',
          expires_in: 3600
        }
      },
      error: null
    });
  });

  it('validates required fields', async () => {
    const request = new Request('https://adastrocms.vercel.app/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const response = await POST({ request } as any);
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/token_hash and type are required/i);
  });

  it('verifies otp and sets auth cookie', async () => {
    const request = new Request('https://adastrocms.vercel.app/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token_hash: 'hash-123',
        type: 'invite'
      })
    });

    const response = await POST({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'hash-123',
      type: 'invite'
    });
    expect(mocks.buildAccessTokenCookie).toHaveBeenCalledWith('token-1', 3600, request.url);
  });
});
