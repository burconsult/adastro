import './theme.css';
import type { ThemeModule } from '@/lib/themes/types';

export const THEME_MODULE: ThemeModule = {
  id: 'fashion-muse',
  label: 'Fashion Muse',
  description: 'Editorial contrast with blush accents and polished neutrals.',
  previewDescription: 'Soft blush surfaces and magazine-inspired typography with polished action and status colors.',
  previewFeatures: ['Editorial serif headings', 'Blush neutral palette', 'Luxe admin accents'],
  version: '1.0.0',
  author: 'Burconsult',
  fonts: {
    body: "'Poppins', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    heading: "'Playfair Display', 'Georgia', 'Times New Roman', serif"
  },
  source: 'installed'
};
