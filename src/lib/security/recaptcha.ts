import { SettingsService } from '@/lib/services/settings-service';

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

type RecaptchaApiResponse = {
  success?: boolean;
  score?: number;
  action?: string;
  'error-codes'?: string[];
};

const asBoolean = (value: unknown): boolean => value === true;

const asString = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
);

const normalizeScore = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0.5;
  return Math.min(1, Math.max(0, parsed));
};

export type RecaptchaFeatureConfig = {
  required: boolean;
  configured: boolean;
  enabled: boolean;
  siteKey: string;
  secretKey: string;
  minScore: number;
};

export const getFeatureRecaptchaConfig = async ({
  settingsService = new SettingsService(),
  featureSettingKey
}: {
  settingsService?: SettingsService;
  featureSettingKey?: string;
}): Promise<RecaptchaFeatureConfig> => {
  const keys = [
    'security.recaptcha.enabled',
    'security.recaptcha.siteKey',
    'security.recaptcha.secretKey',
    'security.recaptcha.minScore'
  ];
  if (featureSettingKey) {
    keys.push(featureSettingKey);
  }

  const settings = await settingsService.getSettings(keys);
  const globallyEnabled = asBoolean(settings['security.recaptcha.enabled']);
  const featureEnabled = featureSettingKey ? asBoolean(settings[featureSettingKey]) : true;
  const siteKey = asString(settings['security.recaptcha.siteKey']);
  const secretKey = asString(settings['security.recaptcha.secretKey']);
  const minScore = normalizeScore(settings['security.recaptcha.minScore']);
  const required = globallyEnabled && featureEnabled;
  const configured = siteKey.length > 0 && secretKey.length > 0;

  return {
    required,
    configured,
    enabled: required && configured,
    siteKey,
    secretKey,
    minScore
  };
};

export const verifyRecaptchaToken = async ({
  token,
  secretKey,
  expectedAction,
  minScore,
  remoteIp
}: {
  token: string;
  secretKey: string;
  expectedAction?: string;
  minScore: number;
  remoteIp?: string;
}): Promise<{ ok: boolean; reason?: string; score?: number }> => {
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    return { ok: false, reason: 'missing_token' };
  }

  const body = new URLSearchParams();
  body.set('secret', secretKey);
  body.set('response', trimmedToken);
  if (remoteIp) {
    body.set('remoteip', remoteIp);
  }

  try {
    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!response.ok) {
      return { ok: false, reason: 'verification_unavailable' };
    }

    const payload = await response.json() as RecaptchaApiResponse;
    if (!payload.success) {
      return { ok: false, reason: payload['error-codes']?.join(',') || 'verification_failed' };
    }

    if (expectedAction && payload.action && payload.action !== expectedAction) {
      return { ok: false, reason: 'unexpected_action' };
    }

    const score = typeof payload.score === 'number' ? payload.score : 0;
    if (score < minScore) {
      return { ok: false, reason: 'score_too_low', score };
    }

    return { ok: true, score };
  } catch (_error) {
    return { ok: false, reason: 'verification_error' };
  }
};
