import type { ThemeModule } from './types.js';
import { CORE_THEME_MODULES } from './core.js';
import { THEME_MODULE as THEME_PULSE_MODULE } from './installed/pulse/index.js';
import { THEME_MODULE as THEME_NORDIC_MODERN_MODULE } from './installed/nordic-modern/index.js';
import { THEME_MODULE as THEME_EARTH_ZEN_MODULE } from './installed/earth-zen/index.js';
import { THEME_MODULE as THEME_FASHION_MUSE_MODULE } from './installed/fashion-muse/index.js';
import { THEME_MODULE as THEME_MONOCHROME_CALM_MODULE } from './installed/monochrome-calm/index.js';
import { THEME_MODULE as THEME_NEURAL_NEXUS_MODULE } from './installed/neural-nexus/index.js';
import { THEME_MODULE as THEME_BRUTALIST_GRID_MODULE } from './installed/brutalist-grid/index.js';
import { THEME_MODULE as THEME_SIMPLE_LINES_MODULE } from './installed/simple-lines/index.js';
// @theme-installer-imports

export const THEME_MANIFEST: ThemeModule[] = [
  ...CORE_THEME_MODULES,
  THEME_PULSE_MODULE,
  THEME_NORDIC_MODERN_MODULE,
  THEME_EARTH_ZEN_MODULE,
  THEME_FASHION_MUSE_MODULE,
  THEME_MONOCHROME_CALM_MODULE,
  THEME_NEURAL_NEXUS_MODULE,
  THEME_BRUTALIST_GRID_MODULE,
  THEME_SIMPLE_LINES_MODULE,
  // @theme-installer-list
];
