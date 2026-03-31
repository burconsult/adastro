import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireSensitiveMfa: vi.fn(),
  updateUserById: vi.fn(),
  MockMfaError: class MockMfaError extends Error {
    status: number;

    constructor(message: string, status = 400) {
      super(message);
      this.name = 'MfaError';
      this.status = status;
    }
  }
}));

vi.mock('../../../../lib/auth/auth-helpers.js', () => ({
  requireAuth: mocks.requireAuth
}));

vi.mock('../../../../lib/auth/mfa.js', () => ({
  requireSensitiveMfa: mocks.requireSensitiveMfa,
  MfaError: mocks.MockMfaError
}));

vi.mock('../../../../lib/supabase.js', () => ({
  isSupabaseAdminConfigured: true,
  supabaseAdmin: {
    auth: {
      admin: {
        updateUserById: mocks.updateUserById
      }
    }
  }
}));

import { POST } from '../password.ts';

describe('auth password api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({
      id: 'user-1',
      email: 'author@example.com',
      role: 'author'
    });
    mocks.requireSensitiveMfa.mockResolvedValue(undefined);
    mocks.updateUserById.mockResolvedValue({ error: null });
  });

  it('returns mfa_required when aal2 is needed for password changes', async () => {
    mocks.requireSensitiveMfa.mockRejectedValue(new mocks.MockMfaError('Multi-factor verification required.', 412));

    const request = new Request('https://adastrocms.vercel.app/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'StrongPass123!' })
    });

    const response = await POST({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(412);
    expect(payload.code).toBe('mfa_required');
  });

  it('updates the password when MFA step-up is satisfied', async () => {
    const request = new Request('https://adastrocms.vercel.app/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'StrongPass123!' })
    });

    const response = await POST({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.updateUserById).toHaveBeenCalledWith('user-1', {
      password: 'StrongPass123!'
    });
  });
});
