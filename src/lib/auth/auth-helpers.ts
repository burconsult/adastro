import { supabase, supabaseAdmin, isSupabaseAdminConfigured } from '../supabase.js';
import { DatabaseError, ValidationError } from '../database/connection.js';
import type { User, Session, AuthError } from '@supabase/supabase-js';

const ACCESS_TOKEN_COOKIE = 'sb-access-token';

function getAccessTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [rawName, ...rest] = cookie.trim().split('=');
    if (!rawName || rawName !== ACCESS_TOKEN_COOKIE) continue;
    const rawValue = rest.join('=');
    return rawValue ? decodeURIComponent(rawValue) : null;
  }

  return null;
}

export interface AuthUser {
  id: string;
  email: string;
  role?: string;
  authorId?: string;
  emailConfirmed: boolean;
  lastSignInAt?: Date;
  createdAt: Date;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials {
  email: string;
  password: string;
  name?: string;
  role?: string;
}

export interface ResetPasswordCredentials {
  email: string;
}

export interface ResetPasswordOptions {
  siteUrl?: string;
}

export interface UpdatePasswordCredentials {
  password: string;
}

export class AuthService {
  // Sign up a new user
  async signUp(credentials: SignUpCredentials): Promise<{ user: AuthUser | null; needsConfirmation: boolean }> {
    try {
      const fallbackSiteUrl = typeof window !== 'undefined'
        ? window.location.origin
        : undefined;
      const siteUrl = import.meta.env.SITE_URL || fallbackSiteUrl;

      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            name: credentials.name || '',
          },
          ...(siteUrl ? { emailRedirectTo: `${siteUrl}/auth/callback` } : {}),
        }
      });

      if (error) {
        throw this.handleAuthError(error);
      }

      const user = data.user ? this.mapUser(data.user) : null;
      const needsConfirmation = !data.session; // No session means email confirmation needed

      if (user && credentials.role) {
        try {
          await this.setUserRole(user.id, credentials.role);
        } catch (roleError) {
          console.warn('Failed to assign role during sign up:', roleError);
        }
      }

      return { user, needsConfirmation };
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Sign up failed: ${error}`);
    }
  }

  // Sign in an existing user
  async signIn(credentials: SignInCredentials): Promise<{ user: AuthUser; session: Session }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        throw this.handleAuthError(error);
      }

      if (!data.user || !data.session) {
        throw new ValidationError('Invalid credentials');
      }

      const mapped = this.mapUser(data.user);
      const authorId = await this.resolveAuthorIdForUser(data.user.id);

      return {
        user: {
          ...mapped,
          authorId
        },
        session: data.session,
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Sign in failed: ${error}`);
    }
  }

  // Sign out the current user
  async signOut(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw this.handleAuthError(error);
      }
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Sign out failed: ${error}`);
    }
  }

  // Get the current user
  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        throw this.handleAuthError(error);
      }

      if (!user) {
        return null;
      }

      const mapped = this.mapUser(user);
      const authorId = await this.resolveAuthorIdForUser(user.id);

      return {
        ...mapped,
        authorId
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Get current user failed: ${error}`);
    }
  }

  // Get the current session
  async getCurrentSession(): Promise<Session | null> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        throw this.handleAuthError(error);
      }

      return session;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Get current session failed: ${error}`);
    }
  }

  async getUserFromRequest(request: Request): Promise<AuthUser | null> {
    try {
      if (!isSupabaseAdminConfigured) {
        return null;
      }

      const token = getAccessTokenFromRequest(request);
      if (!token) {
        return null;
      }

      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data.user) {
        return null;
      }

      const mapped = this.mapUser(data.user);
      const authorId = await this.resolveAuthorIdForUser(data.user.id);

      return {
        ...mapped,
        authorId
      };
    } catch (error) {
      return null;
    }
  }

  // Request password reset
  async resetPassword(
    credentials: ResetPasswordCredentials,
    options?: ResetPasswordOptions
  ): Promise<void> {
    try {
      const configuredSiteUrl = options?.siteUrl || (import.meta.env.SITE_URL as string | undefined);
      const fallbackSiteUrl = configuredSiteUrl && configuredSiteUrl.trim().length > 0
        ? configuredSiteUrl.trim()
        : undefined;
      const redirectTo = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/reset-password`
        : fallbackSiteUrl
          ? `${fallbackSiteUrl}/auth/reset-password`
          : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(credentials.email, {
        ...(redirectTo ? { redirectTo } : {}),
      });

      if (error) {
        throw this.handleAuthError(error);
      }
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Password reset failed: ${error}`);
    }
  }

  // Update user password
  async updatePassword(credentials: UpdatePasswordCredentials): Promise<AuthUser> {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: credentials.password,
      });

      if (error) {
        throw this.handleAuthError(error);
      }

      if (!data.user) {
        throw new ValidationError('Failed to update password');
      }

      return this.mapUser(data.user);
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Update password failed: ${error}`);
    }
  }

  // Refresh the current session
  async refreshSession(): Promise<{ user: AuthUser; session: Session } | null> {
    try {
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        throw this.handleAuthError(error);
      }

      if (!data.user || !data.session) {
        return null;
      }

      const mapped = this.mapUser(data.user);
      const authorId = await this.resolveAuthorIdForUser(data.user.id);

      return {
        user: {
          ...mapped,
          authorId
        },
        session: data.session,
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Refresh session failed: ${error}`);
    }
  }

  // Admin: Get user by ID
  async getUserById(userId: string): Promise<AuthUser | null> {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

      if (error) {
        throw this.handleAuthError(error);
      }

      if (!data.user) {
        return null;
      }

      const mapped = this.mapUser(data.user);
      const authorId = await this.resolveAuthorIdForUser(data.user.id);

      return {
        ...mapped,
        authorId
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Get user by ID failed: ${error}`);
    }
  }

  // Admin: List users
  async listUsers(page = 1, perPage = 50): Promise<{ users: AuthUser[]; total: number }> {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        throw this.handleAuthError(error);
      }

      const users = await Promise.all(
        data.users.map(async (user) => {
          const mapped = this.mapUser(user);
          const authorId = await this.resolveAuthorIdForUser(user.id);
          return {
            ...mapped,
            authorId
          };
        })
      );

      return {
        users,
        total: data.total || 0,
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`List users failed: ${error}`);
    }
  }

  // Admin: Delete user
  async deleteUser(userId: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (error) {
        throw this.handleAuthError(error);
      }
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Delete user failed: ${error}`);
    }
  }

  async setUserRole(userId: string, roleName: string): Promise<void> {
    const normalizedRole = roleName?.trim().toLowerCase();
    if (!normalizedRole || !['admin', 'author', 'reader'].includes(normalizedRole)) {
      throw new ValidationError('Unsupported role');
    }

    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: {
        role: normalizedRole
      }
    });

    if (metadataError) {
      throw new DatabaseError(`Failed to update role metadata: ${metadataError.message}`);
    }
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getCurrentSession();
    return session !== null;
  }

  // Check if user has admin role
  async isAdmin(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user?.role === 'admin';
  }

  // Listen to auth state changes
  onAuthStateChange(callback: (user: AuthUser | null, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ? this.mapUser(session.user) : null;
      callback(user, session);
    });
  }

  private mapUser(user: User): AuthUser {
    const rawRole = user.app_metadata?.role ?? user.user_metadata?.role;
    return {
      id: user.id,
      email: user.email || '',
      role: this.normalizeRole(rawRole),
      authorId: undefined,
      emailConfirmed: user.email_confirmed_at !== null,
      lastSignInAt: user.last_sign_in_at ? new Date(user.last_sign_in_at) : undefined,
      createdAt: new Date(user.created_at),
    };
  }

  private normalizeRole(role?: string): 'admin' | 'author' | 'reader' {
    const normalized = typeof role === 'string' ? role.trim().toLowerCase() : '';
    if (normalized === 'admin' || normalized === 'author' || normalized === 'reader') {
      return normalized;
    }
    return 'reader';
  }

  private async resolveAuthorIdForUser(userId: string): Promise<string | undefined> {
    try {
      const { data: author } = await supabaseAdmin
        .from('authors')
        .select('id')
        .eq('auth_user_id', userId)
        .maybeSingle();

      return author?.id;
    } catch (error) {
      return undefined;
    }
  }

  private handleAuthError(error: AuthError): DatabaseError {
    switch (error.message) {
      case 'Invalid login credentials':
        return new ValidationError('Invalid email or password');
      case 'Email not confirmed':
        return new ValidationError('Please confirm your email address');
      case 'User already registered':
        return new ValidationError('User with this email already exists');
      case 'Password should be at least 6 characters':
        return new ValidationError('Password must be at least 6 characters long');
      default:
        return new DatabaseError(error.message, error.status?.toString());
    }
  }
}

// Singleton instance
export const authService = new AuthService();

// Utility functions for common auth operations
export async function requireAuth(request?: Request): Promise<AuthUser> {
  const user = request
    ? await authService.getUserFromRequest(request)
    : await authService.getCurrentUser();
  if (!user) {
    throw new ValidationError('Authentication required');
  }
  return user;
}

export async function requireAdmin(request?: Request): Promise<AuthUser> {
  const user = await requireAuth(request);
  if (user.role !== 'admin') {
    throw new ValidationError('Admin access required');
  }
  return user;
}

export async function requireAuthor(request?: Request): Promise<AuthUser> {
  const user = await requireAuth(request);
  if (user.role !== 'admin' && user.role !== 'author') {
    throw new ValidationError('Author access required');
  }
  return user;
}

export async function getAuthenticatedUser(request?: Request): Promise<AuthUser | null> {
  return request
    ? authService.getUserFromRequest(request)
    : authService.getCurrentUser();
}

// Legacy function for backward compatibility
export async function validateAuthUser(request?: Request): Promise<AuthUser | null> {
  try {
    return request
      ? await authService.getUserFromRequest(request)
      : await authService.getCurrentUser();
  } catch (error) {
    return null;
  }
}
