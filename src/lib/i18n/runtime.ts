import { loadFeatureMessages } from '@/lib/features/i18n';
import { DEFAULT_LOCALE, normalizeLocaleCode } from './locales';

export type MessageDictionary = Record<string, string>;

type CoreMessageModule = { default: MessageDictionary };

const CORE_MESSAGE_MODULES = import.meta.glob<CoreMessageModule>('./messages/*.json', { eager: true });

const CORE_MESSAGES: Record<string, MessageDictionary> = Object.entries(CORE_MESSAGE_MODULES).reduce(
  (acc, [modulePath, module]) => {
    const fileName = modulePath.split('/').pop() || '';
    const locale = fileName.replace(/\.json$/i, '').trim().toLowerCase();
    if (!locale) return acc;
    acc[locale] = module.default || {};
    return acc;
  },
  {} as Record<string, MessageDictionary>
);

const FEATURE_MESSAGES = loadFeatureMessages();

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
