import type { SettingDefinition } from '../../settings/types.js';

export const COMMENTS_SETTINGS: SettingDefinition[] = [
  {
    key: 'features.comments.enabled',
    displayName: 'Enable Comments',
    description: 'Allow comments on blog posts.',
    type: 'boolean',
    category: 'extras',
    defaultValue: false
  },
  {
    key: 'features.comments.moderation',
    displayName: 'Moderate Comments',
    description: 'Require approval for new comments.',
    type: 'boolean',
    category: 'extras',
    defaultValue: true
  },
  {
    key: 'features.comments.authenticatedOnly',
    displayName: 'Members Only Comments',
    description: 'Only allow signed-in users to submit comments.',
    type: 'boolean',
    category: 'extras',
    defaultValue: false
  },
  {
    key: 'features.comments.recaptcha.enabled',
    displayName: 'Use reCAPTCHA v3',
    description: 'Require reCAPTCHA v3 for new comment submissions (uses core Security settings keys).',
    type: 'boolean',
    category: 'extras',
    defaultValue: false
  },
  {
    key: 'features.comments.maxLinks',
    displayName: 'Max Links Per Comment',
    description: 'Automatically hold comments with too many links.',
    type: 'number',
    category: 'extras',
    defaultValue: 3,
    validation: { min: 0, max: 20 }
  },
  {
    key: 'features.comments.minSecondsToSubmit',
    displayName: 'Minimum Seconds Before Submit',
    description: 'Reject forms submitted unrealistically fast to reduce bot spam.',
    type: 'number',
    category: 'extras',
    defaultValue: 2,
    validation: { min: 0, max: 120 }
  },
  {
    key: 'features.comments.blockedTerms',
    displayName: 'Blocked Terms',
    description: 'Comma-separated terms that force comments into moderation.',
    type: 'array',
    category: 'extras',
    defaultValue: []
  }
];
