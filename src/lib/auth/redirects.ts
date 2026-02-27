const DEFAULT_REDIRECT_PATH = '/';

export function sanitizeRedirectPath(input: unknown, fallback = DEFAULT_REDIRECT_PATH): string {
  if (typeof input !== 'string') return fallback;

  const value = input.trim();
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//')) return fallback;
  if (value.includes('://')) return fallback;
  if (value.includes('\\')) return fallback;

  try {
    const parsed = new URL(value, 'http://local.test');
    if (parsed.origin !== 'http://local.test') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
