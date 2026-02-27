import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/auth/auth-helpers.js';
import { loadFeatureModules } from '../../../../lib/features/loader.js';
import { normalizeFeatureFlag } from '../../../../lib/features/flags.js';
import { SettingsService } from '../../../../lib/services/settings-service.js';

const settingsService = new SettingsService();

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const modules = loadFeatureModules();
    const enabledSettingKeys = modules
      .map((module) => module.definition.settings.find((setting) => setting.key === `features.${module.id}.enabled`)?.key)
      .filter((value): value is string => Boolean(value));
    const enabledSettings = enabledSettingKeys.length > 0
      ? await settingsService.getSettings(enabledSettingKeys)
      : {};

    const features = modules.map((module) => {
      const enabledKey = module.definition.settings.find(
        (setting) => setting.key === `features.${module.id}.enabled`
      )?.key;
      const toggleable = Boolean(enabledKey);
      const enabledDefinition = module.definition.settings.find((setting) => setting.key === enabledKey);
      const defaultEnabled = typeof enabledDefinition?.defaultValue === 'boolean'
        ? enabledDefinition.defaultValue
        : true;
      const active = enabledKey
        ? normalizeFeatureFlag(enabledSettings[enabledKey], defaultEnabled)
        : true;
      return {
        id: module.id,
        label: module.definition.label,
        description: module.definition.description,
        active,
        toggleable
      };
    });

    return new Response(JSON.stringify({ features }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error loading features:', error);
    return new Response(JSON.stringify({ error: 'Failed to load features' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
