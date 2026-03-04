import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  listUsers: vi.fn(),
  findProfileByAuthUserId: vi.fn()
}));

vi.mock('@/lib/auth/auth-helpers', () => ({
  requireAdmin: mocks.requireAdmin,
  authService: {
    listUsers: mocks.listUsers
  }
}));

vi.mock('@/lib/database/repositories/user-profile-repository', () => ({
  UserProfileRepository: vi.fn().mockImplementation(() => ({
    findByAuthUserId: mocks.findProfileByAuthUserId
  }))
}));

import { GET } from '../../users.ts';

describe('admin users api (list)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mocks.listUsers.mockResolvedValue({
      users: [
        {
          id: 'user-1',
          email: 'editor@example.com',
          role: 'author',
          authorId: 'author-1',
          emailConfirmed: true,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          lastSignInAt: new Date('2026-02-01T00:00:00.000Z')
        }
      ],
      total: 1
    });
    mocks.findProfileByAuthUserId.mockResolvedValue({
      fullName: 'Editor Name',
      bio: 'Bio text',
      avatarSource: 'custom',
      avatarUrl: 'https://example.com/avatar.jpg'
    });
  });

  it('returns users with profile details', async () => {
    const request = new Request('https://www.adastro.no/api/admin/users?perPage=50');
    const response = await GET({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.requireAdmin).toHaveBeenCalledWith(request);
    expect(mocks.listUsers).toHaveBeenCalledWith(1, 50);
    expect(payload.total).toBe(1);
    expect(payload.users[0]).toMatchObject({
      id: 'user-1',
      email: 'editor@example.com',
      role: 'author',
      emailConfirmed: true,
      profile: {
        fullName: 'Editor Name',
        bio: 'Bio text',
        avatarSource: 'custom',
        avatarUrl: 'https://example.com/avatar.jpg'
      }
    });
  });

  it('returns 403 for non-admin access', async () => {
    mocks.requireAdmin.mockRejectedValueOnce(new Error('Admin access required'));

    const request = new Request('https://www.adastro.no/api/admin/users');
    const response = await GET({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toMatch(/admin access required/i);
  });
});
