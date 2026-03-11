import { loadFeatureModules } from '@/lib/features/loader';
import { DEFAULT_LOCALE, normalizeLocaleCode } from './locales';

export const LOCALE_CATALOG_VERSION = '1.1.0';
export const LOCALE_SCHEMA_VERSION = '1';
export const LOCALE_META_PREFIX = '_meta.';

export type MessageDictionary = Record<string, string>;

type MessageModule = { default: Record<string, unknown> };

export type LocalePackScope = 'core' | 'feature';

export type LocalePackMeta = {
  locale: string;
  scope: LocalePackScope;
  featureId?: string;
  catalogVersion: string;
  schemaVersion: string;
  fallbackLocale: string;
};

export type LocalePack = {
  locale: string;
  messages: MessageDictionary;
  meta: LocalePackMeta;
};

export type LocalePackHealth = {
  locale: string;
  displayName: string;
  isActive: boolean;
  isDefault: boolean;
  hasCorePack: boolean;
  coreStatus: 'ok' | 'version-mismatch' | 'missing';
  coreMessageCount: number;
  missingCoreKeys: string[];
  features: Array<{
    featureId: string;
    status: 'ok' | 'fallback' | 'version-mismatch' | 'missing-en';
    hasLocalePack: boolean;
    usesEnglishFallback: boolean;
    messageCount: number;
    missingKeys: string[];
    meta?: LocalePackMeta;
  }>;
};

const CORE_MESSAGE_MODULES = import.meta.glob<MessageModule>('./messages/*.json', { eager: true });
const FEATURE_MESSAGE_MODULES = import.meta.glob<MessageModule>('../features/*/messages/*.json', { eager: true });

const isLocaleMetaKey = (key: string) => key.startsWith(LOCALE_META_PREFIX);

const sanitizeMessages = (value: Record<string, unknown>): MessageDictionary => (
  Object.fromEntries(
    Object.entries(value).filter(([key, rawValue]) => !isLocaleMetaKey(key) && typeof rawValue === 'string')
  )
);

const extractMeta = (
  value: Record<string, unknown>,
  defaults: { locale: string; scope: LocalePackScope; featureId?: string }
): LocalePackMeta => {
  const locale = normalizeLocaleCode(value[`${LOCALE_META_PREFIX}locale`] ?? defaults.locale, defaults.locale);
  const catalogVersion = typeof value[`${LOCALE_META_PREFIX}catalogVersion`] === 'string'
    ? String(value[`${LOCALE_META_PREFIX}catalogVersion`]).trim() || LOCALE_CATALOG_VERSION
    : LOCALE_CATALOG_VERSION;
  const schemaVersion = typeof value[`${LOCALE_META_PREFIX}schemaVersion`] === 'string'
    ? String(value[`${LOCALE_META_PREFIX}schemaVersion`]).trim() || LOCALE_SCHEMA_VERSION
    : LOCALE_SCHEMA_VERSION;
  const fallbackLocale = normalizeLocaleCode(
    value[`${LOCALE_META_PREFIX}fallbackLocale`] ?? DEFAULT_LOCALE,
    DEFAULT_LOCALE
  );

  return {
    locale,
    scope: defaults.scope,
    featureId: defaults.featureId,
    catalogVersion,
    schemaVersion,
    fallbackLocale
  };
};

const getLocaleDisplayName = (locale: string): string => {
  const normalized = normalizeLocaleCode(locale, DEFAULT_LOCALE);
  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
    return displayNames.of(normalized) || normalized.toUpperCase();
  } catch {
    return normalized.toUpperCase();
  }
};

const buildCorePacks = (): Record<string, LocalePack> => (
  Object.entries(CORE_MESSAGE_MODULES).reduce((acc, [modulePath, module]) => {
    const fileName = modulePath.split('/').pop() || '';
    const locale = fileName.replace(/\.json$/i, '').trim().toLowerCase();
    if (!locale) return acc;
    const raw = module.default || {};
    acc[locale] = {
      locale,
      messages: sanitizeMessages(raw),
      meta: extractMeta(raw, { locale, scope: 'core' })
    };
    return acc;
  }, {} as Record<string, LocalePack>)
);

const buildFeaturePacks = (): Record<string, Record<string, LocalePack>> => (
  Object.entries(FEATURE_MESSAGE_MODULES).reduce((acc, [modulePath, module]) => {
    const match = modulePath.match(/\/features\/([^/]+)\/messages\/([^/]+)\.json$/);
    if (!match) return acc;
    const featureId = match[1];
    const locale = match[2].trim().toLowerCase();
    if (!featureId || !locale) return acc;
    const raw = module.default || {};
    if (!acc[featureId]) {
      acc[featureId] = {};
    }
    acc[featureId][locale] = {
      locale,
      messages: sanitizeMessages(raw),
      meta: extractMeta(raw, { locale, scope: 'feature', featureId })
    };
    return acc;
  }, {} as Record<string, Record<string, LocalePack>>)
);

const CORE_PACKS = buildCorePacks();
const FEATURE_PACKS = buildFeaturePacks();

