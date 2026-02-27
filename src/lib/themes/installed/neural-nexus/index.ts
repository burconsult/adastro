import './theme.css';
import type { ThemeModule } from '@/lib/themes/types';

export const THEME_MODULE: ThemeModule = {
  id: 'neural-nexus',
  label: 'Neural Nexus',
  description: 'Electric purples with neon teal accents.',
  version: '1.0.0',
  author: 'Kilpbase',
  accent: 'hsl(258 89.5% 66.3%)',
  fonts: {
    body: "'Space Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    heading: "'JetBrains Mono', 'Courier New', monospace"
  },
  fontImports: [
    "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
  ],
  source: 'installed'
};
