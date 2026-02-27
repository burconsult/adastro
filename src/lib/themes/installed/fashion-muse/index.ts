import './theme.css';
import type { ThemeModule } from '@/lib/themes/types';

export const THEME_MODULE: ThemeModule = {
  id: 'fashion-muse',
  label: 'Fashion Muse',
  description: 'Editorial contrast with blush accents and polished neutrals.',
  version: '1.0.0',
  author: 'Burconsult',
  accent: 'hsl(330 65.9% 56.3%)',
  fonts: {
    body: "'Poppins', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    heading: "'Playfair Display', 'Georgia', 'Times New Roman', serif"
  },
  fontImports: [
    "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap"
  ],
  source: 'installed'
};
