import type { ThemeModule } from './types.js';

const DEFAULT_THEME_FONTS = {
  body: '"Avenir Next", "Segoe UI", "Helvetica Neue", Arial, system-ui, -apple-system, sans-serif',
  heading: '"Palatino Linotype", "Book Antiqua", Palatino, "Times New Roman", serif'
};

export const CORE_THEME_MODULES: ThemeModule[] = [{
  id: 'adastro',
  label: 'AdAstro (Default)',
  description: 'Space-inspired contrast with cyan propulsion and amber highlights.',
  previewDescription: 'Crisp space-age neutrals, luminous cyan actions, and high-clarity editorial surfaces.',
  previewFeatures: ['Cyan action palette', 'Warm highlight accents', 'Balanced site/admin contrast'],
  fonts: DEFAULT_THEME_FONTS,
  source: 'core'
}];
