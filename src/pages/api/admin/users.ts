import type { APIRoute } from 'astro';
import { authService, requireAdmin } from '@/lib/auth/auth-helpers';
import { UserProfileRepository } from '@/lib/database/repositories/user-profile-repository';
import type { AuthUser } from '@/lib/auth/auth-helpers';

type UserListProfile = {
  fullName: string;
  bio: string;
  avatarUrl: string;
  avatarSource: 'custom' | 'gravatar';
};

type UserListItem = {
  id: string;
  email: string;
  role: 'admin' | 'author' | 'reader';
  authorId: string | null;
  emailConfirmed: boolean;
  lastSignInAt: string | null;
  createdAt: string;
  profile: UserListProfile;
};

const profileRepository = new UserProfileRepository(true);

const toJson = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

const normalizeRole = (role: string | undefined): 'admin' | 'author' | 'reader' => {
  if (role === 'admin' || role === 'author' || role === 'reader') {
    return role;
  }
  return 'reader';
};

const parseQueryInt = (value: string | null, fallback: number, min: number, max: number) => {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const mapUser = async (user: AuthUser): Promise<UserListItem> => {
  const profile = await profileRepository.findByAuthUserId(user.id);
  return {
    id: user.id,
    email: user.email,
    role: normalizeRole(user.role),
    authorId: user.authorId ?? null,
    emailConfirmed: user.emailConfirmed,
    lastSignInAt: user.lastSignInAt ? user.lastSignInAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    profile: {
      fullName: profile?.fullName || '',
      bio: profile?.bio || '',
      avatarUrl: profile?.avatarUrl || '',
      avatarSource: profile?.avatarSource === 'custom' ? 'custom' : 'gravatar'
    }
  };
};

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);

    const url = new URL(request.url);
    const page = parseQueryInt(url.searchParams.get('page'), 1, 1, 200);
    const perPage = parseQueryInt(url.searchParams.get('perPage'), 100, 1, 200);
    const result = await authService.listUsers(page, perPage);
    const users = await Promise.all(result.users.map((user) => mapUser(user)));

    return toJson({
      users,
      total: result.total,
      page,
      perPage
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Authentication required')) {
        return toJson({ error: 'Authentication required' }, 401);
      }
      if (error.message.includes('Admin access required')) {
        return toJson({ error: 'Admin access required' }, 403);
      }
    }

    console.error('List admin users API error:', error);
    return toJson({ error: 'Failed to load users' }, 500);
  }
};
