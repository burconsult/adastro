import {
  getCoreLocaleMessages,
  getFeatureLocaleMessages as getCatalogFeatureLocaleMessages
} from './catalog';
import { DEFAULT_LOCALE, normalizeLocaleCode } from './locales';

export type MessageDictionary = Record<string, string>;
const CORE_MESSAGES = getCoreLocaleMessages();
const FEATURE_MESSAGES = getCatalogFeatureLocaleMessages();

const getCoreMessages = (locale: string): MessageDictionary => {
  const normalizedLocale = normalizeLocaleCode(locale, DEFAULT_LOCALE);
  if (CORE_MESSAGES[normalizedLocale]) return CORE_MESSAGES[normalizedLocale];
  const languageFallback = normalizedLocale.split('-')[0];
  return CORE_MESSAGES[languageFallback] || CORE_MESSAGES[DEFAULT_LOCALE] || {};
};

const getFeatureLocaleMessages = (locale: string): MessageDictionary => {
  const normalizedLocale = normalizeLocaleCode(locale, DEFAULT_LOCALE);
  if (FEATURE_MESSAGES[normalizedLocale]) return FEATURE_MESSAGES[normalizedLocale];
  const languageFallback = normalizedLocale.split('-')[0];
  return FEATURE_MESSAGES[languageFallback] || FEATURE_MESSAGES[DEFAULT_LOCALE] || {};
};

export const getLocaleMessages = (locale: string): MessageDictionary => {
  const normalizedLocale = normalizeLocaleCode(locale, DEFAULT_LOCALE);
  const defaultCore = getCoreMessages(DEFAULT_LOCALE);
  const localeCore = getCoreMessages(normalizedLocale);
  const defaultFeature = getFeatureLocaleMessages(DEFAULT_LOCALE);
  const localeFeature = getFeatureLocaleMessages(normalizedLocale);

  return {
    ...defaultCore,
    ...defaultFeature,
    ...localeCore,
    ...localeFeature
  };
};

export const t = (messages: MessageDictionary, key: string, fallback: string): string => (
  messages[key] || fallback
);