export const getCoreLocalePacks = (): Record<string, LocalePack> => CORE_PACKS;

export const getFeatureLocalePacks = (): Record<string, Record<string, LocalePack>> => FEATURE_PACKS;

export const getFeatureLocaleMessages = (): Record<string, Record<string, string>> => {
  const messagesByLocale: Record<string, Record<string, string>> = {};
  Object.values(FEATURE_PACKS).forEach((localeMap) => {
    Object.entries(localeMap).forEach(([locale, pack]) => {
      if (!messagesByLocale[locale]) {
        messagesByLocale[locale] = {};
      }
      Object.assign(messagesByLocale[locale], pack.messages);
    });
  });
  return messagesByLocale;
};

export const getCoreLocaleMessages = (): Record<string, MessageDictionary> => (
  Object.fromEntries(
    Object.entries(CORE_PACKS).map(([locale, pack]) => [locale, pack.messages])
  )
);

export const getAvailableLocaleCodes = (): string[] => {
  const featureLocales = Object.values(FEATURE_PACKS).flatMap((localeMap) => Object.keys(localeMap));
  return Array.from(new Set([...Object.keys(CORE_PACKS), ...featureLocales])).sort((a, b) => a.localeCompare(b));
};

export const getLocaleDisplayLabel = (locale: string): string => getLocaleDisplayName(locale);

const getFeatureIds = (): string[] => Array.from(new Set(loadFeatureModules().map((module) => module.id))).sort();

export const getLocalePackHealth = (options: {
  activeLocales: string[];
  defaultLocale: string;
}): LocalePackHealth[] => {
  const activeLocaleSet = new Set(options.activeLocales.map((locale) => normalizeLocaleCode(locale, DEFAULT_LOCALE)));
  const normalizedDefaultLocale = normalizeLocaleCode(options.defaultLocale, DEFAULT_LOCALE);
  const referenceCore = CORE_PACKS[DEFAULT_LOCALE];
  const featureIds = getFeatureIds();

  return getAvailableLocaleCodes().map((locale) => {
    const normalizedLocale = normalizeLocaleCode(locale, DEFAULT_LOCALE);
    const corePack = CORE_PACKS[normalizedLocale];
    const referenceCoreVersion = referenceCore?.meta.catalogVersion || LOCALE_CATALOG_VERSION;
    const referenceCoreSchemaVersion = referenceCore?.meta.schemaVersion || LOCALE_SCHEMA_VERSION;
    const coreStatus = !corePack
      ? 'missing'
      : corePack.meta.catalogVersion !== referenceCoreVersion || corePack.meta.schemaVersion !== referenceCoreSchemaVersion
        ? 'version-mismatch'
        : 'ok';
    const referenceCoreKeys = new Set(Object.keys(referenceCore?.messages || {}));
    const localeCoreKeys = new Set(Object.keys(corePack?.messages || {}));
    const missingCoreKeys = [...referenceCoreKeys].filter((key) => !localeCoreKeys.has(key)).sort();

    const features = featureIds.map((featureId) => {
      const featurePacks = FEATURE_PACKS[featureId] || {};
      const localePack = featurePacks[normalizedLocale];
      const englishPack = featurePacks[DEFAULT_LOCALE];
      const referenceFeatureVersion = englishPack?.meta.catalogVersion || LOCALE_CATALOG_VERSION;
      const referenceFeatureSchemaVersion = englishPack?.meta.schemaVersion || LOCALE_SCHEMA_VERSION;
      const featureReferenceKeys = new Set(Object.keys(englishPack?.messages || {}));
      const localeFeatureKeys = new Set(Object.keys(localePack?.messages || englishPack?.messages || {}));
      const missingKeys = [...featureReferenceKeys].filter((key) => !localeFeatureKeys.has(key)).sort();

      let status: 'ok' | 'fallback' | 'version-mismatch' | 'missing-en' = 'ok';
      if (!englishPack) {
        status = 'missing-en';
      } else if (!localePack && normalizedLocale !== DEFAULT_LOCALE) {
        status = 'fallback';
      } else if (localePack && (
        localePack.meta.catalogVersion !== referenceFeatureVersion
        || localePack.meta.schemaVersion !== referenceFeatureSchemaVersion
      )) {
        status = 'version-mismatch';
      }

      return {
        featureId,
        status,
        hasLocalePack: Boolean(localePack),
        usesEnglishFallback: Boolean(!localePack && normalizedLocale !== DEFAULT_LOCALE && englishPack),
        messageCount: Object.keys((localePack || englishPack || { messages: {} }).messages).length,
        missingKeys,
        meta: localePack?.meta
      };
    });

    return {
      locale: normalizedLocale,
      displayName: getLocaleDisplayName(normalizedLocale),
      isActive: activeLocaleSet.has(normalizedLocale),
      isDefault: normalizedLocale === normalizedDefaultLocale,
      hasCorePack: Boolean(corePack),
      coreStatus,
      coreMessageCount: Object.keys(corePack?.messages || {}).length,
      missingCoreKeys,
      features
    };
  });
};
