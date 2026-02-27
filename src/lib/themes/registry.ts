import { THEME_MANIFEST } from './manifest.js';
import type { ThemeModule } from './types.js';

export const getThemeModules = (): ThemeModule[] => THEME_MANIFEST;
const THEME_LOOKUP = new Map(THEME_MANIFEST.map((theme) => [theme.id, theme] as const));

export const getThemeModuleById = (id: string): ThemeModule | null => {
  return THEME_LOOKUP.get(id) ?? null;
};
