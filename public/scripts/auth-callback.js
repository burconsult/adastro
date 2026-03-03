const message = document.getElementById('callback-message');
const root = document.getElementById('auth-callback-root');
const redirectTarget = root?.getAttribute('data-redirect-target') || '/profile';

const hash = window.location.hash ? window.location.hash.slice(1) : '';
const hashParams = new URLSearchParams(hash);
const queryParams = new URLSearchParams(window.location.search);
const getParam = (key) => hashParams.get(key) ?? queryParams.get(key);
const accessToken = getParam('access_token');
const authCode = getParam('code');
const tokenHash = getParam('token_hash');
const oauthState = getParam('state');
const errorParam = getParam('error_description') || getParam('error');
const authFlowType = (getParam('type') || '').toLowerCase();
const OAUTH_STATE_COOKIE = 'adastro-oauth-state';

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

const getCookie = (name) => {
  const cookie = document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`));
  if (!cookie) return null;
  const value = cookie.slice(name.length + 1);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const clearCookie = (name) => {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
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
  setMessage(`Authentication failed: ${safeDecode(errorParam)}`);
} else {
  const callbackCarriesOAuthSession = Boolean(accessToken || authCode);
  const expectedOAuthState = getCookie(OAUTH_STATE_COOKIE);
  let oauthStateValid = true;
  if (callbackCarriesOAuthSession) {
    if (!expectedOAuthState || !oauthState || expectedOAuthState !== oauthState) {
      clearCookie(OAUTH_STATE_COOKIE);
      setMessage('Authentication could not be verified. Please try signing in again.');
      oauthStateValid = false;
    }
    if (oauthStateValid) {
      clearCookie(OAUTH_STATE_COOKIE);
    }
  }

  if (!oauthStateValid) {
    // Stop early on state mismatch.
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
      setMessage('Missing authentication token. Please try signing in again.');
    } else {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error('Failed to finalize session.');
          }
          window.location.replace(resolveNextTarget());
        })
        .catch(() => {
          setMessage('Unable to finish sign in. Please try again.');
        });
    }
  }
}
