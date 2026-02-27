import type { FeatureDefinition, FeatureModule } from '../types.js';
import { CommentsSettingsPanel } from './admin/SettingsPanel.js';
import { COMMENTS_I18N } from './i18n.js';
import { COMMENTS_SETTINGS } from './settings.js';
import CommentsSection from './ui/CommentsSection.js';

export const COMMENTS_FEATURE: FeatureDefinition = {
  id: 'comments',
  label: 'Comments',
  description: 'Collect and moderate reader feedback on posts.',
  settings: COMMENTS_SETTINGS
};

export const COMMENTS_FEATURE_MODULE: FeatureModule = {
  id: COMMENTS_FEATURE.id,
  definition: COMMENTS_FEATURE,
  admin: {
    settingsPanel: CommentsSettingsPanel
  },
  ui: {
    public: {
      blogPostComments: CommentsSection
    }
  },
  i18n: COMMENTS_I18N
};

export const FEATURE_MODULE = COMMENTS_FEATURE_MODULE;
