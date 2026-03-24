import type { NewsletterProviderKey, NewsletterSettingsState } from './types.js';

export const NEWSLETTER_SETTING_KEYS = [
  'features.newsletter.enabled',
  'features.newsletter.provider',
  'features.newsletter.fromName',
  'features.newsletter.fromEmail',
  'features.newsletter.replyTo',
  'features.newsletter.sendWelcomeEmail',
  'features.newsletter.requireDoubleOptIn',
  'features.newsletter.requireConsentCheckbox',
  'features.newsletter.signupFooterEnabled',
  'features.newsletter.signupModalEnabled',
  'features.newsletter.signupModalDelaySeconds',
  'features.newsletter.consentLabel',
  'features.newsletter.complianceFooterHtml',
  'features.newsletter.maxRecipientsPerCampaign',
  'features.newsletter.templates.subscriptionSubject',
  'features.newsletter.templates.subscriptionHtml',
  'features.newsletter.templates.confirmationSubject',
  'features.newsletter.templates.confirmationHtml',
  'features.newsletter.templates.newPostSubject',
  'features.newsletter.templates.newPostHtml',
  'features.newsletter.templates.campaignSubject',
  'features.newsletter.templates.campaignHtml'
] as const;

export const NEWSLETTER_RUNTIME_SETTING_KEYS = [
  ...NEWSLETTER_SETTING_KEYS,
  'site.title',
  'site.url'
] as const;

export const NEWSLETTER_PROVIDER_LABELS: Record<NewsletterProviderKey, string> = {
  console: 'Console',
  resend: 'Resend',
  ses: 'Amazon SES'
};

export const NEWSLETTER_PROVIDER_ENV_HINTS: Record<NewsletterProviderKey, string> = {
  console: 'Console mode simulates sends without contacting an external provider.',
  resend: 'Provider env required: RESEND_API_KEY.',
  ses: 'Provider env required: AWS_SES_REGION, AWS_SES_SMTP_USER, AWS_SES_SMTP_PASS (optional: AWS_SES_SMTP_HOST, AWS_SES_SMTP_PORT).'
};

export const LEGACY_NEWSLETTER_DEFAULT_CAMPAIGN_HTML =
  '<div><p>{{introHtml}}</p>{{articleCardsHtml}}<p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p></div>';

export const NEWSLETTER_DEFAULT_SETTINGS_STATE: NewsletterSettingsState = {
  enabled: false,
  provider: 'console',
  fromName: 'AdAstro',
  fromEmail: 'newsletter@example.com',
  replyTo: '',
  sendWelcomeEmail: true,
  requireDoubleOptIn: false,
  requireConsentCheckbox: true,
  signupFooterEnabled: true,
  signupModalEnabled: false,
  signupModalDelaySeconds: 12,
  consentLabel: 'I agree to receive email updates and can unsubscribe at any time.',
  complianceFooterHtml:
    '<p style="font-size:12px;color:#666">Unsubscribe: <a href="{{unsubscribeUrl}}">{{unsubscribeUrl}}</a></p>',
  maxRecipientsPerCampaign: 1000,
  subscriptionSubject: 'Welcome to {{siteTitle}}',
  subscriptionHtml: '<p>Thanks for subscribing to {{siteTitle}}.</p>',
  confirmationSubject: 'Confirm your subscription to {{siteTitle}}',
  confirmationHtml: '<p>Confirm your subscription: <a href="{{confirmUrl}}">Confirm</a></p>',
  newPostSubject: 'New post on {{siteTitle}}: {{postTitle}}',
  newPostHtml:
    '<p><strong>{{postTitle}}</strong></p><p><a href="{{postUrl}}">Read the post</a></p>',
  campaignSubject: '{{siteTitle}} update',
  campaignHtml: '<div><p>{{introHtml}}</p>{{articleCardsHtml}}</div>'
};

const boolValue = (value: unknown, fallback: boolean) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
      return false;
    }
  }
  return fallback;
};

const stringValue = (value: unknown, fallback = '') =>
  (typeof value === 'string' ? value : fallback);

const numberValue = (value: unknown, fallback: number) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const providerValue = (value: unknown): NewsletterProviderKey => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'resend' || normalized === 'ses' ? normalized : 'console';
};

