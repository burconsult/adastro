import { SettingsService } from '@/lib/services/settings-service.js';
import { getAccessTokenFromRequest } from '@/lib/auth/cookies.js';
import { supabaseAdmin } from '@/lib/supabase.js';
import { normalizeBooleanSetting } from '@/lib/setup/runtime.js';

export type MfaAssuranceLevel = 'aal1' | 'aal2' | null;

export type MfaFactor = {
  id: string;
  factorType: string;
  status: string;
  friendlyName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type MfaStatus = {
  enabledInApp: boolean;
  assurance: {
    currentLevel: MfaAssuranceLevel;
    nextLevel: MfaAssuranceLevel;
    currentAuthenticationMethods: string[];
  };
  factors: {
    all: MfaFactor[];
    verified: MfaFactor[];
    totp: MfaFactor[];
  };
};

type MfaContext = MfaStatus & {
  accessToken: string;
};

type MfaApiErrorPayload = {
  error?: string;
  error_description?: string;
  msg?: string;
  message?: string;
};

type MfaVerifyResult = {
  accessToken: string;
  expiresIn: number;
  status: MfaStatus;
};

const settingsService = new SettingsService();
const MFA_ENABLED_SETTING_KEY = 'auth.mfa.enabled';

export class MfaError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'MfaError';
    this.status = status;
  }
}

export class MfaRequiredError extends MfaError {
  constructor(message = 'Multi-factor verification required.') {
    super(message, 412);
    this.name = 'MfaRequiredError';
  }
}

const normalizeFactor = (factor: any): MfaFactor | null => {
  const id = typeof factor?.id === 'string' ? factor.id : '';
  if (!id) return null;

  return {
    id,
    factorType: typeof factor?.factor_type === 'string' ? factor.factor_type : '',
    status: typeof factor?.status === 'string' ? factor.status : '',
    friendlyName: typeof factor?.friendly_name === 'string' && factor.friendly_name.trim()
      ? factor.friendly_name.trim()
      : null,
    createdAt: typeof factor?.created_at === 'string' ? factor.created_at : null,
    updatedAt: typeof factor?.updated_at === 'string' ? factor.updated_at : null
  };
};

const decodeJwtPayload = (token: string): Record<string, any> => {
  const [, payload = ''] = token.split('.');
  if (!payload) return {};

  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));

  try {
    return JSON.parse(Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8'));
  } catch {
    return {};
  }
};

const normalizeAssuranceLevel = (value: unknown): MfaAssuranceLevel => (
  value === 'aal1' || value === 'aal2' ? value : null
);

const normalizeAuthenticationMethods = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      if (entry && typeof entry === 'object' && typeof (entry as Record<string, unknown>).method === 'string') {
        return String((entry as Record<string, unknown>).method).trim();
      }
      return '';
    })
    .filter((entry) => entry.length > 0);
};

const toMfaStatus = (accessToken: string, user: any, enabledInApp: boolean): MfaStatus => {
  const factors = Array.isArray(user?.factors)
    ? user.factors.map(normalizeFactor).filter((factor): factor is MfaFactor => Boolean(factor))
    : [];
  const verified = factors.filter((factor: MfaFactor) => factor.status === 'verified');
  const payload = decodeJwtPayload(accessToken);
  const currentLevel = normalizeAssuranceLevel(payload.aal);

  return {
    enabledInApp,
    assurance: {
      currentLevel,
      nextLevel: verified.length > 0 ? 'aal2' : 'aal1',
      currentAuthenticationMethods: normalizeAuthenticationMethods(payload.amr)
    },
    factors: {
      all: factors,
      verified,
      totp: verified.filter((factor: MfaFactor) => factor.factorType === 'totp')
    }
  };
};

const getMfaApiBaseUrl = (): { supabaseUrl: string; publishableKey: string } => {
  const supabaseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const publishableKey = import.meta.env.SUPABASE_PUBLISHABLE_KEY as string | undefined;

  if (!supabaseUrl || !publishableKey) {
    throw new MfaError('Supabase Auth is not configured for MFA.', 503);
  }

  return { supabaseUrl, publishableKey };
};

const extractApiErrorMessage = (payload: MfaApiErrorPayload | null, fallback: string): string => (
  payload?.error_description
  || payload?.msg
  || payload?.message
  || payload?.error
  || fallback
);

