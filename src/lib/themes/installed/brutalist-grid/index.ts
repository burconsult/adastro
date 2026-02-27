import './theme.css';
import type { ThemeModule } from '@/lib/themes/types';

export const THEME_MODULE: ThemeModule = {
  id: 'brutalist-grid',
  label: 'Brutalist Grid',
  description: 'Hard edges, strong contrast, orange heat with royal green accents.',
  version: '1.0.0',
  author: 'AdAstro',
  accent: 'hsl(28 96% 51%)',
  fonts: {
    body: '"IBM Plex Sans", "Avenir Next", "Segoe UI", Arial, sans-serif',
    heading: '"Archivo Black", "Arial Black", "Impact", sans-serif'
  },
  source: 'installed'
};
