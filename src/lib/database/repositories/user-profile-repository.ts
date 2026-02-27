import { BaseRepository } from '../base-repository.js';
import { ValidationError } from '../connection.js';
import type { UserProfile } from '../../types/index.js';
import type { Database } from '../../supabase.js';

type UserProfileRow = Database['public']['Tables']['user_profiles']['Row'];
type CreateUserProfileData = Database['public']['Tables']['user_profiles']['Insert'];
type UpdateUserProfileData = Database['public']['Tables']['user_profiles']['Update'];

export interface CreateUserProfile {
  authUserId: string;
  fullName?: string;
  bio?: string;
  avatarUrl?: string;
  avatarSource?: 'custom' | 'gravatar';
  data?: Record<string, any>;
}

export interface UpdateUserProfile {
  fullName?: string;
  bio?: string;
  avatarUrl?: string;
  avatarSource?: 'custom' | 'gravatar';
  data?: Record<string, any>;
}

export class UserProfileRepository extends BaseRepository<UserProfile, CreateUserProfile, UpdateUserProfile> {
  constructor(useAdmin = false) {
    super('user_profiles', useAdmin);
  }

  mapFromDatabase(row: UserProfileRow): UserProfile {
    return {
      id: row.id,
      authUserId: row.auth_user_id,
      fullName: row.full_name ?? undefined,
      bio: row.bio ?? undefined,
      avatarUrl: row.avatar_url ?? undefined,
      avatarSource: (row.avatar_source as 'custom' | 'gravatar' | null) ?? undefined,
      data: (row.data as Record<string, any>) ?? {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  mapToDatabase(data: CreateUserProfile | UpdateUserProfile): CreateUserProfileData | UpdateUserProfileData {
    const mapped: any = {};

    if ('authUserId' in data) mapped.auth_user_id = data.authUserId;
    if ('fullName' in data) mapped.full_name = data.fullName ?? null;
    if ('bio' in data) mapped.bio = data.bio ?? null;
    if ('avatarUrl' in data) mapped.avatar_url = data.avatarUrl ?? null;
    if ('avatarSource' in data) mapped.avatar_source = data.avatarSource ?? 'gravatar';
    if ('data' in data) mapped.data = data.data ?? {};

    return mapped;
  }

  async validateCreate(data: CreateUserProfile): Promise<void> {
    if (!data.authUserId) {
      throw new ValidationError('User id is required');
    }
  }

  async validateUpdate(_data: UpdateUserProfile): Promise<void> {
    return;
  }

  async findByAuthUserId(authUserId: string): Promise<UserProfile | null> {
    return this.db.executeOptionalQuery(
      async (client) => {
        const result = await client
          .from('user_profiles')
          .select('*')
          .eq('auth_user_id', authUserId)
          .single();

        if (result.data) {
          result.data = this.mapFromDatabase(result.data);
        }

        return result;
      },
      'findByAuthUserId user_profiles'
    );
  }

  async upsertByAuthUserId(authUserId: string, data: UpdateUserProfile): Promise<UserProfile> {
    const existing = await this.findByAuthUserId(authUserId);
    if (existing) {
      return this.update(existing.id, data);
    }
    return this.create({
      authUserId,
      ...data
    });
  }
}
