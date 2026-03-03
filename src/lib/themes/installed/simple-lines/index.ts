import './theme.css';
import type { ThemeModule } from '@/lib/themes/types';

export const THEME_MODULE: ThemeModule = {
  id: 'simple-lines',
  label: 'Simple Lines',
  description: 'Editorial paper tones with high-contrast linework and restrained accents.',
  version: '1.0.0',
  author: 'Burconsult',
  accent: 'hsl(40 62% 53%)',
  fonts: {
    body: '"IBM Plex Mono", "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    heading: '"Cormorant Garamond", "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif'
  },
  fontImports: [
    'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=IBM+Plex+Mono:wght@300;400;500;600&display=swap'
  ],
  source: 'installed'
};
