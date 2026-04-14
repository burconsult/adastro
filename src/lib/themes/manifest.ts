import type { ThemeModule } from './types.js';
import { CORE_THEME_MODULES } from './core.js';
import THEME_PULSE_MODULE from './installed/pulse/theme.json';
import THEME_NORDIC_MODERN_MODULE from './installed/nordic-modern/theme.json';
import THEME_EARTH_ZEN_MODULE from './installed/earth-zen/theme.json';
import THEME_FASHION_MUSE_MODULE from './installed/fashion-muse/theme.json';
import THEME_MONOCHROME_CALM_MODULE from './installed/monochrome-calm/theme.json';
import THEME_NEURAL_NEXUS_MODULE from './installed/neural-nexus/theme.json';
import THEME_BRUTALIST_GRID_MODULE from './installed/brutalist-grid/theme.json';
import THEME_SIMPLE_LINES_MODULE from './installed/simple-lines/theme.json';
import THEME_LOAN_BOX_MODULE from './installed/loan-box/theme.json';
// @theme-installer-imports

type ThemeMetadataJson = ThemeModule & {
  entry?: string;
};

const createInstalledThemeModule = (theme: ThemeMetadataJson): ThemeModule => {
  const { entry: _entry, source: _source, ...metadata } = theme;
  return {
    ...metadata,
    source: 'installed'
  };
};

export const THEME_MANIFEST: ThemeModule[] = [
  ...CORE_THEME_MODULES,
  createInstalledThemeModule(THEME_PULSE_MODULE),
  createInstalledThemeModule(THEME_NORDIC_MODERN_MODULE),
  createInstalledThemeModule(THEME_EARTH_ZEN_MODULE),
  createInstalledThemeModule(THEME_FASHION_MUSE_MODULE),
  createInstalledThemeModule(THEME_MONOCHROME_CALM_MODULE),
  createInstalledThemeModule(THEME_NEURAL_NEXUS_MODULE),
  createInstalledThemeModule(THEME_BRUTALIST_GRID_MODULE),
  createInstalledThemeModule(THEME_SIMPLE_LINES_MODULE),
  createInstalledThemeModule(THEME_LOAN_BOX_MODULE),
  // @theme-installer-list
];
