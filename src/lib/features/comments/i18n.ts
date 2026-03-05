import type { FeatureI18nMessages } from '../types.js';

type FeatureMessageModule = { default: Record<string, string> };

const MESSAGE_MODULES = import.meta.glob<FeatureMessageModule>('./messages/*.json', { eager: true });

export const COMMENTS_I18N: FeatureI18nMessages = Object.entries(MESSAGE_MODULES).reduce(
  (acc, [modulePath, module]) => {
    const fileName = modulePath.split('/').pop() || '';
    const locale = fileName.replace(/\.json$/i, '').trim().toLowerCase();
    if (!locale) return acc;
    acc[locale] = module.default || {};
    return acc;
  },
  {} as FeatureI18nMessages
);
