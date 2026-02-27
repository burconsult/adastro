import type { FeatureDefinition } from './types.js';
import { loadFeatureDefinitions } from './loader.js';

export const FEATURES: FeatureDefinition[] = loadFeatureDefinitions();

export const FEATURE_CATEGORY = 'extras';

export function getFeatureById(id: string): FeatureDefinition | undefined {
  return FEATURES.find((feature) => feature.id === id);
}

export function getFeatureSettings(): FeatureDefinition[] {
  return FEATURES;
}

export function getFeatureSettingDefinitions() {
  return FEATURES.flatMap((feature) => feature.settings);
}
