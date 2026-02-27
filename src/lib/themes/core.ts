import type { ThemeModule } from './types.js';

const DEFAULT_THEME_FONTS = {
  body: '"Avenir Next", "Segoe UI", "Helvetica Neue", Arial, system-ui, -apple-system, sans-serif',
  heading: '"Palatino Linotype", "Book Antiqua", Palatino, "Times New Roman", serif'
};

const DEFAULT_FONT_IMPORTS: string[] = [];

export const CORE_THEME_MODULES: ThemeModule[] = [{
  id: 'adastro',
  label: 'AdAstro (Default)',
  description: 'Space-inspired contrast with cyan propulsion and amber highlights.',
  accent: 'hsl(194 88% 46%)',
  fonts: DEFAULT_THEME_FONTS,
  fontImports: DEFAULT_FONT_IMPORTS,
  source: 'core'
}];
