import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService, requireAuth, requireAdmin } from '../auth-helpers.js';
import { ValidationError } from '../../database/connection.js';

// Mock Supabase
vi.mock('../../supabase.js', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
  supabaseAdmin: {
    auth: {
      admin: {
        getUserById: vi.fn(),
        listUsers: vi.fn(),
        deleteUser: vi.fn(),
      },
    },
  },
}));

describe('Admin Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requireAuth', () => {
    it('should return user when authenticated', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        role: 'admin',
        emailConfirmed: true,
        createdAt: new Date(),
      };

      vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockUser);

      const result = await requireAuth();
      expect(result).toEqual(mockUser);
    });

    it('should throw ValidationError when not authenticated', async () => {
      vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(null);

      await expect(requireAuth()).rejects.toThrow(ValidationError);
      await expect(requireAuth()).rejects.toThrow('Authentication required');
    });
  });

  describe('requireAdmin', () => {
    it('should return user when user is admin', async () => {
      const mockAdminUser = {
        id: '123',
        email: 'admin@example.com',
        role: 'admin',
        emailConfirmed: true,
        createdAt: new Date(),
      };

      vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockAdminUser);

      const result = await requireAdmin();
      expect(result).toEqual(mockAdminUser);
    });

    it('should throw ValidationError when user is not admin', async () => {
      const mockUser = {
        id: '123',
        email: 'user@example.com',
        role: 'user',
        emailConfirmed: true,
        createdAt: new Date(),
      };

      vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockUser);

      await expect(requireAdmin()).rejects.toThrow(ValidationError);
      await expect(requireAdmin()).rejects.toThrow('Admin access required');
    });

    it('should throw ValidationError when user has no role', async () => {
      const mockUser = {
        id: '123',
        email: 'user@example.com',
        emailConfirmed: true,
        createdAt: new Date(),
      };

      vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockUser);

      await expect(requireAdmin()).rejects.toThrow(ValidationError);
      await expect(requireAdmin()).rejects.toThrow('Admin access required');
    });

    it('should throw ValidationError when not authenticated', async () => {
      vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(null);

      await expect(requireAdmin()).rejects.toThrow(ValidationError);
      await expect(requireAdmin()).rejects.toThrow('Authentication required');
    });
  });

  describe('AuthService admin methods', () => {
    it('should check if user is admin', async () => {
      const mockAdminUser = {
        id: '123',
        email: 'admin@example.com',
        role: 'admin',
        emailConfirmed: true,
        createdAt: new Date(),
      };

      vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockAdminUser);

      const isAdmin = await authService.isAdmin();
      expect(isAdmin).toBe(true);
    });

    it('should return false for non-admin user', async () => {
      const mockUser = {
        id: '123',
        email: 'user@example.com',
        role: 'user',
        emailConfirmed: true,
        createdAt: new Date(),
      };

      vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockUser);

      const isAdmin = await authService.isAdmin();
      expect(isAdmin).toBe(false);
    });

    it('should return false when not authenticated', async () => {
      vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(null);

      const isAdmin = await authService.isAdmin();
      expect(isAdmin).toBe(false);
    });
  });
});