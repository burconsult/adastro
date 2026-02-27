import { supabaseAdmin } from '@/lib/supabase';
import { generateSlug } from '@/lib/utils/data-transform';

const fallbackSlug = 'author';

const coalesceDisplayName = (user: any): string => {
  const metadata = user?.user_metadata || {};
  const preferred = [
    metadata.full_name,
    metadata.name,
    metadata.display_name
  ].find((value) => typeof value === 'string' && value.trim().length > 0);

  if (preferred) {
    return preferred.trim();
  }

  const email = typeof user?.email === 'string' ? user.email.trim().toLowerCase() : '';
  if (email.includes('@')) {
    return email.split('@')[0] || fallbackSlug;
  }

  return fallbackSlug;
};

const coalesceEmail = (user: any): string => {
  const email = typeof user?.email === 'string' ? user.email.trim().toLowerCase() : '';
  return email;
};

const resolveUniqueAuthorSlug = async (baseSlug: string): Promise<string> => {
  const normalizedBase = generateSlug(baseSlug) || fallbackSlug;
  let candidate = normalizedBase;
  let attempt = 1;

  while (attempt <= 100) {
    const { data, error } = await (supabaseAdmin as any)
      .from('authors')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not verify author slug: ${error.message}`);
    }

    if (!data) {
      return candidate;
    }

    attempt += 1;
    candidate = `${normalizedBase}-${attempt}`;
  }

  return `${normalizedBase}-${Date.now()}`;
};

export async function ensureAuthorProfileForAuthUser(userId: string): Promise<void> {
  if (!userId || !userId.trim()) {
    throw new Error('Auth user id is required for author provisioning.');
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (authError || !authData?.user) {
    throw new Error(authError?.message || `Auth user ${userId} not found.`);
  }

  const user = authData.user;
  const email = coalesceEmail(user);
  if (!email) {
    throw new Error(`Auth user ${userId} has no email; cannot provision author profile.`);
  }

  const displayName = coalesceDisplayName(user);
  const slugBase = generateSlug(displayName) || generateSlug(email.split('@')[0] || '') || fallbackSlug;

  const { data: byAuthId, error: byAuthIdError } = await (supabaseAdmin as any)
    .from('authors')
    .select('id,name,email,slug,auth_user_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (byAuthIdError) {
    throw new Error(`Could not load author by auth user: ${byAuthIdError.message}`);
  }

  if (byAuthId) {
    const updates: Record<string, unknown> = {};
    if (!byAuthId.email) updates.email = email;
    if (!byAuthId.name) updates.name = displayName;
    if (!byAuthId.slug) updates.slug = await resolveUniqueAuthorSlug(slugBase);

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await (supabaseAdmin as any)
        .from('authors')
        .update(updates)
        .eq('id', byAuthId.id);
      if (updateError) {
        throw new Error(`Could not update author profile: ${updateError.message}`);
      }
    }

    return;
  }

  const { data: byEmail, error: byEmailError } = await (supabaseAdmin as any)
    .from('authors')
    .select('id,auth_user_id')
    .eq('email', email)
    .maybeSingle();
  if (byEmailError) {
    throw new Error(`Could not load author by email: ${byEmailError.message}`);
  }

  if (byEmail) {
    const updates: Record<string, unknown> = { auth_user_id: user.id };
    if (!byEmail.auth_user_id) {
      const { error: updateError } = await (supabaseAdmin as any)
        .from('authors')
        .update(updates)
        .eq('id', byEmail.id);
      if (updateError) {
        throw new Error(`Could not link existing author profile: ${updateError.message}`);
      }
    }
    return;
  }

  const slug = await resolveUniqueAuthorSlug(slugBase);
  const { error: insertError } = await (supabaseAdmin as any)
    .from('authors')
    .insert({
      auth_user_id: user.id,
      name: displayName,
      email,
      slug
    });

  if (insertError) {
    throw new Error(`Could not create author profile: ${insertError.message}`);
  }
}
