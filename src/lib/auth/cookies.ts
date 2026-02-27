const ACCESS_TOKEN_COOKIE = 'sb-access-token';

export function buildAccessTokenCookie(value: string, maxAgeSec: number, requestUrl: string): string {
  const isSecure = requestUrl.startsWith('https://');
  const parts = [
    `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(value)}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSec))}`,
    'Priority=High'
  ];

  if (isSecure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}
