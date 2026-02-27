import './theme.css';
import type { ThemeModule } from '@/lib/themes/types';

export const THEME_MODULE: ThemeModule = {
  id: 'nordic-modern',
  label: 'Nordic Modern',
  description: 'Minimal Nordic neutrals with crisp blue accents.',
  version: '1.0.0',
  author: 'Kilpbase',
  accent: 'hsl(221 83.2% 53.3%)',
  fonts: {
    body: "'Inter Tight', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    heading: "'Instrument Serif', Georgia, 'Times New Roman', serif"
  },
  fontImports: [
    "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital,wght@0,400;0,700;1,400;1,700&family=Inter+Tight:wght@400;500;600;700&display=swap"
  ],
  source: 'installed'
};
