import type { SettingDefinition } from '../../settings/types.js';

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
    defaultValue: 'console',
    validation: { options: ['console', 'resend', 'ses'] }
  },
  {
    key: 'features.newsletter.fromName',
    displayName: 'From Name',
    description: 'Display name used in outbound newsletter emails.',
    type: 'string',
    category: 'extras',
    defaultValue: 'AdAstro',
    validation: { required: true, min: 2, max: 120 }
  },
  {
    key: 'features.newsletter.fromEmail',
    displayName: 'From Email',
    description: 'Sender email address for newsletter delivery.',
    type: 'string',
    category: 'extras',
    defaultValue: 'newsletter@example.com',
    validation: { required: true, min: 5, max: 200 }
  },
  {
    key: 'features.newsletter.replyTo',
    displayName: 'Reply-To Email',
    description: 'Optional reply-to address for newsletter emails.',
    type: 'string',
    category: 'extras',
    defaultValue: ''
  },
  {
    key: 'features.newsletter.sendWelcomeEmail',
    displayName: 'Send Welcome Email',
    description: 'Send a confirmation-style welcome email after successful subscription.',
    type: 'boolean',
    category: 'extras',
    defaultValue: true
  },
  {
    key: 'features.newsletter.requireDoubleOptIn',
    displayName: 'Require Double Opt-In',
    description: 'Require email confirmation before activating a subscription.',
    type: 'boolean',
    category: 'extras',
    defaultValue: false
  },
  {
    key: 'features.newsletter.requireConsentCheckbox',
    displayName: 'Require Consent Checkbox',
    description: 'Require explicit consent on signup forms.',
    type: 'boolean',
    category: 'extras',
    defaultValue: true
  },
  {
    key: 'features.newsletter.signupFooterEnabled',
    displayName: 'Show Footer Signup Form',
    description: 'Show the newsletter signup form in the site footer when the feature is active.',
    type: 'boolean',
    category: 'extras',
    defaultValue: true
  },
  {
    key: 'features.newsletter.signupModalEnabled',
    displayName: 'Show Signup Modal',
    description: 'Show a newsletter signup modal after a short delay on the public site.',
    type: 'boolean',
    category: 'extras',
    defaultValue: false
  },
  {
    key: 'features.newsletter.signupModalDelaySeconds',
    displayName: 'Signup Modal Delay (Seconds)',
    description: 'How long to wait before showing the newsletter modal.',
    type: 'number',
    category: 'extras',
    defaultValue: 12,
    validation: { min: 1, max: 120 }
  },
  {
    key: 'features.newsletter.consentLabel',
    displayName: 'Consent Label',
    description: 'Text shown next to the signup consent checkbox.',
    type: 'string',
    category: 'extras',
    defaultValue: 'I agree to receive email updates and understand I can unsubscribe at any time.',
    validation: { required: true, min: 10, max: 300 }
  },
  {
    key: 'features.newsletter.complianceFooterHtml',
    displayName: 'Compliance Footer HTML',
    description: 'Template variables: {{siteTitle}}, {{unsubscribeUrl}}.',
    type: 'string',
    category: 'extras',
    defaultValue:
      '<p style="font-size:12px;color:#666">You are receiving this email from {{siteTitle}}. Unsubscribe any time: <a href="{{unsubscribeUrl}}">{{unsubscribeUrl}}</a></p>',
    validation: { required: true, min: 20, max: 30000 }
  },
  {
    key: 'features.newsletter.maxRecipientsPerCampaign',
    displayName: 'Max Recipients Per Campaign',
    description: 'Safety cap for manual campaign sends from the post editor.',
    type: 'number',
    category: 'extras',
    defaultValue: 1000,
    validation: { min: 1, max: 25000 }
  },
  {
    key: 'features.newsletter.templates.subscriptionSubject',
    displayName: 'Subscription Subject Template',
    description: 'Template variables: {{siteTitle}}.',
    type: 'string',
    category: 'extras',
    defaultValue: 'Welcome to {{siteTitle}}',
    validation: { required: true, min: 4, max: 200 }
  },
  {
    key: 'features.newsletter.templates.subscriptionHtml',
    displayName: 'Subscription Email Template',
    description: 'Template variables: {{siteTitle}}, {{unsubscribeUrl}}.',
    type: 'string',
    category: 'extras',
    defaultValue:
      '<p>Thanks for subscribing to <strong>{{siteTitle}}</strong>.</p><p>We will send new posts when they go live.</p><p style="font-size:12px;color:#666">Unsubscribe anytime: <a href="{{unsubscribeUrl}}">{{unsubscribeUrl}}</a></p>',
    validation: { required: true, min: 10, max: 30000 }
  },
  {
    key: 'features.newsletter.templates.confirmationSubject',
    displayName: 'Confirmation Subject Template',
    description: 'Template variables: {{siteTitle}}.',
    type: 'string',
    category: 'extras',
    defaultValue: 'Confirm your subscription to {{siteTitle}}',
    validation: { required: true, min: 8, max: 220 }
  },
  {
    key: 'features.newsletter.templates.confirmationHtml',
    displayName: 'Confirmation Email Template',
    description: 'Template variables: {{siteTitle}}, {{confirmUrl}}, {{unsubscribeUrl}}.',
    type: 'string',
    category: 'extras',
    defaultValue:
      '<p>Please confirm your subscription to <strong>{{siteTitle}}</strong>.</p><p><a href="{{confirmUrl}}">Confirm subscription</a></p><p style="font-size:12px;color:#666">If this was not you, ignore this email.</p>',
    validation: { required: true, min: 20, max: 40000 }
  },
  {
    key: 'features.newsletter.templates.newPostSubject',
    displayName: 'New Post Subject Template',
    description: 'Template variables: {{siteTitle}}, {{postTitle}}.',
    type: 'string',
    category: 'extras',
    defaultValue: 'New post on {{siteTitle}}: {{postTitle}}',
    validation: { required: true, min: 8, max: 220 }
  },
  {
    key: 'features.newsletter.templates.newPostHtml',
    displayName: 'New Post Email Template',
    description: 'Template variables: {{siteTitle}}, {{postTitle}}, {{postExcerpt}}, {{postUrl}}, {{unsubscribeUrl}}.',
    type: 'string',
    category: 'extras',
    defaultValue:
      '<p><strong>{{postTitle}}</strong></p><p>{{postExcerpt}}</p><p><a href="{{postUrl}}">Read the full post</a></p><p style="font-size:12px;color:#666">Unsubscribe: <a href="{{unsubscribeUrl}}">{{unsubscribeUrl}}</a></p>',
    validation: { required: true, min: 20, max: 40000 }
  },
  {
    key: 'features.newsletter.templates.campaignSubject',
    displayName: 'Campaign Subject Template',
    description: 'Template variables: {{siteTitle}}.',
    type: 'string',
    category: 'extras',
    defaultValue: '{{siteTitle}} update',
    validation: { required: true, min: 4, max: 220 }
  },
  {
    key: 'features.newsletter.templates.campaignHtml',
    displayName: 'Campaign Email Template',
    description: 'Template variables: {{siteTitle}}, {{introHtml}}, {{articleCardsHtml}}, {{unsubscribeUrl}}.',
    type: 'string',
    category: 'extras',
    defaultValue:
      '<div><p>{{introHtml}}</p>{{articleCardsHtml}}<p style="font-size:12px;color:#666">Unsubscribe: <a href="{{unsubscribeUrl}}">{{unsubscribeUrl}}</a></p></div>',
    validation: { required: true, min: 20, max: 60000 }
  }
];
