document.addEventListener('DOMContentLoaded', () => {
  const logoutButtons = document.querySelectorAll('.logout-btn');
  if (!logoutButtons.length) return;

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

  logoutButtons.forEach((logoutBtn) =>
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        console.error('Logout error:', error);
      } finally {
        clearClientAuthArtifacts();
        window.location.href = '/auth/login?logged_out=1';
      }
    })
  );
});
