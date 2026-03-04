import type { APIRoute } from 'astro';
import { authService } from '@/lib/auth/auth-helpers';
import { ensureAuthorProfileForAuthUser } from '@/lib/auth/author-provisioning';
import { AuthorRepository } from '@/lib/database/repositories/author-repository';
import { UserProfileRepository } from '@/lib/database/repositories/user-profile-repository';
import { supabaseAdmin } from '@/lib/supabase';

const VALID_ROLES = new Set(['admin', 'author', 'reader']);
const VALID_AVATAR_SOURCES = new Set(['custom', 'gravatar']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const profileRepository = new UserProfileRepository(true);
const authorRepository = new AuthorRepository(true);

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

const resolveAdmin = async (request: Request) => {
  const currentUser = await authService.getUserFromRequest(request);
  if (!currentUser || currentUser.role !== 'admin') {
    return null;
  }
  return currentUser;
};

const hasOwn = (value: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

const normalizeRole = (value: string | undefined): 'admin' | 'author' | 'reader' => {
  if (value === 'admin' || value === 'author' || value === 'reader') {
    return value;
  }
  return 'reader';
};

const sanitizeText = (value: unknown, maxLength: number) => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
};

const buildUserPayload = async (userId: string) => {
  const user = await authService.getUserById(userId);
  if (!user) return null;

  const profile = await profileRepository.findByAuthUserId(userId);
  return {
    id: user.id,
    email: user.email,
    role: normalizeRole(user.role),
    authorId: user.authorId ?? null,
    emailConfirmed: user.emailConfirmed,
    createdAt: user.createdAt.toISOString(),
    lastSignInAt: user.lastSignInAt ? user.lastSignInAt.toISOString() : null,
    profile: {
      fullName: profile?.fullName || '',
      bio: profile?.bio || '',
      avatarSource: profile?.avatarSource === 'custom' ? 'custom' : 'gravatar',
      avatarUrl: profile?.avatarUrl || ''
    }
  };
};

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const currentUser = await resolveAdmin(request);
    if (!currentUser) {
      return json({ error: 'Admin access required' }, 403);
    }

    const userId = params.id;
    if (!userId) {
      return json({ error: 'User ID is required' }, 400);
    }

    const payload = await request.json().catch(() => null);
    const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};

    const hasRole = hasOwn(body, 'role');
    const hasEmail = hasOwn(body, 'email');
    const hasFullName = hasOwn(body, 'fullName');
    const hasBio = hasOwn(body, 'bio');
    const hasAvatarSource = hasOwn(body, 'avatarSource');
    const hasAvatarUrl = hasOwn(body, 'avatarUrl');
    const hasEmailConfirmed = hasOwn(body, 'emailConfirmed');

    if (!hasRole && !hasEmail && !hasFullName && !hasBio && !hasAvatarSource && !hasAvatarUrl && !hasEmailConfirmed) {
      return json({ error: 'No editable fields provided' }, 400);
    }

    const targetUser = await authService.getUserById(userId);
    if (!targetUser) {
      return json({ error: 'User not found' }, 404);
    }

    const roleFromPayload = hasRole && typeof body.role === 'string'
      ? body.role.trim().toLowerCase()
      : '';
    if (hasRole && !VALID_ROLES.has(roleFromPayload)) {
      return json({ error: 'Invalid role' }, 400);
    }
    const nextRole = hasRole ? roleFromPayload : normalizeRole(targetUser.role);

    if (userId === currentUser.id && nextRole !== 'admin') {
      return json({ error: 'Cannot remove your own admin access' }, 400);
    }

    const normalizedEmail = hasEmail ? sanitizeText(body.email, 254).toLowerCase() : '';
    if (hasEmail && (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail))) {
      return json({ error: 'Invalid email' }, 400);
    }

    if (hasEmailConfirmed && typeof body.emailConfirmed !== 'boolean') {
      return json({ error: 'Invalid email confirmation value' }, 400);
    }

    const fullName = hasFullName ? sanitizeText(body.fullName, 120) : '';
    const bio = hasBio ? sanitizeText(body.bio, 500) : '';
    const avatarSource = hasAvatarSource && typeof body.avatarSource === 'string'
      ? body.avatarSource.trim().toLowerCase()
      : '';
    if (hasAvatarSource && !VALID_AVATAR_SOURCES.has(avatarSource)) {
      return json({ error: 'Invalid avatar source' }, 400);
    }
    const avatarUrl = hasAvatarUrl ? sanitizeText(body.avatarUrl, 400) : '';

    const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authUserError || !authUserData.user) {
      return json({ error: 'User not found' }, 404);
    }

    const currentAuthUser = authUserData.user;
    const authUpdate: {
      email?: string;
      email_confirm?: boolean;
      app_metadata?: Record<string, unknown>;
      user_metadata?: Record<string, unknown>;
    } = {};

    if (hasRole) {
      const existingAppMetadata = (
        currentAuthUser.app_metadata &&
        typeof currentAuthUser.app_metadata === 'object' &&
        !Array.isArray(currentAuthUser.app_metadata)
      ) ? currentAuthUser.app_metadata as Record<string, unknown> : {};
      authUpdate.app_metadata = {
        ...existingAppMetadata,
        role: nextRole
      };
    }

    if (hasEmail && normalizedEmail !== (currentAuthUser.email || '').trim().toLowerCase()) {
      authUpdate.email = normalizedEmail;
    }

    if (hasEmailConfirmed) {
      authUpdate.email_confirm = body.emailConfirmed as boolean;
    }

    if (hasFullName) {
      const existingUserMetadata = (
        currentAuthUser.user_metadata &&
        typeof currentAuthUser.user_metadata === 'object' &&
        !Array.isArray(currentAuthUser.user_metadata)
      ) ? currentAuthUser.user_metadata as Record<string, unknown> : {};
      authUpdate.user_metadata = {
        ...existingUserMetadata,
        full_name: fullName || null,
        name: fullName || null
      };
    }

    if (Object.keys(authUpdate).length > 0) {
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdate);
      if (authUpdateError) {
        return json({ error: 'Failed to update user account' }, 500);
      }
    }

    let resolvedAvatarSource: 'custom' | 'gravatar' | undefined;
    let resolvedAvatarUrl: string | undefined;
    if (hasFullName || hasBio || hasAvatarSource || hasAvatarUrl) {
      const existingProfile = await profileRepository.findByAuthUserId(userId);
      resolvedAvatarSource = (hasAvatarSource ? avatarSource : existingProfile?.avatarSource) === 'custom' ? 'custom' : 'gravatar';
      resolvedAvatarUrl = resolvedAvatarSource === 'custom'
        ? (hasAvatarUrl ? avatarUrl : existingProfile?.avatarUrl || '')
        : '';

      await profileRepository.upsertByAuthUserId(userId, {
        fullName: hasFullName ? fullName : existingProfile?.fullName || '',
        bio: hasBio ? bio : existingProfile?.bio || '',
        avatarSource: resolvedAvatarSource,
        avatarUrl: resolvedAvatarUrl
      });
    }

    const existingAuthor = await authorRepository.findByAuthUserId(userId);
    if (existingAuthor) {
      const authorUpdates: {
        email?: string;
        name?: string;
        bio?: string;
        avatarUrl?: string;
      } = {};

      if (hasEmail) {
        authorUpdates.email = normalizedEmail;
      }
      if (hasFullName && fullName) {
        authorUpdates.name = fullName;
      }
      if (hasBio) {
        authorUpdates.bio = bio;
      }
      if (resolvedAvatarSource) {
        authorUpdates.avatarUrl = resolvedAvatarSource === 'custom' ? (resolvedAvatarUrl || '') : '';
      }

      if (Object.keys(authorUpdates).length > 0) {
        await authorRepository.update(existingAuthor.id, authorUpdates);
      }
    }

    if (nextRole === 'admin' || nextRole === 'author') {
      try {
        await ensureAuthorProfileForAuthUser(userId);
      } catch (authorProvisionError) {
        console.warn('Update user API author provisioning warning:', authorProvisionError);
      }
    }

    const user = await buildUserPayload(userId);
    if (!user) {
      return json({ error: 'User not found' }, 404);
    }

    return json({ success: true, user });
  } catch (error) {
    console.error('Update user API error:', error);
    return json({ error: 'Failed to update user' }, 500);
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    const currentUser = await resolveAdmin(request);
    if (!currentUser) {
      return json({ error: 'Admin access required' }, 403);
    }

    const userId = params.id;
    if (!userId) {
      return json({ error: 'User ID is required' }, 400);
    }

    if (userId === currentUser.id) {
      return json({ error: 'Cannot delete your own account' }, 400);
    }

    const userToDelete = await authService.getUserById(userId);
    if (!userToDelete) {
      return json({ error: 'User not found' }, 404);
    }

    if (userToDelete.role === 'admin') {
      return json({ error: 'Cannot delete admin users' }, 400);
    }

    await authService.deleteUser(userId);

    return json({ success: true });
  } catch (error) {
    console.error('Delete user API error:', error);
    return json({ error: 'Failed to delete user' }, 500);
  }
};
