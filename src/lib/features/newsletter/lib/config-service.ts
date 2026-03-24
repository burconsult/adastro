import { normalizeFeatureFlag } from '@/lib/features/flags';
import { SettingsService } from '@/lib/services/settings-service';
import { normalizeCanonicalSiteUrl } from '@/lib/url/site-url';
import { getEnv } from '@/lib/env';

import {
  LEGACY_NEWSLETTER_DEFAULT_CAMPAIGN_HTML,
  NEWSLETTER_DEFAULT_SETTINGS_STATE,
  NEWSLETTER_PROVIDER_ENV_HINTS,
  NEWSLETTER_RUNTIME_SETTING_KEYS,
  parseNewsletterSettingsState
} from './shared-config.js';
import type {
  NewsletterAdminStatus,
  NewsletterCampaignStatusItem,
  NewsletterCampaignSummary,
  NewsletterPublicMeta,
  NewsletterProviderKey,
  NewsletterRuntimeSettings,
  NewsletterSubscriberSummary
} from './types.js';

const ALLOWED_PROVIDER_SET = new Set<NewsletterProviderKey>(['console', 'resend', 'ses']);

const sanitizeText = (value: unknown, maxLength: number) =>
  (typeof value === 'string' ? value.trim() : '').slice(0, maxLength);

const normalizeEmail = (value: unknown) =>
  (typeof value === 'string' ? value.trim().toLowerCase() : '').slice(0, 200);

const getDefaultSiteUrl = (): string => {
  const runtimeSiteUrl = typeof process !== 'undefined' ? process.env.SITE_URL : undefined;
  const configuredSiteUrl = (import.meta.env.SITE_URL as string | undefined) || runtimeSiteUrl;
  return normalizeCanonicalSiteUrl(configuredSiteUrl) || 'https://example.com';
};

const normalizeSiteUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 'https://example.com';
  return normalizeCanonicalSiteUrl(trimmed) || trimmed.replace(/\/+$/, '');
};

const normalizeCampaignHtml = (value: unknown) => {
  const template = sanitizeText(value, 80_000);
  if (!template) {
    return NEWSLETTER_DEFAULT_SETTINGS_STATE.campaignHtml;
  }

  return template === LEGACY_NEWSLETTER_DEFAULT_CAMPAIGN_HTML
    ? NEWSLETTER_DEFAULT_SETTINGS_STATE.campaignHtml
    : template;
};

export const isNewsletterProviderConfigured = (provider: NewsletterProviderKey): boolean => {
  if (provider === 'console') return true;
  if (provider === 'resend') return Boolean(getEnv('RESEND_API_KEY'));
  return Boolean(getEnv('AWS_SES_SMTP_USER') && getEnv('AWS_SES_SMTP_PASS'));
};

export const getNewsletterSigningSecret = () =>
  getEnv('NEWSLETTER_SIGNING_SECRET') || getEnv('SUPABASE_SECRET_KEY') || '';

