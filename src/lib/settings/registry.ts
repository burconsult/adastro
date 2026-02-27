import { CORE_SETTINGS, CORE_CATEGORY_ORDER, CATEGORY_META } from './core-definitions.js';
import type { SettingDefinition } from './types.js';
import { FEATURE_CATEGORY, getFeatureSettingDefinitions } from '../features/registry.js';

const FEATURE_SETTINGS = getFeatureSettingDefinitions();

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  ...CORE_SETTINGS,
  ...FEATURE_SETTINGS
];

export const SETTINGS_CATEGORY_ORDER = [
  ...CORE_CATEGORY_ORDER,
  FEATURE_CATEGORY
];

export const SETTINGS_CATEGORY_META = CATEGORY_META;

export function getSettingDefinition(key: string): SettingDefinition | undefined {
  return SETTING_DEFINITIONS.find((definition) => definition.key === key);
}

export function getAllSettingDefinitions(): SettingDefinition[] {
  return [...SETTING_DEFINITIONS];
}

export function getCategoryList(): string[] {
  const definedCategories = new Set(SETTING_DEFINITIONS.map((definition) => definition.category));
  const ordered = SETTINGS_CATEGORY_ORDER.filter((category) => definedCategories.has(category));
  const remaining = [...definedCategories].filter((category) => !ordered.includes(category)).sort();
  return [...ordered, ...remaining];
}
