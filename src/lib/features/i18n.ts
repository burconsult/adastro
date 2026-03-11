import type { FeatureI18nMessages } from './types.js';
import { getFeatureLocaleMessages } from '../i18n/catalog.js';

export const loadFeatureMessages = (): FeatureI18nMessages => getFeatureLocaleMessages();
