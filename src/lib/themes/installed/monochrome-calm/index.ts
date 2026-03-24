import './theme.css';
import type { ThemeModule } from '@/lib/themes/types';

export const THEME_MODULE: ThemeModule = {
  id: 'monochrome-calm',
  label: 'Monochrome Calm',
  description: 'High-contrast grayscale with soft muted tones.',
  previewDescription: 'Refined grayscale surfaces with muted hierarchy and restrained, readable admin accents.',
  previewFeatures: ['Neutral-only palette', 'Low-noise status treatment', 'Quiet editorial typography'],
  version: '1.0.0',
  author: 'Burconsult',
  fonts: {
    body: "'Montserrat', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    heading: "'Libre Baskerville', 'Georgia', 'Times New Roman', serif"
  },
  source: 'installed'
};
