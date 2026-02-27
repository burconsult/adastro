document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const submitBtn = document.getElementById('submit-btn');
  const submitText = document.getElementById('submit-text');
  const submitLoading = document.getElementById('submit-loading');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const redirect = form?.dataset?.redirect || '/admin';

  const notify = (detail) => {
    const fallbackMessage = detail?.description || detail?.title || 'Something went wrong.';
    if (typeof window.showToast === 'function') {
      window.showToast(detail);
    } else {
      console.error(fallbackMessage);
    }
  };

  const validateForm = () => {
    const email = emailInput?.value.trim();
    const password = passwordInput?.value.trim();
    const isValid = email && password && email.includes('@');

    if (submitBtn) {
      submitBtn.disabled = !isValid;
    }
  };

  if (emailInput && passwordInput) {
    emailInput.addEventListener('input', validateForm);
    passwordInput.addEventListener('input', validateForm);
    validateForm();
  }

  if (form && submitBtn) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      submitBtn.disabled = true;
      submitText?.classList.add('hidden');
      submitLoading?.classList.remove('hidden');

      const formData = new FormData(form);
      const email = formData.get('email');
      const password = formData.get('password');

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password, redirect }),
        });

        const result = await response.json();

        if (response.ok) {
          window.location.href = result.redirect || redirect;
        } else {
          notify({
            variant: 'destructive',
            title: 'Login failed',
            description: result.error || 'Please verify your credentials and try again.',
          });
        }
      } catch (error) {
        console.error('Login error:', error);
        notify({
          variant: 'destructive',
          title: 'Login error',
          description: 'An unexpected error occurred. Please try again.',
        });
      } finally {
        validateForm();
        submitText?.classList.remove('hidden');
        submitLoading?.classList.add('hidden');
      }
    });
  }
});
