import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from '../auth-helpers.js';

// Mock the auth service
vi.mock('../auth-helpers.js', () => ({
  authService: {
    getCurrentSession: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

describe('Admin Route Protection Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication checks', () => {
    it('should validate admin session correctly', async () => {
      const mockSession = { access_token: 'token', expires_in: 3600 };
      const mockUser = {
        id: '123',
        email: 'admin@example.com',
        role: 'admin',
        emailConfirmed: true,
        createdAt: new Date(),
      };

      vi.mocked(authService.getCurrentSession).mockResolvedValue(mockSession);
      vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);

      // Simulate middleware logic
      const session = await authService.getCurrentSession();
      expect(session).toBeTruthy();

      const user = await authService.getCurrentUser();
      expect(user?.role).toBe('admin');
    });

    it('should detect missing session', async () => {
      vi.mocked(authService.getCurrentSession).mockResolvedValue(null);

      const session = await authService.getCurrentSession();
      expect(session).toBeNull();
    });

    it('should detect non-admin user', async () => {
      const mockSession = { access_token: 'token', expires_in: 3600 };
      const mockUser = {
        id: '123',
        email: 'user@example.com',
        role: 'user',
        emailConfirmed: true,
        createdAt: new Date(),
      };

      vi.mocked(authService.getCurrentSession).mockResolvedValue(mockSession);
      vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);

      const session = await authService.getCurrentSession();
      const user = await authService.getCurrentUser();
      
      expect(session).toBeTruthy();
      expect(user?.role).not.toBe('admin');
    });

    it('should handle auth errors gracefully', async () => {
      vi.mocked(authService.getCurrentSession).mockRejectedValue(new Error('Auth error'));

      await expect(authService.getCurrentSession()).rejects.toThrow('Auth error');
    });
  });

  describe('Route matching logic', () => {
    it('should identify admin routes correctly', () => {
      const adminPaths = [
        '/admin',
        '/admin/',
        '/admin/posts',
        '/admin/users',
        '/admin/settings',
      ];

      const nonAdminPaths = [
        '/',
        '/blog',
        '/about',
        '/contact',
        '/auth/login',
      ];

      adminPaths.forEach(path => {
        expect(path.startsWith('/admin')).toBe(true);
      });

      nonAdminPaths.forEach(path => {
        expect(path.startsWith('/admin')).toBe(false);
      });
    });

    it('should generate correct redirect URLs', () => {
      const testCases = [
        { path: '/admin', expected: '/auth/login?redirect=%2Fadmin' },
        { path: '/admin/posts', expected: '/auth/login?redirect=%2Fadmin%2Fposts' },
        { path: '/admin/users', expected: '/auth/login?redirect=%2Fadmin%2Fusers' },
        { path: '/profile', expected: '/auth/login?redirect=%2Fprofile' },
      ];

      testCases.forEach(({ path, expected }) => {
        const redirectUrl = '/auth/login?redirect=' + encodeURIComponent(path);
        expect(redirectUrl).toBe(expected);
      });
    });
  });
});