const callSupabaseMfaApi = async <T>(
  accessToken: string,
  path: string,
  options: {
    method: 'POST' | 'DELETE';
    body?: Record<string, unknown>;
    fallbackMessage: string;
  }
): Promise<T> => {
  const { supabaseUrl, publishableKey } = getMfaApiBaseUrl();
  const response = await fetch(`${supabaseUrl}/auth/v1${path}`, {
    method: options.method,
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await response.json().catch(() => null) as T | MfaApiErrorPayload | null;
  if (!response.ok) {
    throw new MfaError(
      extractApiErrorMessage(payload as MfaApiErrorPayload | null, options.fallbackMessage),
      response.status
    );
  }

  return payload as T;
};

const readEnabledInApp = async (): Promise<boolean> => {
  try {
    return normalizeBooleanSetting(await settingsService.getSetting(MFA_ENABLED_SETTING_KEY));
  } catch {
    return false;
  }
};

const getUserForAccessToken = async (accessToken: string) => {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new MfaError('Authentication required.', 401);
  }
  return data.user;
};

export const getMfaStatus = async (request: Request): Promise<MfaStatus> => {
  const accessToken = getAccessTokenFromRequest(request);
  if (!accessToken) {
    throw new MfaError('Authentication required.', 401);
  }

  const [enabledInApp, user] = await Promise.all([
    readEnabledInApp(),
    getUserForAccessToken(accessToken)
  ]);

  return toMfaStatus(accessToken, user, enabledInApp);
};

const getMfaContext = async (request: Request): Promise<MfaContext> => {
  const accessToken = getAccessTokenFromRequest(request);
  if (!accessToken) {
    throw new MfaError('Authentication required.', 401);
  }

  const [enabledInApp, user] = await Promise.all([
    readEnabledInApp(),
    getUserForAccessToken(accessToken)
  ]);

  return {
    accessToken,
    ...toMfaStatus(accessToken, user, enabledInApp)
  };
};

export const requireSensitiveMfa = async (request: Request): Promise<MfaContext> => {
  const context = await getMfaContext(request);
  if (!context.enabledInApp || context.factors.verified.length === 0) {
    return context;
  }

  if (context.assurance.currentLevel !== 'aal2') {
    throw new MfaRequiredError();
  }

  return context;
};

export const enrollTotpFactor = async (request: Request): Promise<{
  factor: MfaFactor;
  totp: {
    qrCode: string | null;
    secret: string | null;
    uri: string | null;
  };
}> => {
  const context = await getMfaContext(request);
  if (!context.enabledInApp) {
    throw new MfaError('Multi-factor authentication is disabled by the administrator.', 409);
  }

  const issuer = (() => {
    try {
      const value = settingsService.getSetting('site.title');
      return value;
    } catch {
      return Promise.resolve('AdAstro');
    }
  })();

  const payload = await callSupabaseMfaApi<any>(context.accessToken, '/factors', {
    method: 'POST',
    body: {
      factor_type: 'totp',
      friendly_name: 'Authenticator app',
      issuer: String(await issuer || 'AdAstro')
    },
    fallbackMessage: 'Failed to enroll TOTP factor.'
  });

  const factor = normalizeFactor(payload);
  if (!factor) {
    throw new MfaError('Supabase did not return a valid MFA factor.', 502);
  }

  return {
    factor,
    totp: {
      qrCode: typeof payload?.totp?.qr_code === 'string' ? payload.totp.qr_code : null,
      secret: typeof payload?.totp?.secret === 'string' ? payload.totp.secret : null,
      uri: typeof payload?.totp?.uri === 'string' ? payload.totp.uri : null
    }
  };
};

export const verifyTotpFactor = async (
  request: Request,
  factorId: string,
  code: string
): Promise<MfaVerifyResult> => {
  const context = await getMfaContext(request);
  const normalizedFactorId = factorId.trim();
  const normalizedCode = code.trim();

  if (!normalizedFactorId) {
    throw new MfaError('Factor id is required.', 400);
  }

  if (!/^\d{6}$/.test(normalizedCode)) {
    throw new MfaError('Enter a valid 6-digit authenticator code.', 400);
  }

  const factorExists = context.factors.all.some((factor: MfaFactor) => factor.id === normalizedFactorId);
  if (!factorExists) {
    throw new MfaError('MFA factor not found.', 404);
  }

  const challenge = await callSupabaseMfaApi<{ id: string }>(context.accessToken, `/factors/${normalizedFactorId}/challenge`, {
    method: 'POST',
    body: {},
    fallbackMessage: 'Failed to prepare MFA challenge.'
  });

  const verification = await callSupabaseMfaApi<{
    access_token?: string;
    expires_in?: number;
  }>(context.accessToken, `/factors/${normalizedFactorId}/verify`, {
    method: 'POST',
    body: {
      challenge_id: challenge.id,
      code: normalizedCode
    },
    fallbackMessage: 'Failed to verify MFA code.'
  });

  const nextAccessToken = typeof verification?.access_token === 'string' ? verification.access_token : '';
  if (!nextAccessToken) {
    throw new MfaError('Supabase did not return an updated MFA session.', 502);
  }

  const nextUser = await getUserForAccessToken(nextAccessToken);
  return {
    accessToken: nextAccessToken,
    expiresIn: typeof verification?.expires_in === 'number' ? verification.expires_in : 3600,
    status: toMfaStatus(nextAccessToken, nextUser, context.enabledInApp)
  };
};

export const unenrollMfaFactor = async (request: Request, factorId: string): Promise<MfaStatus> => {
  const context = await requireSensitiveMfa(request);
  const normalizedFactorId = factorId.trim();

  if (!normalizedFactorId) {
    throw new MfaError('Factor id is required.', 400);
  }

  const factorExists = context.factors.all.some((factor: MfaFactor) => factor.id === normalizedFactorId);
  if (!factorExists) {
    throw new MfaError('MFA factor not found.', 404);
  }

  await callSupabaseMfaApi(context.accessToken, `/factors/${normalizedFactorId}`, {
    method: 'DELETE',
    fallbackMessage: 'Failed to remove MFA factor.'
  });

  const nextUser = await getUserForAccessToken(context.accessToken);
  return toMfaStatus(context.accessToken, nextUser, context.enabledInApp);
};
