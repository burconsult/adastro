import type { SettingDefinition } from '../../settings/types.js';
import { NEWSLETTER_DEFAULT_SETTINGS_STATE } from './lib/shared-config.js';

export const NEWSLETTER_SETTINGS: SettingDefinition[] = [
  {
    key: 'features.newsletter.enabled',
    displayName: 'Enable Newsletter',
    description: 'Allow readers to subscribe and receive email updates.',
    type: 'boolean',
    category: 'extras',
    defaultValue: false
  },
  {
    key: 'features.newsletter.provider',
    displayName: 'Email Provider',
    description: 'Provider used to deliver newsletter emails.',
    type: 'string',
    category: 'extras',
    defaultValue: NEWSLETTER_DEFAULT_SETTINGS_STATE.provider,
    validation: { options: ['console', 'resend', 'ses'] }
  },
  {
    key: 'features.newsletter.fromName',
    displayName: 'From Name',
    description: 'Display name used in outbound newsletter emails.',
    type: 'string',
    category: 'extras',
    defaultValue: NEWSLETTER_DEFAULT_SETTINGS_STATE.fromName,
    validation: { required: true, min: 2, max: 120 }
  },
  {
    key: 'features.newsletter.fromEmail',
    displayName: 'From Email',
    description: 'Sender email address for newsletter delivery.',
    type: 'string',
    category: 'extras',
    defaultValue: NEWSLETTER_DEFAULT_SETTINGS_STATE.fromEmail,
    validation: { required: true, min: 5, max: 200 }
  },
  {
    key: 'features.newsletter.replyTo',
    displayName: 'Reply-To Email',
    description: 'Optional reply-to address for newsletter emails.',
    type: 'string',
    category: 'extras',
    defaultValue: NEWSLETTER_DEFAULT_SETTINGS_STATE.replyTo
  },
  {
    key: 'features.newsletter.sendWelcomeEmail',
    displayName: 'Send Welcome Email',
    description: 'Send a confirmation-style welcome email after successful subscription.',
    type: 'boolean',
    category: 'extras',
    defaultValue: NEWSLETTER_DEFAULT_SETTINGS_STATE.sendWelcomeEmail
  },
  {
    key: 'features.newsletter.requireDoubleOptIn',
    displayName: 'Require Double Opt-In',
    description: 'Require email confirmation before activating a subscription.',
    type: 'boolean',
    category: 'extras',
    defaultValue: NEWSLETTER_DEFAULT_SETTINGS_STATE.requireDoubleOptIn
  },
  {
    key: 'features.newsletter.requireConsentCheckbox',
    displayName: 'Require Consent Checkbox',
    description: 'Require explicit consent on signup forms.',
    type: 'boolean',
    category: 'extras',
    defaultValue: NEWSLETTER_DEFAULT_SETTINGS_STATE.requireConsentCheckbox
  },
  {
    key: 'features.newsletter.signupFooterEnabled',
    displayName: 'Show Footer Signup Form',
    description: 'Show the newsletter signup form in the site footer when the feature is active.',
    type: 'boolean',
    category: 'extras',
    defaultValue: NEWSLETTER_DEFAULT_SETTINGS_STATE.signupFooterEnabled
  },
  {
    key: 'features.newsletter.signupModalEnabled',
    displayName: 'Show Signup Modal',
    description: 'Show a newsletter signup modal after a short delay on the public site.',
    type: 'boolean',
    category: 'extras',
    defaultValue: NEWSLETTER_DEFAULT_SETTINGS_STATE.signupModalEnabled
  },
  {
    key: 'features.newsletter.signupModalDelaySeconds',
    displayName: 'Signup Modal Delay (Seconds)',
    description: 'How long to wait before showing the newsletter modal.',
    type: 'number',
    category: 'extras',
    defaultValue: NEWSLETTER_DEFAULT_SETTINGS_STATE.signupModalDelaySeconds,
    validation: { min: 1, max: 120 }
  },
  {
    key: 'features.newsletter.consentLabel',
    displayName: 'Consent Label',
    description: 'Text shown next to the signup consent checkbox.',
    type: 'string',
    category: 'extras',
    defaultValue: NEWSLETTER_DEFAULT_SETTINGS_STATE.consentLabel,
    validation: { required: true, min: 10, max: 300 }
  },
  {
    key: 'features.newsletter.complianceFooterHtml',
    displayName: 'Compliance Footer HTML',
    description: 'Template variables: {{siteTitle}}, {{unsubscribeUrl}}. Appended after the email body unless the body already renders the unsubscribe URL.',
    type: 'string',
    category: 'extras',
    defaultValue: NEWSLETTER_DEFAULT_SETTINGS_STATE.complianceFooterHtml,
    validation: { required: true, min: 20, max: 30000 }
  },
  {
    key: 'features.newsletter.maxRecipientsPerCampaign',
    displayName: 'Max Recipients Per Campaign',
    description: 'Safety cap for manual campaign sends from the post editor.',
    type: 'number',
    category: 'extras',
    defaultValue: NEWSLETTER_DEFAULT_SETTINGS_STATE.maxRecipientsPerCampaign,
    validation: { min: 1, max: 25000 }
  },
  {
    key: 'features.newsletter.templates.subscriptionSubject',
    displayName: 'Subscription Subject Template',
    description: 'Template variables: {{siteTitle}}.',
    type: 'string',
    category: 'extras',
    defaultValue: NEWSLETTER_DEFAULT_SETTINGS_STATE.subscriptionSubject,
    validation: { required: true, min: 4, max: 200 }
  },
  {
    key: 'features.newsletter.templates.subscriptionHtml',
    displayName: 'Subscription Email Template',
    description: 'Template variables: {{siteTitle}}, {{unsubscribeUrl}}.',
    type: 'string',
    category: 'extras',
    defaultValue: NEWSLETTER_DEFAULT_SETTINGS_STATE.subscriptionHtml,
    validation: { required: true, min: 10, max: 30000 }
  },
  {
    key: 'features.newsletter.templates.confirmationSubject',
    displayName: 'Confirmation Subject Template',
    description: 'Template variables: {{siteTitle}}.',
    type: 'string',
    category: 'extras',
    defaultValue: NEWSLETTER_DEFAULT_SETTINGS_STATE.confirmationSubject,
    validation: { required: true, min: 8, max: 220 }
  },
  {
    key: 'features.newsletter.templates.confirmationHtml',
    displayName: 'Confirmation Email Template',
    description: 'Template variables: {{siteTitle}}, {{confirmUrl}}, {{unsubscribeUrl}}.',
    type: 'string',
    category: 'extras',
    defaultValue: NEWSLETTER_DEFAULT_SETTINGS_STATE.confirmationHtml,
    validation: { required: true, min: 20, max: 40000 }
  },
  {
    key: 'features.newsletter.templates.newPostSubject',
    displayName: 'New Post Subject Template',
    description: 'Template variables: {{siteTitle}}, {{postTitle}}.',
    type: 'string',
    category: 'extras',
    defaultValue: NEWSLETTER_DEFAULT_SETTINGS_STATE.newPostSubject,
    validation: { required: true, min: 8, max: 220 }
  },
  {
    key: 'features.newsletter.templates.newPostHtml',
    displayName: 'New Post Email Template',
    description: 'Template variables: {{siteTitle}}, {{postTitle}}, {{postExcerpt}}, {{postUrl}}, {{unsubscribeUrl}}.',
    type: 'string',
    category: 'extras',
    defaultValue: NEWSLETTER_DEFAULT_SETTINGS_STATE.newPostHtml,
    validation: { required: true, min: 20, max: 40000 }
  },
  {
    key: 'features.newsletter.templates.campaignSubject',
    displayName: 'Campaign Subject Template',
    description: 'Template variables: {{siteTitle}}.',
    type: 'string',
    category: 'extras',
    defaultValue: NEWSLETTER_DEFAULT_SETTINGS_STATE.campaignSubject,
    validation: { required: true, min: 4, max: 220 }
  },
  {
    key: 'features.newsletter.templates.campaignHtml',
    displayName: 'Campaign Email Template',
    description: 'Template variables: {{siteTitle}}, {{introHtml}}, {{articleCardsHtml}}, {{unsubscribeUrl}}.',
    type: 'string',
    category: 'extras',
    defaultValue: NEWSLETTER_DEFAULT_SETTINGS_STATE.campaignHtml,
    validation: { required: true, min: 20, max: 60000 }
  }
];
