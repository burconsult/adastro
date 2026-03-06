import type { FeatureApiHandler, FeatureMcpExtension, FeatureProfileApiExtension } from './types.js';
import { loadFeatureServerModules } from './server-loader.js';

const MODULES = loadFeatureServerModules();

export function getFeatureModule(id: string) {
  return MODULES.find((module) => module.id === id);
}

export async function getFeatureApiHandler(
  featureId: string,
  action: string
): Promise<FeatureApiHandler | undefined> {
  const module = getFeatureModule(featureId);
  if (!module?.loadApi) return undefined;
  const apiModule = await module.loadApi();
  return apiModule.handlers[action];
}

export function getProfileApiExtensions(): FeatureProfileApiExtension[] {
  return MODULES
    .map((module) => module.server?.profileApi)
    .filter((extension): extension is FeatureProfileApiExtension => Boolean(extension));
}

export function getFeatureMcpExtensions(): Array<{ featureId: string; extension: FeatureMcpExtension }> {
  return MODULES
    .map((module) => {
      const extension = module.server?.mcp;
      if (!extension) return null;
      return {
        featureId: module.id,
        extension
      };
    })
    .filter((entry): entry is { featureId: string; extension: FeatureMcpExtension } => Boolean(entry));
}
