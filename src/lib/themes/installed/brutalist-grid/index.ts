import './theme.css';
import type { ThemeModule } from '@/lib/themes/types';

export const THEME_MODULE: ThemeModule = {
  id: 'brutalist-grid',
  label: 'Brutalist Grid',
  description: 'Hard edges, strong contrast, orange heat with royal green accents.',
  previewDescription: 'Sharp corners, poster contrast, and assertive CTA treatment for bold editorial layouts.',
  previewFeatures: ['Hard-edge corners', 'High-contrast surfaces', 'Poster-style action colors'],
  version: '1.0.0',
  author: 'Burconsult',
  fonts: {
    body: '"IBM Plex Sans", "Avenir Next", "Segoe UI", Arial, sans-serif',
    heading: '"Archivo Black", "Arial Black", "Impact", sans-serif'
  },
  source: 'installed'
};
