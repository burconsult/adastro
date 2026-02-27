export const REQUIRED_SETUP_ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY'
] as const;

export const SETUP_COMPLETION_KEY = 'setup.completed';
export const SETUP_ALLOW_REENTRY_KEY = 'setup.allowReentry';

export type DeploymentTarget = 'vercel' | 'netlify' | 'custom';

const ENV_PLACEHOLDERS: Partial<Record<(typeof REQUIRED_SETUP_ENV_KEYS)[number], string>> = {
  SUPABASE_URL: 'https://placeholder.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'placeholder-publishable-key',
  SUPABASE_SECRET_KEY: 'missing-secret-key'
};

export const getRuntimeEnv = (key: string): string | undefined => {
  if (typeof process === 'undefined') return undefined;
  return process.env[key];
};

export const isConfigured = (value: string | undefined, placeholder = ''): boolean => {
  if (!value || !value.trim()) return false;
  const normalized = value.trim();
  if (placeholder && normalized === placeholder) return false;
  if (normalized.includes('placeholder')) return false;
  return true;
};

export const hasRequiredSetupEnv = (): boolean => REQUIRED_SETUP_ENV_KEYS.every((key) => {
  const runtimeValue = getRuntimeEnv(key);
  const buildValue = (import.meta.env as Record<string, string | undefined>)[key];
  const candidate = runtimeValue || buildValue;
  return isConfigured(candidate, ENV_PLACEHOLDERS[key] || '');
});

export const sanitizeBaseUrl = (value: string | undefined): string | null => {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
};

export const detectRequestSiteUrl = (request: Request): string | null => {
  const rawHost = request.headers.get('x-forwarded-host')
    || request.headers.get('host')
    || new URL(request.url).host;
  if (!rawHost) return null;

  const host = rawHost.split(',')[0]?.trim();
  if (!host) return null;

  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  const requestProto = new URL(request.url).protocol.replace(':', '').toLowerCase();
  const protocol = forwardedProto === 'http' || forwardedProto === 'https' ? forwardedProto : requestProto;

  return sanitizeBaseUrl(`${protocol}://${host}`);
};

export const normalizeBooleanSetting = (value: unknown): boolean => {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return Boolean(value);
};

export const isMissingRelationError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return normalized.includes('does not exist')
    || normalized.includes('could not find the table')
    || normalized.includes('relation');
};

export const normalizeDeploymentProvider = (
  value: string | undefined | null
): Exclude<DeploymentTarget, 'custom'> | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('netlify')) return 'netlify';
  if (normalized.includes('vercel')) return 'vercel';
  return null;
};

export const providerFromHost = (
  value: string | undefined | null
): Exclude<DeploymentTarget, 'custom'> | null => {
  if (!value) return null;

  try {
    const host = value.includes('://') ? new URL(value).hostname.toLowerCase() : value.toLowerCase();
    if (host.includes('.netlify.app')) return 'netlify';
    if (host.includes('.vercel.app')) return 'vercel';
  } catch {
    return null;
  }

  return null;
};

export const detectDeploymentTarget = (request: Request): DeploymentTarget => {
  const vercelHeader = request.headers.get('x-vercel-id');
  if (vercelHeader) return 'vercel';

  const netlifyHeader = request.headers.get('x-nf-request-id');
  if (netlifyHeader) return 'netlify';

  const netlifyConnectionHeader = request.headers.get('x-nf-client-connection-ip');
  if (netlifyConnectionHeader) return 'netlify';

  const requestHost = request.headers.get('x-forwarded-host')
    || request.headers.get('host')
    || new URL(request.url).hostname;
  const requestHostProvider = providerFromHost(requestHost);
  if (requestHostProvider) return requestHostProvider;

  const configuredAdapter = normalizeDeploymentProvider(
    (import.meta.env.ASTRO_ADAPTER as string | undefined) || getRuntimeEnv('ASTRO_ADAPTER')
  );
  if (configuredAdapter) return configuredAdapter;

  const deployUrlProvider = providerFromHost(
    getRuntimeEnv('DEPLOY_URL') || getRuntimeEnv('URL') || getRuntimeEnv('VERCEL_URL')
  );
  if (deployUrlProvider) return deployUrlProvider;

  if (
    getRuntimeEnv('NETLIFY')
    || getRuntimeEnv('NETLIFY_IMAGES_CDN_DOMAIN')
    || getRuntimeEnv('NETLIFY_LOCAL')
    || getRuntimeEnv('SITE_ID')
    || getRuntimeEnv('DEPLOY_ID')
    || getRuntimeEnv('CONTEXT')
  ) {
    return 'netlify';
  }
  if (
    getRuntimeEnv('VERCEL')
    || getRuntimeEnv('VERCEL_ENV')
    || getRuntimeEnv('VERCEL_URL')
    || getRuntimeEnv('VERCEL_PROJECT_ID')
  ) {
    return 'vercel';
  }

  return 'custom';
};

