import type { ComponentType } from 'react';
import type { FeatureSettingsPanelProps } from './types.js';
import { loadFeatureModules } from './loader.js';

export interface FeatureSettingsPanelDefinition {
  id: string;
  label: string;
  description: string;
  Panel: ComponentType<FeatureSettingsPanelProps>;
}

export function getFeatureSettingsPanels(): FeatureSettingsPanelDefinition[] {
  return loadFeatureModules()
    .filter((module) => module.admin?.settingsPanel)
    .map((module) => ({
      id: module.id,
      label: module.definition.label,
      description: module.definition.description,
      Panel: module.admin!.settingsPanel!
    }));
}