export const loadNewsletterRuntimeSettings = async (
  settingsService = new SettingsService()
): Promise<NewsletterRuntimeSettings> => {
  const settings = await settingsService.getSettings([...NEWSLETTER_RUNTIME_SETTING_KEYS]);
  const parsedSettings = parseNewsletterSettingsState(settings);
  const provider: NewsletterProviderKey = ALLOWED_PROVIDER_SET.has(parsedSettings.provider)
    ? parsedSettings.provider
    : 'console';

  return {
    enabled: normalizeFeatureFlag(settings['features.newsletter.enabled'], parsedSettings.enabled),
    provider,
    fromName: sanitizeText(settings['features.newsletter.fromName'], 120) || NEWSLETTER_DEFAULT_SETTINGS_STATE.fromName,
    fromEmail: normalizeEmail(settings['features.newsletter.fromEmail']) || NEWSLETTER_DEFAULT_SETTINGS_STATE.fromEmail,
    replyTo: normalizeEmail(settings['features.newsletter.replyTo']),
    sendWelcomeEmail: normalizeFeatureFlag(
      settings['features.newsletter.sendWelcomeEmail'],
      parsedSettings.sendWelcomeEmail
    ),
    requireDoubleOptIn: normalizeFeatureFlag(
      settings['features.newsletter.requireDoubleOptIn'],
      parsedSettings.requireDoubleOptIn
    ),
    requireConsentCheckbox: normalizeFeatureFlag(
      settings['features.newsletter.requireConsentCheckbox'],
      parsedSettings.requireConsentCheckbox
    ),
    signupFooterEnabled: normalizeFeatureFlag(
      settings['features.newsletter.signupFooterEnabled'],
      parsedSettings.signupFooterEnabled
    ),
    signupModalEnabled: normalizeFeatureFlag(
      settings['features.newsletter.signupModalEnabled'],
      parsedSettings.signupModalEnabled
    ),
    signupModalDelaySeconds: parsedSettings.signupModalDelaySeconds,
    consentLabel:
      sanitizeText(settings['features.newsletter.consentLabel'], 300)
      || NEWSLETTER_DEFAULT_SETTINGS_STATE.consentLabel,
    complianceFooterHtml: sanitizeText(settings['features.newsletter.complianceFooterHtml'], 40_000)
      || NEWSLETTER_DEFAULT_SETTINGS_STATE.complianceFooterHtml,
    maxRecipientsPerCampaign: parsedSettings.maxRecipientsPerCampaign,
    templates: {
      subscriptionSubject:
        sanitizeText(settings['features.newsletter.templates.subscriptionSubject'], 220)
        || NEWSLETTER_DEFAULT_SETTINGS_STATE.subscriptionSubject,
      subscriptionHtml:
        sanitizeText(settings['features.newsletter.templates.subscriptionHtml'], 60_000)
        || NEWSLETTER_DEFAULT_SETTINGS_STATE.subscriptionHtml,
      confirmationSubject:
        sanitizeText(settings['features.newsletter.templates.confirmationSubject'], 220)
        || NEWSLETTER_DEFAULT_SETTINGS_STATE.confirmationSubject,
      confirmationHtml:
        sanitizeText(settings['features.newsletter.templates.confirmationHtml'], 60_000)
        || NEWSLETTER_DEFAULT_SETTINGS_STATE.confirmationHtml,
      newPostSubject:
        sanitizeText(settings['features.newsletter.templates.newPostSubject'], 220)
        || NEWSLETTER_DEFAULT_SETTINGS_STATE.newPostSubject,
      newPostHtml:
        sanitizeText(settings['features.newsletter.templates.newPostHtml'], 60_000)
        || NEWSLETTER_DEFAULT_SETTINGS_STATE.newPostHtml,
      campaignSubject:
        sanitizeText(settings['features.newsletter.templates.campaignSubject'], 220)
        || NEWSLETTER_DEFAULT_SETTINGS_STATE.campaignSubject,
      campaignHtml: normalizeCampaignHtml(settings['features.newsletter.templates.campaignHtml'])
    },
    siteTitle: sanitizeText(settings['site.title'], 120) || 'AdAstro',
    siteUrl: normalizeSiteUrl(sanitizeText(settings['site.url'], 300) || getDefaultSiteUrl())
  };
};

export const toPublicNewsletterMeta = (
  settings: NewsletterRuntimeSettings
): NewsletterPublicMeta => ({
  enabled: settings.enabled,
  provider: settings.provider,
  requireConsentCheckbox: settings.requireConsentCheckbox,
  consentLabel: settings.consentLabel,
  requireDoubleOptIn: settings.requireDoubleOptIn,
  signupFooterEnabled: settings.signupFooterEnabled,
  signupModalEnabled: settings.signupModalEnabled,
  signupModalDelaySeconds: settings.signupModalDelaySeconds
});

export const buildNewsletterAdminStatus = (input: {
  settings: NewsletterRuntimeSettings;
  subscribers: NewsletterSubscriberSummary;
  campaigns: NewsletterCampaignSummary;
  recentCampaigns: NewsletterCampaignStatusItem[];
}): NewsletterAdminStatus => ({
  enabled: input.settings.enabled,
  provider: input.settings.provider,
  providerConfigured: isNewsletterProviderConfigured(input.settings.provider),
  providerEnvHint: NEWSLETTER_PROVIDER_ENV_HINTS[input.settings.provider],
  sendWelcomeEmail: input.settings.sendWelcomeEmail,
  requireDoubleOptIn: input.settings.requireDoubleOptIn,
  requireConsentCheckbox: input.settings.requireConsentCheckbox,
  signupFooterEnabled: input.settings.signupFooterEnabled,
  signupModalEnabled: input.settings.signupModalEnabled,
  signupModalDelaySeconds: input.settings.signupModalDelaySeconds,
  maxRecipientsPerCampaign: input.settings.maxRecipientsPerCampaign,
  siteUrl: input.settings.siteUrl,
  subscribers: input.subscribers,
  campaigns: input.campaigns,
  recentCampaigns: input.recentCampaigns
});