export const parseNewsletterSettingsState = (
  payload: Record<string, unknown>
): NewsletterSettingsState => ({
  enabled: boolValue(payload['features.newsletter.enabled'], NEWSLETTER_DEFAULT_SETTINGS_STATE.enabled),
  provider: providerValue(payload['features.newsletter.provider']),
  fromName: stringValue(payload['features.newsletter.fromName'], NEWSLETTER_DEFAULT_SETTINGS_STATE.fromName),
  fromEmail: stringValue(payload['features.newsletter.fromEmail'], NEWSLETTER_DEFAULT_SETTINGS_STATE.fromEmail),
  replyTo: stringValue(payload['features.newsletter.replyTo'], NEWSLETTER_DEFAULT_SETTINGS_STATE.replyTo),
  sendWelcomeEmail: boolValue(
    payload['features.newsletter.sendWelcomeEmail'],
    NEWSLETTER_DEFAULT_SETTINGS_STATE.sendWelcomeEmail
  ),
  requireDoubleOptIn: boolValue(
    payload['features.newsletter.requireDoubleOptIn'],
    NEWSLETTER_DEFAULT_SETTINGS_STATE.requireDoubleOptIn
  ),
  requireConsentCheckbox: boolValue(
    payload['features.newsletter.requireConsentCheckbox'],
    NEWSLETTER_DEFAULT_SETTINGS_STATE.requireConsentCheckbox
  ),
  signupFooterEnabled: boolValue(
    payload['features.newsletter.signupFooterEnabled'],
    NEWSLETTER_DEFAULT_SETTINGS_STATE.signupFooterEnabled
  ),
  signupModalEnabled: boolValue(
    payload['features.newsletter.signupModalEnabled'],
    NEWSLETTER_DEFAULT_SETTINGS_STATE.signupModalEnabled
  ),
  signupModalDelaySeconds: Math.max(
    1,
    Math.min(
      120,
      numberValue(
        payload['features.newsletter.signupModalDelaySeconds'],
        NEWSLETTER_DEFAULT_SETTINGS_STATE.signupModalDelaySeconds
      )
    )
  ),
  consentLabel: stringValue(
    payload['features.newsletter.consentLabel'],
    NEWSLETTER_DEFAULT_SETTINGS_STATE.consentLabel
  ),
  complianceFooterHtml: stringValue(
    payload['features.newsletter.complianceFooterHtml'],
    NEWSLETTER_DEFAULT_SETTINGS_STATE.complianceFooterHtml
  ),
  maxRecipientsPerCampaign: Math.max(
    1,
    Math.min(
      25_000,
      numberValue(
        payload['features.newsletter.maxRecipientsPerCampaign'],
        NEWSLETTER_DEFAULT_SETTINGS_STATE.maxRecipientsPerCampaign
      )
    )
  ),
  subscriptionSubject: stringValue(
    payload['features.newsletter.templates.subscriptionSubject'],
    NEWSLETTER_DEFAULT_SETTINGS_STATE.subscriptionSubject
  ),
  subscriptionHtml: stringValue(
    payload['features.newsletter.templates.subscriptionHtml'],
    NEWSLETTER_DEFAULT_SETTINGS_STATE.subscriptionHtml
  ),
  confirmationSubject: stringValue(
    payload['features.newsletter.templates.confirmationSubject'],
    NEWSLETTER_DEFAULT_SETTINGS_STATE.confirmationSubject
  ),
  confirmationHtml: stringValue(
    payload['features.newsletter.templates.confirmationHtml'],
    NEWSLETTER_DEFAULT_SETTINGS_STATE.confirmationHtml
  ),
  newPostSubject: stringValue(
    payload['features.newsletter.templates.newPostSubject'],
    NEWSLETTER_DEFAULT_SETTINGS_STATE.newPostSubject
  ),
  newPostHtml: stringValue(
    payload['features.newsletter.templates.newPostHtml'],
    NEWSLETTER_DEFAULT_SETTINGS_STATE.newPostHtml
  ),
  campaignSubject: stringValue(
    payload['features.newsletter.templates.campaignSubject'],
    NEWSLETTER_DEFAULT_SETTINGS_STATE.campaignSubject
  ),
  campaignHtml: stringValue(
    payload['features.newsletter.templates.campaignHtml'],
    NEWSLETTER_DEFAULT_SETTINGS_STATE.campaignHtml
  )
});

export const serializeNewsletterSettingsState = (settings: NewsletterSettingsState) => ({
  'features.newsletter.enabled': settings.enabled,
  'features.newsletter.provider': settings.provider,
  'features.newsletter.fromName': settings.fromName,
  'features.newsletter.fromEmail': settings.fromEmail,
  'features.newsletter.replyTo': settings.replyTo,
  'features.newsletter.sendWelcomeEmail': settings.sendWelcomeEmail,
  'features.newsletter.requireDoubleOptIn': settings.requireDoubleOptIn,
  'features.newsletter.requireConsentCheckbox': settings.requireConsentCheckbox,
  'features.newsletter.signupFooterEnabled': settings.signupFooterEnabled,
  'features.newsletter.signupModalEnabled': settings.signupModalEnabled,
  'features.newsletter.signupModalDelaySeconds': settings.signupModalDelaySeconds,
  'features.newsletter.consentLabel': settings.consentLabel,
  'features.newsletter.complianceFooterHtml': settings.complianceFooterHtml,
  'features.newsletter.maxRecipientsPerCampaign': settings.maxRecipientsPerCampaign,
  'features.newsletter.templates.subscriptionSubject': settings.subscriptionSubject,
  'features.newsletter.templates.subscriptionHtml': settings.subscriptionHtml,
  'features.newsletter.templates.confirmationSubject': settings.confirmationSubject,
  'features.newsletter.templates.confirmationHtml': settings.confirmationHtml,
  'features.newsletter.templates.newPostSubject': settings.newPostSubject,
  'features.newsletter.templates.newPostHtml': settings.newPostHtml,
  'features.newsletter.templates.campaignSubject': settings.campaignSubject,
  'features.newsletter.templates.campaignHtml': settings.campaignHtml
});
