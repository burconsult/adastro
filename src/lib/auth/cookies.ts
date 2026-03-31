export const ACCESS_TOKEN_COOKIE = 'sb-access-token';

export function getAccessTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [rawName, ...rest] = cookie.trim().split('=');
    if (!rawName || rawName !== ACCESS_TOKEN_COOKIE) continue;
    const rawValue = rest.join('=');
    return rawValue ? decodeURIComponent(rawValue) : null;
  }

  return null;
}

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
