const message = document.getElementById('callback-message');
const root = document.getElementById('auth-callback-root');
const redirectTarget = root?.getAttribute('data-redirect-target') || '/profile';
const messagesEl = document.getElementById('auth-callback-messages');
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

const hash = window.location.hash ? window.location.hash.slice(1) : '';
const hashParams = new URLSearchParams(hash);
const queryParams = new URLSearchParams(window.location.search);
const getParam = (key) => hashParams.get(key) ?? queryParams.get(key);
const accessToken = getParam('access_token');
const authCode = getParam('code');
const tokenHash = getParam('token_hash');
const errorParam = getParam('error_description') || getParam('error');
const authFlowType = (getParam('type') || '').toLowerCase();

const safeDecode = (value) => {
  if (!value) return '';
  const normalized = value.replace(/\+/g, ' ');
  try {
    return decodeURIComponent(normalized);
  } catch {
    return normalized;
  }
};

const setMessage = (text) => {
  if (message) {
    message.textContent = text;
  }
};

const shouldForcePasswordReset = (authFlowType === 'invite' || authFlowType === 'recovery')
  && !redirectTarget.startsWith('/auth/reset-password');
const resolveNextTarget = () => {
  if (!shouldForcePasswordReset) {
    return redirectTarget;
  }

  return `/auth/reset-password?next=${encodeURIComponent(redirectTarget)}`;
};

if (errorParam) {
  setMessage(`${text('authFailedPrefix', 'Authentication failed:')} ${safeDecode(errorParam)}`);
} else {
  let endpoint = '';
  let body = {};

  if (accessToken) {
    endpoint = '/api/auth/session';
    body = { access_token: accessToken };
  } else if (tokenHash && authFlowType) {
    endpoint = '/api/auth/verify-otp';
    body = { token_hash: tokenHash, type: authFlowType };
  } else if (authCode) {
    endpoint = '/api/auth/exchange-code';
    body = { code: authCode };
  }

  if (!endpoint) {
    setMessage(text('missingToken', 'Missing authentication token. Please try signing in again.'));
  } else {
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(text('finalizeFailed', 'Failed to finalize session.'));
        }
        window.location.replace(resolveNextTarget());
      })
      .catch(() => {
        setMessage(text('unexpectedError', 'Unable to finish sign in. Please try again.'));
      });
  }
}
