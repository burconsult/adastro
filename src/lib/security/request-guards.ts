const FORWARDED_IP_HEADERS = [
  'x-forwarded-for',
  'cf-connecting-ip',
  'x-real-ip'
] as const;

export const UNSAFE_HTTP_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isUnsafeMethod(method: string): boolean {
  return UNSAFE_HTTP_METHODS.has(method.toUpperCase());
}

export function isSameOriginRequest(request: Request, expectedOrigin: string): boolean {
  const origin = request.headers.get('origin');
  if (origin) {
    return origin === expectedOrigin;
  }

  const referer = request.headers.get('referer');
  if (!referer) {
    return true;
  }

  try {
    return new URL(referer).origin === expectedOrigin;
  } catch {
    return false;
  }
}

function normalizeIpCandidate(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return null;
  if (candidate.toLowerCase() === 'unknown') return null;
  return candidate;
}

export function getClientIp(request: Request): string {
  for (const header of FORWARDED_IP_HEADERS) {
    const value = request.headers.get(header);
    if (!value) continue;

    if (header === 'x-forwarded-for') {
      const first = value.split(',')[0] || '';
      const normalized = normalizeIpCandidate(first);
      if (normalized) return normalized;
      continue;
    }

    const normalized = normalizeIpCandidate(value);
    if (normalized) return normalized;
  }

  return 'unknown';
}
