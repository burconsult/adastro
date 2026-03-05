document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('reset-password-root');
  const form = document.getElementById('reset-password-form');
  const statusEl = document.getElementById('reset-password-status');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirm-password');
  const submitBtn = document.getElementById('submit-btn');
  const submitText = document.getElementById('submit-text');
  const submitLoading = document.getElementById('submit-loading');
  const nextTarget = root?.getAttribute('data-next-target') || '/profile';
  const messagesEl = document.getElementById('auth-reset-messages');
  const messages = (() => {
    if (!messagesEl?.textContent) return {};
    try {
      return JSON.parse(messagesEl.textContent);
    } catch {
      return {};
    }
  })();
  const text = (key, fallback) => {
    const value = messages?.[key];
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
  };

  const notify = (detail) => {
    const fallbackMessage = detail?.description || detail?.title || text('updateFailedDefault', 'Something went wrong.');
    if (typeof window.showToast === 'function') {
      window.showToast(detail);
    } else {
      console.error(fallbackMessage);
    }
  };

  const setStatus = (message, tone = 'default') => {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.remove('hidden', 'text-destructive', 'text-success');
    if (tone === 'error') {
      statusEl.classList.add('text-destructive');
    } else if (tone === 'success') {
      statusEl.classList.add('text-success');
    } else {
      statusEl.classList.add('text-muted-foreground');
    }
  };

  const showForm = () => {
    form?.classList.remove('hidden');
  };

  const syncSessionFromToken = async () => {
    const hash = window.location.hash ? window.location.hash.slice(1) : '';
    const hashParams = new URLSearchParams(hash);
    const queryParams = new URLSearchParams(window.location.search);
    const getParam = (key) => hashParams.get(key) ?? queryParams.get(key);
    const accessToken = getParam('access_token');
    const error = getParam('error_description') || getParam('error');

    if (error) {
      setStatus(`${text('linkFailedPrefix', 'Password reset link failed:')} ${error}`, 'error');
      return false;
    }

    if (!accessToken) {
      return true;
    }

    try {
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken })
      });

      if (!response.ok) {
        throw new Error(text('finalizeSessionFailed', 'Failed to finalize reset session.'));
      }

      window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
      return true;
    } catch (error) {
      console.error('Reset password session sync error:', error);
      setStatus(text('invalidLink', 'Your reset link is invalid or expired. Request a new one.'), 'error');
      return false;
    }
  };

  const verifyAuthSession = async () => {
    try {
      const response = await fetch('/api/profile', { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  };

  const initialize = async () => {
    const synced = await syncSessionFromToken();
    if (!synced) {
      return;
    }

    const authed = await verifyAuthSession();
    if (!authed) {
      setStatus(text('signInFirst', 'Sign in first or request a new password reset link.'), 'error');
      return;
    }

    setStatus(text('sessionVerified', 'Session verified. Set your new password below.'));
    showForm();
  };

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = passwordInput?.value || '';
    const confirmPassword = confirmInput?.value || '';

    if (password.length < 8) {
      setStatus(text('passwordTooShort', 'Password must be at least 8 characters.'), 'error');
      return;
    }

    if (password !== confirmPassword) {
      setStatus(text('passwordMismatch', 'Password confirmation does not match.'), 'error');
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    submitText?.classList.add('hidden');
    submitLoading?.classList.remove('hidden');

    try {
      const response = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload.error || text('updateFailed', 'Unable to update password.');
        setStatus(message, 'error');
        notify({
          variant: 'destructive',
          title: text('updateFailedTitle', 'Password update failed'),
          description: message
        });
        return;
      }

      setStatus(text('updatedStatus', 'Password updated. Redirecting...'), 'success');
      notify({
        variant: 'success',
        title: text('updatedTitle', 'Password updated'),
        description: text('updatedBody', 'Your password was updated successfully.')
      });
      window.setTimeout(() => {
        window.location.replace(nextTarget);
      }, 900);
    } catch (error) {
      console.error('Reset password error:', error);
      setStatus(text('updateFailedDefault', 'Unable to update password right now.'), 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      submitText?.classList.remove('hidden');
      submitLoading?.classList.add('hidden');
    }
  });

  void initialize();
});
