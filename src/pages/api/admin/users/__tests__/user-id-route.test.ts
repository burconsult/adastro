import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUserFromRequest: vi.fn(),
  getUserById: vi.fn(),
  deleteUser: vi.fn(),
  ensureAuthorProfileForAuthUser: vi.fn(),
  getAuthUserById: vi.fn(),
  updateAuthUserById: vi.fn(),
  findProfileByAuthUserId: vi.fn(),
  upsertProfileByAuthUserId: vi.fn(),
  findAuthorByAuthUserId: vi.fn(),
  updateAuthorById: vi.fn()
}));

vi.mock('@/lib/auth/auth-helpers', () => ({
  authService: {
    getUserFromRequest: mocks.getUserFromRequest,
    getUserById: mocks.getUserById,
    deleteUser: mocks.deleteUser
  }
}));

vi.mock('@/lib/auth/author-provisioning', () => ({
  ensureAuthorProfileForAuthUser: mocks.ensureAuthorProfileForAuthUser
}));

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        getUserById: mocks.getAuthUserById,
        updateUserById: mocks.updateAuthUserById
      }
    }
  }
}));

vi.mock('@/lib/database/repositories/user-profile-repository', () => ({
  UserProfileRepository: vi.fn().mockImplementation(() => ({
    findByAuthUserId: mocks.findProfileByAuthUserId,
    upsertByAuthUserId: mocks.upsertProfileByAuthUserId
  }))
}));

vi.mock('@/lib/database/repositories/author-repository', () => ({
  AuthorRepository: vi.fn().mockImplementation(() => ({
    findByAuthUserId: mocks.findAuthorByAuthUserId,
    update: mocks.updateAuthorById
  }))
}));

import { PUT } from '../[id].ts';

describe('admin users api (by id)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserFromRequest.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mocks.getUserById.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      role: 'reader',
      authorId: null,
      emailConfirmed: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      lastSignInAt: new Date('2026-01-02T00:00:00.000Z')
    });
    mocks.getAuthUserById.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'user@example.com',
          app_metadata: { provider: 'email', role: 'reader' },
          user_metadata: { name: 'Old Name' }
        }
      },
      error: null
    });
    mocks.updateAuthUserById.mockResolvedValue({ error: null });
    mocks.findProfileByAuthUserId.mockResolvedValue({
      fullName: 'Old Name',
      bio: '',
      avatarSource: 'gravatar',
      avatarUrl: ''
    });
    mocks.upsertProfileByAuthUserId.mockResolvedValue({});
    mocks.findAuthorByAuthUserId.mockResolvedValue(null);
    mocks.ensureAuthorProfileForAuthUser.mockResolvedValue(undefined);
  });

  it('updates role, account fields, and profile fields', async () => {
    mocks.getUserById
      .mockResolvedValueOnce({
        id: 'user-1',
        email: 'user@example.com',
        role: 'reader',
        authorId: null,
        emailConfirmed: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        lastSignInAt: new Date('2026-01-02T00:00:00.000Z')
      })
      .mockResolvedValueOnce({
        id: 'user-1',
        email: 'updated@example.com',
        role: 'author',
        authorId: 'author-1',
        emailConfirmed: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        lastSignInAt: new Date('2026-01-03T00:00:00.000Z')
      });

    const request = new Request('https://www.adastro.no/api/admin/users/user-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'updated@example.com',
        role: 'author',
        fullName: 'Updated User',
        bio: 'Updated bio',
        avatarSource: 'custom',
        avatarUrl: 'https://example.com/new-avatar.jpg',
        emailConfirmed: true
      })
    });

    const response = await PUT({ params: { id: 'user-1' }, request } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.updateAuthUserById).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        email: 'updated@example.com',
        email_confirm: true,
        app_metadata: expect.objectContaining({ role: 'author' }),
        user_metadata: expect.objectContaining({ full_name: 'Updated User', name: 'Updated User' })
      })
    );
    expect(mocks.upsertProfileByAuthUserId).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        fullName: 'Updated User',
        bio: 'Updated bio',
        avatarSource: 'custom',
        avatarUrl: 'https://example.com/new-avatar.jpg'
      })
    );
    expect(mocks.ensureAuthorProfileForAuthUser).toHaveBeenCalledWith('user-1');
    expect(payload.user.email).toBe('updated@example.com');
    expect(payload.user.role).toBe('author');
  });

  it('rejects self-demotion from admin', async () => {
    mocks.getUserFromRequest.mockResolvedValueOnce({ id: 'admin-1', role: 'admin' });
    mocks.getUserById.mockResolvedValueOnce({
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
      authorId: 'author-admin',
      emailConfirmed: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      lastSignInAt: new Date('2026-01-02T00:00:00.000Z')
    });

    const request = new Request('https://www.adastro.no/api/admin/users/admin-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader' })
    });

    const response = await PUT({ params: { id: 'admin-1' }, request } as any);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/cannot remove your own admin access/i);
    expect(mocks.updateAuthUserById).not.toHaveBeenCalled();
  });
});
