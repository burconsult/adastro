import type { FeatureDefinition, FeatureModule } from '../types.js';
import { NewsletterSettingsPanel } from './admin/SettingsPanel.js';
import { NewsletterProfilePanel } from './profile/NewsletterProfilePanel.js';
import { NEWSLETTER_I18N } from './i18n.js';
import { NEWSLETTER_SETTINGS } from './settings.js';
import NewsletterSignup from './ui/NewsletterSignup.js';
import { NewsletterPostEditorPanel } from './admin/PostEditorPanel.js';

export const NEWSLETTER_FEATURE: FeatureDefinition = {
  id: 'newsletter',
  label: 'Newsletter',
  description: 'Send post updates and editorial newsletters to subscribers.',
  settings: NEWSLETTER_SETTINGS
};

export const NEWSLETTER_FEATURE_MODULE: FeatureModule = {
  id: NEWSLETTER_FEATURE.id,
  definition: NEWSLETTER_FEATURE,
  admin: {
    settingsPanel: NewsletterSettingsPanel
  },
  ui: {
    postEditor: {
      sidebarPanel: NewsletterPostEditorPanel
    },
    profile: {
      panel: NewsletterProfilePanel
    },
    public: {
      footerNewsletterSignup: NewsletterSignup
    }
  },
  i18n: NEWSLETTER_I18N
};

export const FEATURE_MODULE = NEWSLETTER_FEATURE_MODULE;
