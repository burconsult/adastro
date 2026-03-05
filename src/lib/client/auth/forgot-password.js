document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('forgot-password-form');
  const submitBtn = document.getElementById('submit-btn');
  const submitText = document.getElementById('submit-text');
  const submitLoading = document.getElementById('submit-loading');
  const statusEl = document.getElementById('forgot-password-status');
  const messagesEl = document.getElementById('auth-forgot-messages');
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
    const fallbackMessage = detail?.description || detail?.title || text('sendFailed', 'Something went wrong.');
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

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const email = formData.get('email');

    if (submitBtn) submitBtn.disabled = true;
    submitText?.classList.add('hidden');
    submitLoading?.classList.remove('hidden');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const description = payload.error || text('sendFailed', 'Unable to send reset link right now.');
        setStatus(description, 'error');
        notify({
          variant: 'destructive',
          title: text('failedTitle', 'Reset failed'),
          description
        });
        return;
      }

      const message = payload.message || text('defaultSuccess', 'If an account exists, a reset link was sent.');
      setStatus(message, 'success');
      notify({
        variant: 'success',
        title: text('successTitle', 'Check your inbox'),
        description: message
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      setStatus(text('sendFailed', 'Unable to send reset link right now.'), 'error');
      notify({
        variant: 'destructive',
        title: text('failedTitle', 'Reset failed'),
        description: text('sendFailed', 'Unable to send reset link right now.')
      });
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      submitText?.classList.remove('hidden');
      submitLoading?.classList.add('hidden');
    }
  });
});
