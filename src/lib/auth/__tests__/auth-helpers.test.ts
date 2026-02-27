import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService, authService } from '../auth-helpers.js';
import { ValidationError, DatabaseError } from '../../database/connection.js';

// Mock Supabase client
vi.mock('../../supabase.js', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn(),
      getSession: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      refreshSession: vi.fn(),
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

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    vi.clearAllMocks();
  });

  describe('signUp', () => {
    it('should sign up user successfully', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        email_confirmed_at: null,
        created_at: '2023-01-01T00:00:00Z',
        last_sign_in_at: null,
        user_metadata: { name: 'Test User' },
        app_metadata: {},
      };

      const { supabase } = await import('../../supabase.js');
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: mockUser, session: null },
        error: null,
      });

      const result = await service.signUp({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe('test@example.com');
      expect(result.needsConfirmation).toBe(true);
      const signUpPayload = vi.mocked(supabase.auth.signUp).mock.calls[0]?.[0];
      expect(signUpPayload).toMatchObject({
        email: 'test@example.com',
        password: 'password123',
        options: {
          data: { name: 'Test User' },
        },
      });

      if (signUpPayload?.options?.emailRedirectTo) {
        expect(signUpPayload.options.emailRedirectTo).toMatch(/\/auth\/callback$/);
      }
    });

    it('should handle sign up errors', async () => {
      const { supabase } = await import('../../supabase.js');
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      });

      await expect(
        service.signUp({
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('signIn', () => {
    it('should sign in user successfully', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        email_confirmed_at: '2023-01-01T00:00:00Z',
        created_at: '2023-01-01T00:00:00Z',
        last_sign_in_at: '2023-01-01T00:00:00Z',
        user_metadata: {},
        app_metadata: {},
      };

      const mockSession = {
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user: mockUser,
      };

      const { supabase } = await import('../../supabase.js');
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await service.signIn({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(result.session).toBeDefined();
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should handle invalid credentials', async () => {
      const { supabase } = await import('../../supabase.js');
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      await expect(
        service.signIn({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('signOut', () => {
    it('should sign out successfully', async () => {
      const { supabase } = await import('../../supabase.js');
      vi.mocked(supabase.auth.signOut).mockResolvedValue({
        error: null,
      });

      await expect(service.signOut()).resolves.not.toThrow();
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });

    it('should handle sign out errors', async () => {
      const { supabase } = await import('../../supabase.js');
      vi.mocked(supabase.auth.signOut).mockResolvedValue({
        error: { message: 'Sign out failed' },
      });

      await expect(service.signOut()).rejects.toThrow(DatabaseError);
    });
  });

  describe('getCurrentUser', () => {
    it('should get current user successfully', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        email_confirmed_at: '2023-01-01T00:00:00Z',
        created_at: '2023-01-01T00:00:00Z',
        last_sign_in_at: '2023-01-01T00:00:00Z',
        user_metadata: {},
        app_metadata: { role: 'admin' },
      };

      const { supabase } = await import('../../supabase.js');
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const user = await service.getCurrentUser();

      expect(user).toBeDefined();
      expect(user?.email).toBe('test@example.com');
      expect(user?.role).toBe('admin');
      expect(user?.emailConfirmed).toBe(true);
    });

    it('should return null when no user is authenticated', async () => {
      const { supabase } = await import('../../supabase.js');
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const user = await service.getCurrentUser();
      expect(user).toBeNull();
    });
  });

  describe('getCurrentSession', () => {
    it('should get current session successfully', async () => {
      const mockSession = {
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: '123',
          email: 'test@example.com',
          email_confirmed_at: '2023-01-01T00:00:00Z',
          created_at: '2023-01-01T00:00:00Z',
          last_sign_in_at: '2023-01-01T00:00:00Z',
          user_metadata: {},
          app_metadata: {},
        },
      };

      const { supabase } = await import('../../supabase.js');
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const session = await service.getCurrentSession();
      expect(session).toBeDefined();
      expect(session?.access_token).toBe('token');
    });

    it('should return null when no session exists', async () => {
      const { supabase } = await import('../../supabase.js');
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const session = await service.getCurrentSession();
      expect(session).toBeNull();
    });
  });

  describe('resetPassword', () => {
    it('should request password reset successfully', async () => {
      const { supabase } = await import('../../supabase.js');
      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
        error: null,
      });

      await expect(
        service.resetPassword({ email: 'test@example.com' })
      ).resolves.not.toThrow();

      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/reset-password'),
        })
      );
    });
  });

  describe('updatePassword', () => {
    it('should update password successfully', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        email_confirmed_at: '2023-01-01T00:00:00Z',
        created_at: '2023-01-01T00:00:00Z',
        last_sign_in_at: '2023-01-01T00:00:00Z',
        user_metadata: {},
        app_metadata: {},
      };

      const { supabase } = await import('../../supabase.js');
      vi.mocked(supabase.auth.updateUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const user = await service.updatePassword({ password: 'newpassword123' });

      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'newpassword123',
      });
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when user is authenticated', async () => {
      const mockSession = {
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: '123',
          email: 'test@example.com',
          email_confirmed_at: '2023-01-01T00:00:00Z',
          created_at: '2023-01-01T00:00:00Z',
          last_sign_in_at: '2023-01-01T00:00:00Z',
          user_metadata: {},
          app_metadata: {},
        },
      };

      const { supabase } = await import('../../supabase.js');
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const isAuth = await service.isAuthenticated();
      expect(isAuth).toBe(true);
    });

    it('should return false when user is not authenticated', async () => {
      const { supabase } = await import('../../supabase.js');
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const isAuth = await service.isAuthenticated();
      expect(isAuth).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('should return true for admin user', async () => {
      const mockUser = {
        id: '123',
        email: 'admin@example.com',
        email_confirmed_at: '2023-01-01T00:00:00Z',
        created_at: '2023-01-01T00:00:00Z',
        last_sign_in_at: '2023-01-01T00:00:00Z',
        user_metadata: {},
        app_metadata: { role: 'admin' },
      };

      const { supabase } = await import('../../supabase.js');
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const isAdmin = await service.isAdmin();
      expect(isAdmin).toBe(true);
    });

    it('should return false for non-admin user', async () => {
      const mockUser = {
        id: '123',
        email: 'user@example.com',
        email_confirmed_at: '2023-01-01T00:00:00Z',
        created_at: '2023-01-01T00:00:00Z',
        last_sign_in_at: '2023-01-01T00:00:00Z',
        user_metadata: {},
        app_metadata: {},
      };

      const { supabase } = await import('../../supabase.js');
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const isAdmin = await service.isAdmin();
      expect(isAdmin).toBe(false);
    });
  });
});
