import './theme.css';
import type { ThemeModule } from '@/lib/themes/types';

export const THEME_MODULE: ThemeModule = {
  id: 'pulse',
  label: 'Pulse',
  description: 'Startup-grade blues with electric mint highlights.',
  version: '1.0.0',
  author: 'Adastro',
  accent: 'hsl(221 83% 53%)',
  fonts: {
    body: '"Outfit", "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    heading: '"Sora", "Space Grotesk", "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif'
  },
  fontImports: [
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Sora:wght@400;500;600;700&display=swap'
  ],
  source: 'installed'
};
