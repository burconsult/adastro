import type { APIRoute } from 'astro';
import { authService } from '../../../../lib/auth/auth-helpers.js';
import { ensureAuthorProfileForAuthUser } from '../../../../lib/auth/author-provisioning.js';

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

const VALID_ROLES = new Set(['admin', 'author', 'reader']);

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
    const role = typeof payload?.role === 'string' ? payload.role.trim().toLowerCase() : '';

    if (!VALID_ROLES.has(role)) {
      return json({ error: 'Invalid role' }, 400);
    }

    if (userId === currentUser.id && role !== 'admin') {
      return json({ error: 'Cannot remove your own admin access' }, 400);
    }

    const targetUser = await authService.getUserById(userId);
    if (!targetUser) {
      return json({ error: 'User not found' }, 404);
    }

    await authService.setUserRole(userId, role);
    if (role === 'admin' || role === 'author') {
      try {
        await ensureAuthorProfileForAuthUser(userId);
      } catch (authorProvisionError) {
        console.warn('Update user role API author provisioning warning:', authorProvisionError);
      }
    }

    return json({ success: true, role });
  } catch (error) {
    console.error('Update user role API error:', error);
    return json({ error: 'Failed to update user role' }, 500);
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
