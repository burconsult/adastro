import { normalizeFeatureFlag } from '@/lib/features/flags';
import { getFeatureRecaptchaConfig } from '@/lib/security/recaptcha';
import { SettingsService } from '@/lib/services/settings-service';

import type { CommentsAdminStatus, CommentsRuntimeConfig, CommentQueueSummary } from './types.js';

const COMMENTS_SETTING_KEYS = [
  'features.comments.enabled',
  'features.comments.moderation',
  'features.comments.authenticatedOnly',
  'features.comments.maxLinks',
  'features.comments.minSecondsToSubmit',
  'features.comments.blockedTerms'
] as const;

const sanitizeText = (value: unknown, maxLength: number) =>
  (typeof value === 'string' ? value.trim() : '').slice(0, maxLength);

export const loadCommentsRuntimeConfig = async (
  settingsService = new SettingsService()
): Promise<CommentsRuntimeConfig> => {
  const settings = await settingsService.getSettings([...COMMENTS_SETTING_KEYS]);
  const recaptcha = await getFeatureRecaptchaConfig({
    settingsService,
    featureSettingKey: 'features.comments.recaptcha.enabled'
  });
  const maxLinksRaw = Number(settings['features.comments.maxLinks']);
  const minSecondsRaw = Number(settings['features.comments.minSecondsToSubmit']);
  const blockedTermsRaw = Array.isArray(settings['features.comments.blockedTerms'])
    ? settings['features.comments.blockedTerms']
    : [];

  return {
    enabled: normalizeFeatureFlag(settings['features.comments.enabled'], false),
    moderation: normalizeFeatureFlag(settings['features.comments.moderation'], true),
    authenticatedOnly: normalizeFeatureFlag(settings['features.comments.authenticatedOnly'], false),
    spam: {
      maxLinks: Number.isFinite(maxLinksRaw) ? Math.max(0, Math.min(20, Math.round(maxLinksRaw))) : 3,
      minSecondsToSubmit: Number.isFinite(minSecondsRaw) ? Math.max(0, Math.min(120, Math.round(minSecondsRaw))) : 2,
      blockedTerms: blockedTermsRaw
        .map((term: unknown) => sanitizeText(term, 80).toLowerCase())
        .filter(Boolean)
    },
    recaptcha: {
      enabled: recaptcha.enabled,
      required: recaptcha.required,
      configured: recaptcha.configured,
      minScore: recaptcha.minScore,
      siteKey: recaptcha.siteKey,
      secretKey: recaptcha.secretKey
    }
  };
};

export const toPublicCommentsStatus = (config: CommentsRuntimeConfig) => ({
  enabled: config.enabled,
  moderation: config.moderation,
  authenticatedOnly: config.authenticatedOnly,
  recaptcha: {
    enabled: config.recaptcha.enabled,
    required: config.recaptcha.required,
    configured: config.recaptcha.configured,
    minScore: config.recaptcha.minScore,
    siteKey: config.recaptcha.enabled ? config.recaptcha.siteKey : undefined
  }
});

export const buildCommentsAdminStatus = (
  config: CommentsRuntimeConfig,
  summary: CommentQueueSummary
): CommentsAdminStatus => ({
  enabled: config.enabled,
  moderation: config.moderation,
  authenticatedOnly: config.authenticatedOnly,
  spam: {
    maxLinks: config.spam.maxLinks,
    minSecondsToSubmit: config.spam.minSecondsToSubmit,
    blockedTermsCount: config.spam.blockedTerms.length
  },
  recaptcha: {
    enabled: config.recaptcha.enabled,
    required: config.recaptcha.required,
    configured: config.recaptcha.configured,
    minScore: config.recaptcha.minScore
  },
  summary
});
