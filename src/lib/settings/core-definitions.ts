import type { SettingDefinition } from './types.js';
import { DEFAULT_ARTICLE_ROUTING } from '@/lib/routing/articles.js';

export const CORE_SETTINGS: SettingDefinition[] = [
  {
    key: 'site.title',
    displayName: 'Site Title',
    description: 'The main title of your website',
    type: 'string',
    category: 'general',
    defaultValue: 'AdAstro',
    validation: { required: true, min: 1, max: 100 }
  },
  {
    key: 'site.url',
    displayName: 'Site URL',
    description: 'Base URL used for links, auth redirects, and canonical URLs.',
    type: 'string',
    category: 'general',
    defaultValue: 'https://example.com',
    validation: { required: true, pattern: '^https?://.+' }
  },
  {
    key: 'editor.blocks.enabled',
    displayName: 'Enable Block Editor',
    description: 'Use the default Editor.js block editor when composing posts.',
    type: 'boolean',
    category: 'editor',
    defaultValue: true
  },
  {
    key: 'site.description',
    displayName: 'Site Description',
    description: 'A brief description of your website',
    type: 'string',
    category: 'general',
    defaultValue: 'A practical, speed-first CMS built with Astro and Supabase.',
    validation: { max: 500 }
  },
  {
    key: 'site.tagline',
    displayName: 'Site Tagline',
    description: 'Short motto displayed across marketing areas',
    type: 'string',
    category: 'general',
    defaultValue: 'AdAstro - The Lightspeed CMS',
    validation: { required: true, min: 3, max: 140 }
  },
  {
    key: 'site.logoUrl',
    displayName: 'Site Logo URL',
    description: 'Header/footer logo URL (use /logo.svg or an absolute https:// URL).',
    type: 'string',
    category: 'general',
    defaultValue: '/logo.svg',
    validation: { required: true, min: 1, max: 300, pattern: '^(\\/|https?:\\/\\/).+' }
  },
  {
    key: 'analytics.enabled',
    displayName: 'Enable Basic Analytics',
    description: 'Track lightweight first-party page views for the built-in analytics dashboard.',
    type: 'boolean',
    category: 'general',
    defaultValue: true
  },
  {
    key: 'site.customHeadScripts',
    displayName: 'Custom Head Scripts/HTML',
    description: 'Trusted admin only. Injected into the public site <head>. Use for self-hosted snippets or inline tags. Note: CSP may block third-party external script hosts.',
    type: 'string',
    category: 'general',
    defaultValue: '',
    validation: { max: 50000 }
  },
  {
    key: 'site.customFooterScripts',
    displayName: 'Custom Footer Scripts/HTML',
    description: 'Trusted admin only. Injected before </body> on the public site. Note: CSP may block third-party external script hosts.',
    type: 'string',
    category: 'general',
    defaultValue: '',
    validation: { max: 50000 }
  },
  {
    key: 'setup.allowReentry',
    displayName: 'Allow Setup Wizard Re-entry',
    description: 'Allow `/setup` access after setup is complete (recommended: disabled on production).',
    type: 'boolean',
    category: 'general',
    defaultValue: false
  },
  {
    key: 'security.recaptcha.enabled',
    displayName: 'Enable reCAPTCHA v3',
    description: 'Globally enable reCAPTCHA checks for features that opt into anti-spam verification.',
    type: 'boolean',
    category: 'security',
    defaultValue: false
  },
  {
    key: 'security.recaptcha.siteKey',
    displayName: 'reCAPTCHA Site Key',
    description: 'Public site key used by browser forms.',
    type: 'string',
    category: 'security',
    defaultValue: ''
  },
  {
    key: 'security.recaptcha.secretKey',
    displayName: 'reCAPTCHA Secret Key',
    description: 'Server secret used to validate reCAPTCHA tokens.',
    type: 'string',
    category: 'security',
    defaultValue: ''
  },
  {
    key: 'security.recaptcha.minScore',
    displayName: 'reCAPTCHA Minimum Score',
    description: 'Minimum accepted score (0.0 to 1.0) for successful verification.',
    type: 'number',
    category: 'security',
    defaultValue: 0.5,
    validation: { min: 0, max: 1 }
  },
  {
    key: 'auth.oauth.github.enabled',
    displayName: 'Enable GitHub OAuth',
    description: 'Show GitHub social sign-in when the GitHub provider is enabled in Supabase Auth.',
    type: 'boolean',
    category: 'auth',
    defaultValue: false
  },
  {
    key: 'auth.oauth.google.enabled',
    displayName: 'Enable Google OAuth',
    description: 'Show Google social sign-in when the Google provider is enabled in Supabase Auth.',
    type: 'boolean',
    category: 'auth',
    defaultValue: false
  },
  {
    key: 'navigation.topLinks',
    displayName: 'Top Navigation Links',
    description: 'Links shown in the header navigation.',
    type: 'json',
    category: 'navigation',
    defaultValue: [
      { label: 'Home', href: '/' },
      { label: 'Articles', href: `/${DEFAULT_ARTICLE_ROUTING.basePath}` },
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' }
    ]
  },
  {
    key: 'navigation.bottomLinks',
    displayName: 'Bottom Navigation Links',
    description: 'Links shown in the footer navigation.',
    type: 'json',
    category: 'navigation',
    defaultValue: [
      { label: 'Home', href: '/' },
      { label: 'Articles', href: `/${DEFAULT_ARTICLE_ROUTING.basePath}` },
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' }
    ]
  },
  {
    key: 'navigation.footerAttribution',
    displayName: 'Footer Powered-By Text',
    description: 'Text shown in the footer powered-by line.',
    type: 'string',
    category: 'navigation',
    defaultValue: 'Powered by AdAstro',
    validation: { max: 140 }
  },
  {
    key: 'navigation.footerAttributionUrl',
    displayName: 'Footer Powered-By URL',
    description: 'Link target for the footer powered-by line.',
    type: 'string',
    category: 'navigation',
    defaultValue: 'https://github.com/burconsult/adastro'
  },
  {
    key: 'appearance.theme.active',
    displayName: 'Active Theme',
    description: 'Theme preset id applied across the site.',
    type: 'string',
    category: 'appearance',
    defaultValue: 'adastro',
    validation: { required: true, min: 2, max: 80 }
  },
  {
    key: 'appearance.theme.mode',
    displayName: 'Theme Mode',
    description: 'Default color mode (light, dark, or system).',
    type: 'string',
    category: 'appearance',
    defaultValue: 'system',
    validation: { required: true, options: ['light', 'dark', 'system'] }
  },
  {
    key: 'seo.defaultTitle',
    displayName: 'Default SEO Title',
    description: 'Default title template for SEO',
    type: 'string',
    category: 'seo',
    defaultValue: '%s | {{siteTitle}}',
    validation: { required: true, max: 60 }
  },
  {
    key: 'seo.defaultDescription',
    displayName: 'Default Meta Description',
    description: 'Default meta description for pages',
    type: 'string',
    category: 'seo',
    defaultValue: 'A practical, speed-first CMS built with Astro and Supabase.',
    validation: { max: 160 }
  },
  {
    key: 'seo.keywords',
    displayName: 'Default Keywords',
    description: 'Default keywords for SEO',
    type: 'array',
    category: 'seo',
    defaultValue: ['adastro', 'astro cms', 'performance cms']
  },
  {
    key: 'seo.ogImage',
    displayName: 'Default Open Graph Image',
    description: 'Default image for social media sharing',
    type: 'string',
    category: 'seo',
    defaultValue: '/images/og-default.jpg'
  },
  {
    key: 'content.articleBasePath',
    displayName: 'Articles Base Path',
    description: 'Public URL prefix for article index and post routes.',
    type: 'string',
    category: 'content',
    defaultValue: DEFAULT_ARTICLE_ROUTING.basePath,
    validation: { required: true, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' }
  },
  {
    key: 'content.articlePermalinkStyle',
    displayName: 'Article Permalink Style',
    description: 'Use segment-based URLs or WordPress-style date permalinks.',
    type: 'string',
    category: 'content',
    defaultValue: 'segment',
    validation: { required: true, options: ['segment', 'wordpress'] }
  },
  {
    key: 'content.postsPerPage',
    displayName: 'Posts Per Page',
    description: 'Number of posts to display per page',
    type: 'number',
    category: 'content',
    defaultValue: 10,
    validation: { required: true, min: 1, max: 50 }
  },
  {
    key: 'content.excerptLength',
    displayName: 'Excerpt Length',
    description: 'Maximum length for post excerpts',
    type: 'number',
    category: 'content',
    defaultValue: 150,
    validation: { min: 50, max: 500 }
  },
  {
    key: 'social.twitter',
    displayName: 'X (Twitter) Handle',
    description: 'Your X username (without @). Used for social cards and footer link.',
    type: 'string',
    category: 'social',
    defaultValue: ''
  },
  {
    key: 'social.facebook',
    displayName: 'Facebook Page',
    description: 'Your Facebook page URL',
    type: 'string',
    category: 'social',
    defaultValue: ''
  },
  {
    key: 'social.linkedin',
    displayName: 'LinkedIn Profile',
    description: 'Your LinkedIn profile URL',
    type: 'string',
    category: 'social',
    defaultValue: ''
  },
  {
    key: 'social.github',
    displayName: 'GitHub Profile',
    description: 'Your GitHub profile URL',
    type: 'string',
    category: 'social',
    defaultValue: 'https://github.com/burconsult/adastro'
  },
  {
    key: 'social.links',
    displayName: 'Additional Social Links',
    description: 'Optional custom networks shown in the footer Connect section.',
    type: 'json',
    category: 'social',
    defaultValue: []
  }
];

export const CORE_CATEGORY_ORDER = [
  'general',
  'security',
  'auth',
  'appearance',
  'navigation',
  'seo',
  'content',
  'social',
  'editor'
];

export const CATEGORY_META: Record<string, { displayName: string; description: string }> = {
  general: {
    displayName: 'General Settings',
    description: 'Basic site configuration and information'
  },
  navigation: {
    displayName: 'Navigation & Footer',
    description: 'Header/footer menus and the footer powered-by link'
  },
  security: {
    displayName: 'Security',
    description: 'Global anti-spam and hardening controls reused by optional features'
  },
  auth: {
    displayName: 'Authentication',
    description: 'Sign-in methods and OAuth provider visibility controls.'
  },
  appearance: {
    displayName: 'Appearance',
    description: 'Theme selection and global styling options'
  },
  seo: {
    displayName: 'SEO & Metadata',
    description: 'Search engine optimization and metadata settings'
  },
  content: {
    displayName: 'Content Settings',
    description: 'Content display and management options'
  },
  social: {
    displayName: 'Social Media',
    description: 'Social media integration settings'
  },
  editor: {
    displayName: 'Editor & Workflow',
    description: 'Editorial experience, workflows, and feature flags'
  },
  extras: {
    displayName: 'Extra Features',
    description: 'Optional feature modules you can enable or disable'
  }
};
