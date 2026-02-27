import './theme.css';
import type { ThemeModule } from '@/lib/themes/types';

export const THEME_MODULE: ThemeModule = {
  id: 'monochrome-calm',
  label: 'Monochrome Calm',
  description: 'High-contrast grayscale with soft muted tones.',
  version: '1.0.0',
  author: 'Kilpbase',
  accent: 'hsl(60 2.7% 29%)',
  fonts: {
    body: "'Montserrat', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    heading: "'Libre Baskerville', 'Georgia', 'Times New Roman', serif"
  },
  fontImports: [
    "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&family=Libre+Baskerville:wght@400;700&display=swap"
  ],
  source: 'installed'
};
