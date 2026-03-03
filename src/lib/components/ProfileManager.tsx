import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getProfileExtensions } from '@/lib/features/ui';
import { AdminLoadingState } from '@/lib/components/admin/ListingPrimitives';

type ProfileResponse = {
  user: {
    id: string;
    email: string;
    role?: 'admin' | 'author' | 'reader' | string;
  };
  profile: {
    id: string;
    authUserId: string;
    fullName?: string;
    bio?: string;
    avatarUrl?: string;
    avatarSource?: 'custom' | 'gravatar';
    data?: Record<string, any>;
    gravatarUrl?: string | null;
  };
  featureFlags?: Record<string, boolean>;
};

interface ProfileManagerProps {
  activeFeatureIds?: string[];
}

export const ProfileManager: React.FC<ProfileManagerProps> = ({ activeFeatureIds = [] }) => {
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileResponse['profile'] | null>(null);
  const [email, setEmail] = useState('');
  const [userRole, setUserRole] = useState<ProfileResponse['user']['role']>('reader');
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  const [featureData, setFeatureData] = useState<Record<string, any>>({});
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const activeFeatureSet = useMemo(() => new Set(activeFeatureIds), [activeFeatureIds]);
  const extensions = useMemo(
    () => getProfileExtensions().filter((extension) => activeFeatureSet.has(extension.id)),
    [activeFeatureSet]
  );

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/profile');
      if (response.status === 401) {
        setAuthRequired(true);
        setProfile(null);
        return;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to load profile');
      }
      const payload = (await response.json()) as ProfileResponse;
      setProfile(payload.profile);
      setEmail(payload.user.email || '');
      setUserRole(payload.user.role || 'reader');
      setFeatureFlags(payload.featureFlags || {});
      setFeatureData(payload.profile.data || {});
      setAuthRequired(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!authRequired || typeof window === 'undefined') return;
    if (typeof window.location.replace === 'function') {
      window.location.replace('/auth/login?redirect=%2Fprofile');
      return;
    }
    window.location.href = '/auth/login?redirect=%2Fprofile';
  }, [authRequired]);

  const updateField = (key: keyof ProfileResponse['profile'], value: any) => {
    if (!profile) return;
    setProfile({ ...profile, [key]: value });
  };

  const updateFeature = (featureId: string, data: Record<string, any>) => {
    setFeatureData((prev) => ({
      ...prev,
      [featureId]: data
    }));
  };

  const handleSave = useCallback(async () => {
    if (!profile) return;
    try {
      setSaving(true);
      setError(null);
      setMessage(null);
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: profile.fullName || '',
          bio: profile.bio || '',
          avatarSource: profile.avatarSource || 'gravatar',
          avatarUrl: profile.avatarUrl || '',
          data: featureData
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to update profile');
      }
      const payload = await response.json();
      setProfile(payload.profile);
      setMessage('Profile updated.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }, [featureData, profile]);

  const handleSignOut = useCallback(async () => {
    const clearClientAuthArtifacts = () => {
      try {
        const keys = Object.keys(localStorage);
        keys.forEach((key) => {
          if ((key.startsWith('sb-') && key.endsWith('-auth-token')) || key === 'supabase.auth.token') {
            localStorage.removeItem(key);
          }
        });
      } catch {
        // Ignore storage access issues.
      }
    };

    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    clearClientAuthArtifacts();
    window.location.href = '/auth/login?logged_out=1';
  }, []);

  const handlePasswordUpdate = useCallback(async () => {
    if (password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Password confirmation does not match.');
      return;
    }

    try {
      setPasswordSaving(true);
      setError(null);
      setMessage(null);
      const response = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to update password');
      }
      setPassword('');
      setPasswordConfirm('');
      setMessage('Password updated.');
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : 'Failed to update password');
    } finally {
      setPasswordSaving(false);
    }
  }, [password, passwordConfirm]);

  const avatarPreview = useMemo(() => {
    if (!profile) return '';
    if (profile.avatarSource === 'gravatar') {
      return profile.gravatarUrl || '';
    }
    return profile.avatarUrl || profile.gravatarUrl || '';
  }, [profile]);

  if (loading) {
    return (
      <AdminLoadingState label="Loading your profile..." className="py-12" />
    );
  }

  if (authRequired) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="card p-6 text-center text-sm text-muted-foreground">
          Redirecting to sign in...
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-sm text-muted-foreground">
        Unable to load profile.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          {message}
        </div>
      )}

      <div className="card p-6 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Your Profile</h1>
            <p className="text-sm text-muted-foreground">Signed in as {email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {userRole === 'admin' && (
              <a href="/admin" className="btn btn-outline">
                Open admin dashboard
              </a>
            )}
            <button type="button" className="btn btn-outline" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[160px_1fr]">
          <div className="space-y-3">
            <div className="h-32 w-32 overflow-hidden rounded-full border bg-muted">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl">🙂</div>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={profile.avatarSource !== 'custom'}
                onChange={(event) => updateField('avatarSource', event.target.checked ? 'gravatar' : 'custom')}
                className="rounded border-input text-primary focus:ring-primary"
              />
              Use Gravatar
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground" htmlFor="profile-full-name">
                Real name
              </label>
              <input
                id="profile-full-name"
                type="text"
                className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                value={profile.fullName || ''}
                onChange={(event) => updateField('fullName', event.target.value)}
                placeholder="Your full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground" htmlFor="profile-bio">
                Bio
              </label>
              <textarea
                id="profile-bio"
                rows={4}
                className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                value={profile.bio || ''}
                onChange={(event) => updateField('bio', event.target.value)}
                placeholder="Tell readers about yourself"
              />
            </div>

            {profile.avatarSource === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-foreground" htmlFor="profile-avatar-url">
                  Avatar URL
                </label>
                <input
                  id="profile-avatar-url"
                  type="url"
                  className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                  value={profile.avatarUrl || ''}
                  onChange={(event) => updateField('avatarUrl', event.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Security</h2>
          <p className="text-sm text-muted-foreground">Update your account password.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="profile-password">
              New password
            </label>
            <input
              id="profile-password"
              type="password"
              className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="profile-password-confirm">
              Confirm password
            </label>
            <input
              id="profile-password-confirm"
              type="password"
              className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              placeholder="Repeat password"
              autoComplete="new-password"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            className="btn btn-outline"
            onClick={handlePasswordUpdate}
            disabled={passwordSaving}
          >
            {passwordSaving ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </div>

      {extensions.length > 0 && (
        <div className="space-y-4">
          {extensions.map(({ id, Panel }) =>
            Panel ? (
              <Panel
                key={id}
                featureId={id}
                data={featureData[id] || {}}
                updateData={(data) => updateFeature(id, data)}
                featureFlags={featureFlags}
              />
            ) : null
          )}
        </div>
      )}

      <div className="flex justify-end">
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
};
