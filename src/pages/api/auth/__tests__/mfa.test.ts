import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getMfaStatus: vi.fn(),
  enrollTotpFactor: vi.fn(),
  verifyTotpFactor: vi.fn(),
  unenrollMfaFactor: vi.fn(),
  buildAccessTokenCookie: vi.fn(),
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  MockMfaError: class MockMfaError extends Error {
    status: number;

    constructor(message: string, status = 400) {
      super(message);
      this.name = 'MfaError';
      this.status = status;
    }
  },
  MockMfaRequiredError: class MockMfaRequiredError extends Error {
    status: number;

    constructor(message = 'Multi-factor verification required.') {
      super(message);
      this.name = 'MfaRequiredError';
      this.status = 412;
    }
  }
}));

vi.mock('../../../../lib/auth/mfa.js', () => ({
  getMfaStatus: mocks.getMfaStatus,
  enrollTotpFactor: mocks.enrollTotpFactor,
  verifyTotpFactor: mocks.verifyTotpFactor,
  unenrollMfaFactor: mocks.unenrollMfaFactor,
  MfaError: mocks.MockMfaError,
  MfaRequiredError: mocks.MockMfaRequiredError
}));

vi.mock('../../../../lib/auth/cookies.js', () => ({
  buildAccessTokenCookie: mocks.buildAccessTokenCookie
}));

vi.mock('../../../../lib/security/rate-limit.js', () => ({
  checkRateLimit: mocks.checkRateLimit,
  buildRateLimitHeaders: () => ({
    'RateLimit-Limit': '10',
    'RateLimit-Remaining': '9',
    'RateLimit-Reset': '600'
  })
}));

vi.mock('../../../../lib/security/request-guards.js', () => ({
  getClientIp: mocks.getClientIp
}));

import { DELETE, GET, POST } from '../mfa.ts';

describe('auth mfa api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildAccessTokenCookie.mockReturnValue('sb-access-token=token-2');
    mocks.checkRateLimit.mockReturnValue({ allowed: true, retryAfterSec: 0, remaining: 9 });
    mocks.getClientIp.mockReturnValue('127.0.0.1');
  });

  it('returns MFA status for authenticated users', async () => {
    mocks.getMfaStatus.mockResolvedValue({
      enabledInApp: true,
      assurance: { currentLevel: 'aal1', nextLevel: 'aal2', currentAuthenticationMethods: ['password'] },
      factors: { all: [], verified: [], totp: [] }
    });

    const response = await GET({
      request: new Request('https://adastrocms.vercel.app/api/auth/mfa')
    } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.enabledInApp).toBe(true);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('verifies a factor and refreshes the session cookie', async () => {
    mocks.verifyTotpFactor.mockResolvedValue({
      accessToken: 'token-2',
      expiresIn: 3600,
      status: {
        enabledInApp: true,
        assurance: { currentLevel: 'aal2', nextLevel: 'aal2', currentAuthenticationMethods: ['password', 'totp'] },
        factors: {
          all: [{ id: 'factor-1', factorType: 'totp', status: 'verified', friendlyName: 'Authenticator app', createdAt: null, updatedAt: null }],
          verified: [{ id: 'factor-1', factorType: 'totp', status: 'verified', friendlyName: 'Authenticator app', createdAt: null, updatedAt: null }],
          totp: [{ id: 'factor-1', factorType: 'totp', status: 'verified', friendlyName: 'Authenticator app', createdAt: null, updatedAt: null }]
        }
      }
    });

    const request = new Request('https://adastrocms.vercel.app/api/auth/mfa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', factorId: 'factor-1', code: '123456' })
    });

    const response = await POST({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.verifyTotpFactor).toHaveBeenCalledWith(request, 'factor-1', '123456');
    expect(mocks.buildAccessTokenCookie).toHaveBeenCalledWith('token-2', 3600, request.url);
  });

  it('requires step-up verification before removing a factor', async () => {
    mocks.unenrollMfaFactor.mockRejectedValue(new mocks.MockMfaRequiredError());

    const request = new Request('https://adastrocms.vercel.app/api/auth/mfa', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factorId: 'factor-1' })
    });

    const response = await DELETE({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(412);
    expect(payload.code).toBe('mfa_required');
  });
});
