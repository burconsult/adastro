import type { FeatureDefinition, FeatureModule } from '../types.js';
import { AI_SETTINGS } from './settings.js';
import { AiSettingsPanel } from './admin/SettingsPanel.js';
import { AiPostEditorTools } from './admin/PostEditorTools.js';
import { AiSeoActions } from './admin/SeoActions.js';
import { AiMediaLibraryPanel } from './admin/MediaLibraryPanel.js';
import { loadAiEditorTools } from './editorjs/tools.js';
import { AI_I18N } from './i18n.js';

export const AI_FEATURE: FeatureDefinition = {
  id: 'ai',
  label: 'AI Suite',
  description: 'Generate SEO metadata, images, and audio using configurable providers.',
  settings: AI_SETTINGS
};

export const AI_FEATURE_MODULE: FeatureModule = {
  id: AI_FEATURE.id,
  definition: AI_FEATURE,
  admin: {
    settingsPanel: AiSettingsPanel
  },
  ui: {
    postEditor: {
      sidebarPanel: AiPostEditorTools,
      seoActions: AiSeoActions,
      editorJsTools: loadAiEditorTools
    },
    mediaLibrary: {
      panel: AiMediaLibraryPanel
    }
  },
  i18n: AI_I18N
};

export const FEATURE_MODULE = AI_FEATURE_MODULE;
