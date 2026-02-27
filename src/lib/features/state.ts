import { SettingsService } from '../services/settings-service.js';
import { loadFeatureModules } from './loader.js';
import { normalizeFeatureFlag } from './flags.js';

export const getFeatureEnabledSettingKey = (featureId: string): string | null => {
  const featureModule = loadFeatureModules().find((module) => module.id === featureId);
  if (!featureModule) return null;

  return featureModule.definition.settings.find((setting) => setting.key === `features.${featureId}.enabled`)?.key ?? null;
};

export async function isFeatureActive(featureId: string): Promise<boolean> {
  const enabledSettingKey = getFeatureEnabledSettingKey(featureId);
  if (enabledSettingKey === null) {
    const featureModule = loadFeatureModules().find((module) => module.id === featureId);
    if (featureModule) {
      return true;
    }
    return false;
  }

  try {
    const featureModule = loadFeatureModules().find((module) => module.id === featureId);
    const enabledDefinition = featureModule?.definition.settings.find(
      (setting) => setting.key === enabledSettingKey
    );
    const defaultEnabled = typeof enabledDefinition?.defaultValue === 'boolean'
      ? enabledDefinition.defaultValue
      : true;
    const settingsService = new SettingsService();
    const enabled = await settingsService.getSetting(enabledSettingKey);
    return normalizeFeatureFlag(enabled, defaultEnabled);
  } catch (error) {
    console.warn(`Failed to resolve feature state for "${featureId}". Rendering as inactive.`, error);
    return false;
  }
}
