import type { FeatureServerModule } from './types.js';
import { FEATURE_SERVER_MANIFEST } from './server-manifest.js';

const normalizeServerModules = (modules: FeatureServerModule[]): FeatureServerModule[] => {
  const seen = new Set<string>();
  const normalized: FeatureServerModule[] = [];

  for (const module of modules) {
    if (!module?.id) continue;
    if (seen.has(module.id)) continue;
    seen.add(module.id);
    normalized.push(module);
  }

  return normalized;
};

const SERVER_MODULES = normalizeServerModules(FEATURE_SERVER_MANIFEST);

export function loadFeatureServerModules(): FeatureServerModule[] {
  return [...SERVER_MODULES];
}
