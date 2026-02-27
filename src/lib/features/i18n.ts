import type { FeatureI18nMessages } from './types.js';
import { loadFeatureModules } from './loader.js';

export const loadFeatureMessages = (): FeatureI18nMessages => {
  const messages: FeatureI18nMessages = {};

  loadFeatureModules().forEach((module) => {
    if (!module.i18n) return;
    Object.entries(module.i18n).forEach(([locale, localeMessages]) => {
      if (!messages[locale]) {
        messages[locale] = {};
      }
      Object.assign(messages[locale], localeMessages);
    });
  });

  return messages;
};
