import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  updateUserById: vi.fn()
}));

vi.mock('../../../../lib/auth/auth-helpers.js', () => ({
  requireAuth: mocks.requireAuth
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
    mocks.requireAuth.mockResolvedValue({ id: 'user-1' });
    mocks.updateUserById.mockResolvedValue({ error: null });
  });

  it('requires authentication', async () => {
    mocks.requireAuth.mockRejectedValue(new Error('Authentication required'));

    const request = new Request('https://adastrocms.vercel.app/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'StrongPass123!' })
    });

    const response = await POST({ request } as any);
    const payload = await response.json();
    expect(response.status).toBe(401);
    expect(payload.error).toMatch(/authentication required/i);
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it('validates minimum password length', async () => {
    const request = new Request('https://adastrocms.vercel.app/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'short' })
    });

    const response = await POST({ request } as any);
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/at least 8/i);
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it('updates password for authenticated users', async () => {
    const request = new Request('https://adastrocms.vercel.app/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'StrongPass123!' })
    });

    const response = await POST({ request } as any);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mocks.updateUserById).toHaveBeenCalledWith('user-1', {
      password: 'StrongPass123!'
    });
  });
});
