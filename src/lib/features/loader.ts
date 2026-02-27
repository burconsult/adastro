import type { FeatureDefinition, FeatureModule } from './types.js';
import { FEATURE_MANIFEST } from './manifest.js';

const normalizeModules = (modules: FeatureModule[]): FeatureModule[] => {
  const seen = new Set<string>();
  const normalized: FeatureModule[] = [];

  for (const module of modules) {
    if (!module?.id || !module.definition) continue;
    if (seen.has(module.id)) continue;
    seen.add(module.id);
    normalized.push(module);
  }

  return normalized;
};

const MODULES = normalizeModules(FEATURE_MANIFEST);
const DEFINITIONS = MODULES.map((module) => module.definition);

export function loadFeatureModules(): FeatureModule[] {
  return [...MODULES];
}

export function loadFeatureDefinitions(): FeatureDefinition[] {
  return [...DEFINITIONS];
}
