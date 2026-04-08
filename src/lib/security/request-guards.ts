import { getRuntimeEnv, normalizeDeploymentProvider } from '../setup/runtime.js';

const TRUSTED_PROXY_IP_HEADERS_ENV_KEY = 'TRUSTED_PROXY_IP_HEADERS';

const PLATFORM_TRUSTED_IP_HEADERS = {
  vercel: ['x-forwarded-for'],
  netlify: ['x-nf-client-connection-ip']
} as const;

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

function normalizeHeaderName(value: string): string | null {
  const candidate = value.trim().toLowerCase();
  if (!candidate) return null;
  return /^[a-z0-9-]+$/.test(candidate) ? candidate : null;
}

function getConfiguredTrustedProxyIpHeaders(): string[] {
  const rawValue = (import.meta.env[TRUSTED_PROXY_IP_HEADERS_ENV_KEY] as string | undefined)
    || getRuntimeEnv(TRUSTED_PROXY_IP_HEADERS_ENV_KEY);
  if (!rawValue) return [];

  const headers = rawValue
    .split(',')
    .map(normalizeHeaderName)
    .filter((value): value is string => Boolean(value));

  return [...new Set(headers)];
}

function hasNetlifyRuntimeMarkers(): boolean {
  return Boolean(
    getRuntimeEnv('NETLIFY')
    || getRuntimeEnv('NETLIFY_IMAGES_CDN_DOMAIN')
    || getRuntimeEnv('NETLIFY_LOCAL')
    || getRuntimeEnv('SITE_ID')
    || getRuntimeEnv('DEPLOY_ID')
    || getRuntimeEnv('CONTEXT')
  );
}

function hasVercelRuntimeMarkers(): boolean {
  return Boolean(
    getRuntimeEnv('VERCEL')
    || getRuntimeEnv('VERCEL_ENV')
    || getRuntimeEnv('VERCEL_URL')
    || getRuntimeEnv('VERCEL_PROJECT_ID')
  );
}

function detectTrustedProxySource(request: Request): keyof typeof PLATFORM_TRUSTED_IP_HEADERS | 'custom' {
  if (request.headers.get('x-vercel-id')) return 'vercel';
  if (request.headers.get('x-nf-request-id') || request.headers.get('x-nf-client-connection-ip')) {
    return 'netlify';
  }

  const configuredAdapter = normalizeDeploymentProvider(
    (import.meta.env.ASTRO_ADAPTER as string | undefined) || getRuntimeEnv('ASTRO_ADAPTER')
  );
  if (configuredAdapter) return configuredAdapter;

  if (hasNetlifyRuntimeMarkers()) return 'netlify';
  if (hasVercelRuntimeMarkers()) return 'vercel';

  return 'custom';
}

function getTrustedProxyIpHeaders(request: Request): readonly string[] {
  const proxySource = detectTrustedProxySource(request);
  if (proxySource !== 'custom') {
    return PLATFORM_TRUSTED_IP_HEADERS[proxySource];
  }

  return getConfiguredTrustedProxyIpHeaders();
}

export function getClientIp(request: Request): string {
  for (const header of getTrustedProxyIpHeaders(request)) {
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
