document.addEventListener('DOMContentLoaded', () => {
  const logoutButtons = document.querySelectorAll('.logout-btn');
  if (!logoutButtons.length) return;

  logoutButtons.forEach((logoutBtn) =>
    logoutBtn.addEventListener('click', async () => {
      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          window.location.href = '/auth/login';
        } else {
          console.error('Logout failed');
        }
      } catch (error) {
        console.error('Logout error:', error);
      }
    })
  );
});
