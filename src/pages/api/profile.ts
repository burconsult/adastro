import type { APIRoute } from 'astro';
import { createHash } from 'node:crypto';
import { requireAuth } from '../../lib/auth/auth-helpers.js';
import { AuthorRepository } from '../../lib/database/repositories/author-repository.js';
import { UserProfileRepository } from '../../lib/database/repositories/user-profile-repository.js';
import { getProfileApiExtensions } from '../../lib/features/runtime.js';

const profileRepo = new UserProfileRepository(true);
const authorRepo = new AuthorRepository(true);

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

const gravatarUrlForEmail = (email: string) => {
  if (!email) return null;
  const hash = createHash('md5').update(email.trim().toLowerCase()).digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=256`;
};

const sanitizeText = (value: unknown, limit: number) => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, limit);
};

const normalizeProfileData = (value: unknown): Record<string, any> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, any>) };
  }
  return {};
};

export const GET: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);
    let profile = await profileRepo.findByAuthUserId(user.id);
    if (!profile) {
      profile = await profileRepo.create({
        authUserId: user.id,
        fullName: '',
        bio: '',
        avatarSource: 'gravatar',
        data: {}
      });
    }

    let profileData = normalizeProfileData(profile.data);
    let featureFlags: Record<string, boolean> = {};

    for (const extension of getProfileApiExtensions()) {
      try {
        if (extension.getFeatureFlags) {
          const flags = await extension.getFeatureFlags({
            request,
            user,
            profileData
          });
          featureFlags = { ...featureFlags, ...flags };
        }
        if (extension.hydrateProfileData) {
          const hydrated = await extension.hydrateProfileData({
            request,
            user,
            profileData
          });
          if (hydrated) {
            profileData = normalizeProfileData(hydrated);
          }
        }
      } catch (extensionError) {
        console.error('Profile extension GET hook failed:', extensionError);
      }
    }

    return json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role || 'reader'
      },
      profile: {
        ...profile,
        data: profileData,
        gravatarUrl: gravatarUrlForEmail(user.email)
      },
      featureFlags
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication required')) {
      return json({ error: 'Authentication required' }, 401);
    }
    console.error('Profile fetch failed:', error);
    return json({ error: 'Failed to load profile' }, 500);
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);
    const payload = await request.json().catch(() => ({}));
    const fullName = sanitizeText(payload.fullName, 120);
    const bio = sanitizeText(payload.bio, 500);
    const avatarSource = payload.avatarSource === 'custom' ? 'custom' : 'gravatar';
    const avatarUrl = avatarSource === 'custom' ? sanitizeText(payload.avatarUrl, 400) : '';
    const normalizedAvatarUrl = avatarUrl || '';
    let data = normalizeProfileData(payload.data);

    const profile = await profileRepo.upsertByAuthUserId(user.id, {
      fullName,
      bio,
      avatarSource,
      avatarUrl: normalizedAvatarUrl || undefined,
      data
    });

    const author = await authorRepo.findByAuthUserId(user.id);
    if (author) {
      const avatarFromProfile = avatarSource === 'custom'
        ? normalizedAvatarUrl
        : gravatarUrlForEmail(user.email) || '';
      const updates: { name?: string; bio?: string; avatarUrl?: string } = {};
      if (fullName) updates.name = fullName;
      if (bio) updates.bio = bio;
      if (avatarFromProfile) updates.avatarUrl = avatarFromProfile;
      if (Object.keys(updates).length > 0) {
        await authorRepo.update(author.id, updates);
      }
    }

    for (const extension of getProfileApiExtensions()) {
      try {
        if (extension.afterProfileUpdate) {
          await extension.afterProfileUpdate({
            request,
            user,
            profileData: data
          });
        }
      } catch (extensionError) {
        console.error('Profile extension PUT hook failed:', extensionError);
      }
    }

    return json({
      profile: {
        ...profile,
        data,
        gravatarUrl: gravatarUrlForEmail(user.email)
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication required')) {
      return json({ error: 'Authentication required' }, 401);
    }
    console.error('Profile update failed:', error);
    return json({ error: 'Failed to update profile' }, 500);
  }
};
