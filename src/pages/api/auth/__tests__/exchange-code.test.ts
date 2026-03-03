import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  buildAccessTokenCookie: vi.fn()
}));

vi.mock('../../../../lib/supabase.js', () => ({
  createSupabaseServerClient: () => ({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession
    }
  })
}));

vi.mock('../../../../lib/auth/cookies.js', () => ({
  buildAccessTokenCookie: mocks.buildAccessTokenCookie
}));

import { POST } from '../exchange-code.ts';

describe('auth exchange code api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildAccessTokenCookie.mockReturnValue('sb-access-token=token-1');
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-1',
          expires_in: 3600
        }
      },
      error: null
    });
  });

  it('validates authorization code', async () => {
    const request = new Request('https://adastrocms.vercel.app/api/auth/exchange-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const response = await POST({ request } as any);
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/authorization code is required/i);
  });

  it('exchanges auth code and sets cookie', async () => {
    const request = new Request('https://adastrocms.vercel.app/api/auth/exchange-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'code-123' })
    });

    const response = await POST({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith('code-123');
    expect(mocks.buildAccessTokenCookie).toHaveBeenCalledWith('token-1', 3600, request.url);
  });
});
