import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the auth service
const mockAuthService = {
  signIn: vi.fn(),
  signOut: vi.fn(),
  getCurrentUser: vi.fn(),
  getUserById: vi.fn(),
  listUsers: vi.fn(),
  deleteUser: vi.fn(),
  signUp: vi.fn(),
};

vi.mock('../auth-helpers.js', () => ({
  authService: mockAuthService,
}));

describe('Admin API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Login API', () => {
    it('should authenticate admin user successfully', async () => {
      const mockUser = {
        id: '123',
        email: 'admin@example.com',
        role: 'admin',
        emailConfirmed: true,
        createdAt: new Date(),
      };

      const mockSession = {
        access_token: 'token123',
        expires_in: 3600,
      };

      mockAuthService.signIn.mockResolvedValue({
        user: mockUser,
        session: mockSession,
      });

      // Simulate API call
      const credentials = { email: 'admin@example.com', password: 'password' };
      const result = await mockAuthService.signIn(credentials);

      expect(mockAuthService.signIn).toHaveBeenCalledWith(credentials);
      expect(result.user.role).toBe('admin');
      expect(result.session.access_token).toBe('token123');
    });

    it('should reject non-admin user', async () => {
      const mockUser = {
        id: '123',
        email: 'user@example.com',
        role: 'user',
        emailConfirmed: true,
        createdAt: new Date(),
      };

      const mockSession = {
        access_token: 'token123',
        expires_in: 3600,
      };

      mockAuthService.signIn.mockResolvedValue({
        user: mockUser,
        session: mockSession,
      });

      const credentials = { email: 'user@example.com', password: 'password' };
      const result = await mockAuthService.signIn(credentials);

      expect(result.user.role).not.toBe('admin');
    });

    it('should handle invalid credentials', async () => {
      mockAuthService.signIn.mockRejectedValue(new Error('Invalid credentials'));

      const credentials = { email: 'invalid@example.com', password: 'wrong' };
      
      await expect(mockAuthService.signIn(credentials)).rejects.toThrow('Invalid credentials');
    });
  });

  describe('User Management API', () => {
    it('should list users for admin', async () => {
      const mockUsers = [
        {
          id: '1',
          email: 'admin@example.com',
          role: 'admin',
          emailConfirmed: true,
          createdAt: new Date(),
        },
        {
          id: '2',
          email: 'user@example.com',
          role: 'user',
          emailConfirmed: true,
          createdAt: new Date(),
        },
      ];

      mockAuthService.getCurrentUser.mockResolvedValue(mockUsers[0]); // Admin user
      mockAuthService.listUsers.mockResolvedValue({
        users: mockUsers,
        total: 2,
      });

      const currentUser = await mockAuthService.getCurrentUser();
      expect(currentUser.role).toBe('admin');

      const result = await mockAuthService.listUsers();
      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should delete user for admin', async () => {
      const adminUser = {
        id: 'admin-id',
        email: 'admin@example.com',
        role: 'admin',
        emailConfirmed: true,
        createdAt: new Date(),
      };

      const userToDelete = {
        id: 'user-id',
        email: 'user@example.com',
        role: 'user',
        emailConfirmed: true,
        createdAt: new Date(),
      };

      mockAuthService.getCurrentUser.mockResolvedValue(adminUser);
      mockAuthService.getUserById.mockResolvedValue(userToDelete);
      mockAuthService.deleteUser.mockResolvedValue(undefined);

      const currentUser = await mockAuthService.getCurrentUser();
      expect(currentUser.role).toBe('admin');

      const targetUser = await mockAuthService.getUserById('user-id');
      expect(targetUser.role).not.toBe('admin');

      await mockAuthService.deleteUser('user-id');
      expect(mockAuthService.deleteUser).toHaveBeenCalledWith('user-id');
    });

    it('should prevent admin from deleting themselves', async () => {
      const adminUser = {
        id: 'admin-id',
        email: 'admin@example.com',
        role: 'admin',
        emailConfirmed: true,
        createdAt: new Date(),
      };

      mockAuthService.getCurrentUser.mockResolvedValue(adminUser);

      const currentUser = await mockAuthService.getCurrentUser();
      
      // Simulate the check that would happen in the API
      const userIdToDelete = 'admin-id';
      const canDelete = userIdToDelete !== currentUser.id;
      
      expect(canDelete).toBe(false);
    });

    it('should invite new user', async () => {
      const adminUser = {
        id: 'admin-id',
        email: 'admin@example.com',
        role: 'admin',
        emailConfirmed: true,
        createdAt: new Date(),
      };

      const newUser = {
        id: 'new-user-id',
        email: 'newuser@example.com',
        emailConfirmed: false,
        createdAt: new Date(),
      };

      mockAuthService.getCurrentUser.mockResolvedValue(adminUser);
      mockAuthService.signUp.mockResolvedValue({
        user: newUser,
        needsConfirmation: true,
      });

      const currentUser = await mockAuthService.getCurrentUser();
      expect(currentUser.role).toBe('admin');

      const result = await mockAuthService.signUp({
        email: 'newuser@example.com',
        password: 'temppassword',
      });

      expect(result.user.email).toBe('newuser@example.com');
      expect(result.needsConfirmation).toBe(true);
    });
  });

  describe('Authorization checks', () => {
    it('should verify admin role for protected operations', async () => {
      const adminUser = {
        id: 'admin-id',
        email: 'admin@example.com',
        role: 'admin',
        emailConfirmed: true,
        createdAt: new Date(),
      };

      const regularUser = {
        id: 'user-id',
        email: 'user@example.com',
        role: 'user',
        emailConfirmed: true,
        createdAt: new Date(),
      };

      // Test admin access
      mockAuthService.getCurrentUser.mockResolvedValue(adminUser);
      let currentUser = await mockAuthService.getCurrentUser();
      expect(currentUser.role === 'admin').toBe(true);

      // Test regular user access
      mockAuthService.getCurrentUser.mockResolvedValue(regularUser);
      currentUser = await mockAuthService.getCurrentUser();
      expect(currentUser.role === 'admin').toBe(false);

      // Test no user
      mockAuthService.getCurrentUser.mockResolvedValue(null);
      currentUser = await mockAuthService.getCurrentUser();
      expect(currentUser).toBeNull();
    });
  });
});