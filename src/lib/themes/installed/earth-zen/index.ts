import './theme.css';
import type { ThemeModule } from '@/lib/themes/types';

export const THEME_MODULE: ThemeModule = {
  id: 'earth-zen',
  label: 'Earth Zen',
  description: 'Earthy greens and warm neutrals with calm balance.',
  version: '1.0.0',
  author: 'Burconsult',
  accent: 'hsl(0 0% 100%)',
  fonts: {
    body: "'Quicksand', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    heading: "'Cormorant Garamond', 'Georgia', 'Times New Roman', serif"
  },
  fontImports: [
    "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Quicksand:wght@400;500;600;700&display=swap"
  ],
  source: 'installed'
};
