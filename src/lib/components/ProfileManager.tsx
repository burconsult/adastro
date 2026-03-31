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

type MfaStatusResponse = {
  enabledInApp: boolean;
  assurance: {
    currentLevel: 'aal1' | 'aal2' | null;
    nextLevel: 'aal1' | 'aal2' | null;
    currentAuthenticationMethods: string[];
  };
  factors: {
    all: Array<{
      id: string;
      factorType: string;
      status: string;
      friendlyName: string | null;
      createdAt: string | null;
      updatedAt: string | null;
    }>;
    verified: Array<{
      id: string;
      factorType: string;
      status: string;
      friendlyName: string | null;
      createdAt: string | null;
      updatedAt: string | null;
    }>;
    totp: Array<{
      id: string;
      factorType: string;
      status: string;
      friendlyName: string | null;
      createdAt: string | null;
      updatedAt: string | null;
    }>;
  };
};

type MfaEnrollment = {
  factorId: string;
  qrCode: string | null;
  secret: string | null;
  uri: string | null;
};

type PendingSensitiveAction =
  | { type: 'password' }
  | { type: 'remove-factor'; factorId: string };

interface ProfileManagerProps {
  activeFeatureIds?: string[];
  messages?: Record<string, string>;
}

export const ProfileManager: React.FC<ProfileManagerProps> = ({ activeFeatureIds = [], messages }) => {
  const text = useCallback((key: string, fallback: string) => {
    const value = messages?.[key];
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
  }, [messages]);
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
  const [mfaStatus, setMfaStatus] = useState<MfaStatusResponse | null>(null);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [pendingEnrollment, setPendingEnrollment] = useState<MfaEnrollment | null>(null);
  const [pendingSensitiveAction, setPendingSensitiveAction] = useState<PendingSensitiveAction | null>(null);
  const activeFeatureSet = useMemo(() => new Set(activeFeatureIds), [activeFeatureIds]);
  const extensions = useMemo(
    () => getProfileExtensions().filter((extension) => activeFeatureSet.has(extension.id)),
    [activeFeatureSet]
  );
  const preferredMfaFactor = useMemo(
    () => mfaStatus?.factors.totp[0] || mfaStatus?.factors.verified[0] || null,
    [mfaStatus]
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
        throw new Error(payload?.error || text('core.profile.error.loadFailed', 'Failed to load profile'));
      }
      const payload = (await response.json()) as ProfileResponse;
      setProfile(payload.profile);
      setEmail(payload.user.email || '');
      setUserRole(payload.user.role || 'reader');
      setFeatureFlags(payload.featureFlags || {});
      setFeatureData(payload.profile.data || {});
      setAuthRequired(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : text('core.profile.error.loadFailed', 'Failed to load profile'));
    } finally {
      setLoading(false);
    }
  }, [text]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const loadMfaStatus = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setMfaLoading(true);
      }

      const response = await fetch('/api/auth/mfa');
      if (response.status === 401) {
        setAuthRequired(true);
        return;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || text('core.profile.error.mfaLoadFailed', 'Failed to load MFA status'));
      }

      const payload = await response.json() as MfaStatusResponse;
      setMfaStatus(payload);
    } catch (mfaLoadError) {
      setError(mfaLoadError instanceof Error ? mfaLoadError.message : text('core.profile.error.mfaLoadFailed', 'Failed to load MFA status'));
    } finally {
      if (!options?.silent) {
        setMfaLoading(false);
      }
    }
  }, [text]);

  useEffect(() => {
    loadMfaStatus();
  }, [loadMfaStatus]);

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
        throw new Error(payload?.error || text('core.profile.error.updateFailed', 'Failed to update profile'));
      }
      const payload = await response.json();
      setProfile(payload.profile);
      setMessage(text('core.profile.success.updated', 'Profile updated.'));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text('core.profile.error.updateFailed', 'Failed to update profile'));
    } finally {
      setSaving(false);
    }
  }, [featureData, profile, text]);

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
      setError(text('core.profile.error.passwordTooShort', 'Password must contain at least 8 characters.'));
      return;
    }
    if (password !== passwordConfirm) {
      setError(text('core.profile.error.passwordMismatch', 'Password confirmation does not match.'));
      return;
    }

    const submitPasswordUpdate = async () => {
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
        if (payload?.code === 'mfa_required') {
          setPendingSensitiveAction({ type: 'password' });
          throw new Error(text('core.profile.error.mfaRequired', 'Enter an authenticator code to continue with this security action.'));
        }
        throw new Error(payload?.error || text('core.profile.error.passwordUpdateFailed', 'Failed to update password'));
      }
      setPassword('');
      setPasswordConfirm('');
      setPendingSensitiveAction(null);
      setMessage(text('core.profile.success.passwordUpdated', 'Password updated.'));
    };

    try {
      await submitPasswordUpdate();
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : text('core.profile.error.passwordUpdateFailed', 'Failed to update password'));
    } finally {
      setPasswordSaving(false);
    }
  }, [password, passwordConfirm, text]);

  const handleMfaEnroll = useCallback(async () => {
    try {
      setMfaBusy(true);
      setError(null);
      setMessage(null);
      const response = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enroll' })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || text('core.profile.error.mfaEnrollFailed', 'Failed to enroll authenticator app'));
      }

      setPendingEnrollment({
        factorId: payload.factor.id,
        qrCode: payload.totp?.qrCode || null,
        secret: payload.totp?.secret || null,
        uri: payload.totp?.uri || null
      });
      setMfaCode('');
      setMessage(text('core.profile.success.mfaEnrollmentStarted', 'Authenticator app enrollment started. Scan the QR code and verify with a 6-digit code.'));
      await loadMfaStatus({ silent: true });
    } catch (mfaError) {
      setError(mfaError instanceof Error ? mfaError.message : text('core.profile.error.mfaEnrollFailed', 'Failed to enroll authenticator app'));
    } finally {
      setMfaBusy(false);
    }
  }, [loadMfaStatus, text]);

  const verifyMfaCode = useCallback(async (factorId: string, code: string) => {
    const response = await fetch('/api/auth/mfa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'verify',
        factorId,
        code
      })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || text('core.profile.error.mfaVerifyFailed', 'Failed to verify authenticator code'));
    }

    setMfaStatus(payload.status);
    return payload.status as MfaStatusResponse;
  }, [text]);

  const handleMfaVerifyEnrollment = useCallback(async () => {
    if (!pendingEnrollment) return;

    try {
      setMfaBusy(true);
      setError(null);
      setMessage(null);
      await verifyMfaCode(pendingEnrollment.factorId, mfaCode);
      setPendingEnrollment(null);
      setPendingSensitiveAction(null);
      setMfaCode('');
      setMessage(text('core.profile.success.mfaEnabled', 'Authenticator app verified and enabled.'));
    } catch (mfaError) {
      setError(mfaError instanceof Error ? mfaError.message : text('core.profile.error.mfaVerifyFailed', 'Failed to verify authenticator code'));
    } finally {
      setMfaBusy(false);
    }
  }, [mfaCode, pendingEnrollment, text, verifyMfaCode]);

  const removeMfaFactor = useCallback(async (factorId: string) => {
    const response = await fetch('/api/auth/mfa', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factorId })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (payload?.code === 'mfa_required') {
        setPendingSensitiveAction({ type: 'remove-factor', factorId });
        throw new Error(text('core.profile.error.mfaRequired', 'Enter an authenticator code to continue with this security action.'));
      }
      throw new Error(payload?.error || text('core.profile.error.mfaRemoveFailed', 'Failed to remove authenticator app'));
    }

    setPendingEnrollment(null);
    setPendingSensitiveAction(null);
    setMfaStatus(payload.status);
    setMessage(text('core.profile.success.mfaRemoved', 'Authenticator app removed.'));
  }, [text]);

  const handleMfaRemoveFactor = useCallback(async (factorId: string) => {
    try {
      setMfaBusy(true);
      setError(null);
      setMessage(null);
      await removeMfaFactor(factorId);
    } catch (mfaError) {
      setError(mfaError instanceof Error ? mfaError.message : text('core.profile.error.mfaRemoveFailed', 'Failed to remove authenticator app'));
    } finally {
      setMfaBusy(false);
    }
  }, [removeMfaFactor, text]);

  const handleMfaStepUp = useCallback(async () => {
    if (!preferredMfaFactor || !pendingSensitiveAction) {
      return;
    }

    try {
      setMfaBusy(true);
      setError(null);
      setMessage(null);
      await verifyMfaCode(preferredMfaFactor.id, mfaCode);
      setMfaCode('');

      if (pendingSensitiveAction.type === 'password') {
        const response = await fetch('/api/auth/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error || text('core.profile.error.passwordUpdateFailed', 'Failed to update password'));
        }
        setPassword('');
        setPasswordConfirm('');
        setPendingSensitiveAction(null);
        setMessage(text('core.profile.success.passwordUpdated', 'Password updated.'));
        return;
      }

      await removeMfaFactor(pendingSensitiveAction.factorId);
    } catch (mfaError) {
      setError(mfaError instanceof Error ? mfaError.message : text('core.profile.error.mfaVerifyFailed', 'Failed to verify authenticator code'));
    } finally {
      setMfaBusy(false);
      setPasswordSaving(false);
    }
  }, [mfaCode, password, pendingSensitiveAction, preferredMfaFactor, removeMfaFactor, text, verifyMfaCode]);

  const avatarPreview = useMemo(() => {
    if (!profile) return '';
    if (profile.avatarSource === 'gravatar') {
      return profile.gravatarUrl || '';
    }
    return profile.avatarUrl || profile.gravatarUrl || '';
  }, [profile]);

  if (loading) {
    return (
      <AdminLoadingState label={text('core.profile.loading', 'Loading your profile...')} className="py-12" />
    );
  }

  if (authRequired) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="card p-6 text-center text-sm text-muted-foreground">
          {text('core.profile.redirecting', 'Redirecting to sign in...')}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-sm text-muted-foreground">
        {text('core.profile.unableToLoad', 'Unable to load profile.')}
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
            <h1 className="text-2xl font-semibold">{text('core.profile.title', 'Your profile')}</h1>
            <p className="text-sm text-muted-foreground">{text('core.profile.signedInAs', 'Signed in as')} {email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {userRole === 'admin' && (
              <a href="/admin" className="btn btn-outline">
                {text('core.profile.openAdmin', 'Open admin dashboard')}
              </a>
            )}
            <button type="button" className="btn btn-outline" onClick={handleSignOut}>
              {text('core.profile.signOut', 'Sign out')}
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
              {text('core.profile.useGravatar', 'Use Gravatar')}
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground" htmlFor="profile-full-name">
                {text('core.profile.realName', 'Real name')}
              </label>
              <input
                id="profile-full-name"
                type="text"
                className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                value={profile.fullName || ''}
                onChange={(event) => updateField('fullName', event.target.value)}
                placeholder={text('core.profile.realNamePlaceholder', 'Your full name')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground" htmlFor="profile-bio">
                {text('core.profile.bio', 'Bio')}
              </label>
              <textarea
                id="profile-bio"
                rows={4}
                className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                value={profile.bio || ''}
                onChange={(event) => updateField('bio', event.target.value)}
                placeholder={text('core.profile.bioPlaceholder', 'Tell readers about yourself')}
              />
            </div>

            {profile.avatarSource === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-foreground" htmlFor="profile-avatar-url">
                  {text('core.profile.avatarUrl', 'Avatar URL')}
                </label>
                <input
                  id="profile-avatar-url"
                  type="url"
                  className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                  value={profile.avatarUrl || ''}
                  onChange={(event) => updateField('avatarUrl', event.target.value)}
                  placeholder={text('core.profile.avatarUrlPlaceholder', 'https://example.com/avatar.jpg')}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">{text('core.profile.securityTitle', 'Security')}</h2>
          <p className="text-sm text-muted-foreground">{text('core.profile.securityBody', 'Update your account password and manage account security factors.')}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="profile-password">
              {text('core.profile.newPassword', 'New password')}
            </label>
            <input
              id="profile-password"
              type="password"
              className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={text('core.profile.newPasswordPlaceholder', 'At least 8 characters')}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="profile-password-confirm">
              {text('core.profile.confirmPassword', 'Confirm password')}
            </label>
            <input
              id="profile-password-confirm"
              type="password"
              className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              placeholder={text('core.profile.confirmPasswordPlaceholder', 'Repeat password')}
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
            {passwordSaving
              ? text('core.profile.updatingPassword', 'Updating...')
              : text('core.profile.updatePassword', 'Update password')}
          </button>
        </div>

        <div className="border-t border-border pt-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold">{text('core.profile.mfaTitle', 'Authenticator app')}</h3>
            <p className="text-sm text-muted-foreground">
              {mfaLoading
                ? text('core.profile.mfaLoading', 'Loading multi-factor status...')
                : mfaStatus?.enabledInApp
                  ? text('core.profile.mfaEnabledBody', 'Add an authenticator app for optional step-up verification on sensitive account actions.')
                  : text('core.profile.mfaDisabledBody', 'Multi-factor authentication is currently disabled by your administrator.')}
            </p>
          </div>

          {mfaStatus && (
            <div className="rounded-md border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground space-y-1">
              <p>
                {text('core.profile.mfaAssurance', 'Current session assurance')}:{' '}
                <span className="font-medium text-foreground">{mfaStatus.assurance.currentLevel || 'aal1'}</span>
              </p>
              <p>
                {text('core.profile.mfaVerifiedFactors', 'Verified factors')}:{' '}
                <span className="font-medium text-foreground">{mfaStatus.factors.verified.length}</span>
              </p>
            </div>
          )}

          {pendingEnrollment && (
            <div className="rounded-md border border-border p-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                <div className="rounded-md border border-border bg-white p-3">
                  {pendingEnrollment.qrCode ? (
                    <img src={pendingEnrollment.qrCode} alt="Authenticator app QR code" className="h-auto w-full" />
                  ) : (
                    <div className="text-sm text-muted-foreground">{text('core.profile.mfaQrUnavailable', 'QR code unavailable')}</div>
                  )}
                </div>
                <div className="space-y-3 text-sm">
                  <p>{text('core.profile.mfaEnrollInstructions', 'Scan this QR code with your authenticator app, then enter the 6-digit code to finish setup.')}</p>
                  {pendingEnrollment.secret && (
                    <p><span className="font-medium text-foreground">{text('core.profile.mfaSecret', 'Secret')}:</span> <code className="break-all">{pendingEnrollment.secret}</code></p>
                  )}
                  {pendingEnrollment.uri && (
                    <p><span className="font-medium text-foreground">{text('core.profile.mfaUri', 'URI')}:</span> <code className="break-all">{pendingEnrollment.uri}</code></p>
                  )}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="w-full rounded-md border border-input px-3 py-2 text-sm"
                  value={mfaCode}
                  onChange={(event) => setMfaCode(event.target.value.replace(/\D+/g, '').slice(0, 6))}
                  placeholder={text('core.profile.mfaCodePlaceholder', 'Enter 6-digit code')}
                />
                <div className="flex gap-2">
                  <button type="button" className="btn btn-outline" onClick={() => {
                    setPendingEnrollment(null);
                    setMfaCode('');
                  }}>
                    {text('core.profile.cancel', 'Cancel')}
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleMfaVerifyEnrollment} disabled={mfaBusy}>
                    {mfaBusy
                      ? text('core.profile.verifyingMfa', 'Verifying...')
                      : text('core.profile.verifyMfa', 'Verify app')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!pendingEnrollment && mfaStatus?.factors.verified.length ? (
            <div className="space-y-3">
              {mfaStatus.factors.verified.map((factor) => (
                <div key={factor.id} className="flex flex-col gap-3 rounded-md border border-border p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-foreground">{factor.friendlyName || text('core.profile.mfaDefaultLabel', 'Authenticator app')}</p>
                    <p className="text-sm text-muted-foreground">
                      {factor.factorType.toUpperCase()} • {text('core.profile.mfaStatusVerified', 'Verified')}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => handleMfaRemoveFactor(factor.id)}
                    disabled={mfaBusy}
                  >
                    {mfaBusy
                      ? text('core.profile.working', 'Working...')
                      : text('core.profile.removeMfa', 'Remove')}
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {!pendingEnrollment && (!mfaStatus || mfaStatus.factors.verified.length === 0) && mfaStatus?.enabledInApp && (
            <div className="flex justify-end">
              <button type="button" className="btn btn-outline" onClick={handleMfaEnroll} disabled={mfaBusy || mfaLoading}>
                {mfaBusy
                  ? text('core.profile.startingMfa', 'Starting...')
                  : text('core.profile.enableMfa', 'Set up authenticator app')}
              </button>
            </div>
          )}

          {pendingSensitiveAction && preferredMfaFactor && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-4 space-y-3">
              <p className="text-sm text-foreground">
                {text('core.profile.mfaStepUpPrompt', 'Enter a fresh authenticator code to continue with this sensitive action.')}
              </p>
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="w-full rounded-md border border-input px-3 py-2 text-sm"
                  value={mfaCode}
                  onChange={(event) => setMfaCode(event.target.value.replace(/\D+/g, '').slice(0, 6))}
                  placeholder={text('core.profile.mfaCodePlaceholder', 'Enter 6-digit code')}
                />
                <button type="button" className="btn btn-primary" onClick={handleMfaStepUp} disabled={mfaBusy}>
                  {mfaBusy
                    ? text('core.profile.verifyingMfa', 'Verifying...')
                    : text('core.profile.continueSecureAction', 'Verify and continue')}
                </button>
              </div>
            </div>
          )}
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
          {saving
            ? text('core.profile.savingProfile', 'Saving...')
            : text('core.profile.saveProfile', 'Save profile')}
        </button>
      </div>
    </div>
  );
};
