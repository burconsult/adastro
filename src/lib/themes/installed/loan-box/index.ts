import './theme.css';
import type { ThemeModule } from '@/lib/themes/types';

export const THEME_MODULE: ThemeModule = {
  id: 'loan-box',
  label: 'Loan Box',
  description: 'Public-service purple with slate neutrals and crisp utility accents.',
  version: '1.0.0',
  author: 'Codex',
  accent: 'hsl(278.1 92.3% 20.4%)',
  fonts: {
    body: "'Roboto', 'Helvetica Neue', Arial, sans-serif",
    heading: "'Rubik', 'Helvetica Neue', Arial, sans-serif"
  },
  fontImports: [
    'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Rubik:wght@400;500;600;700&display=swap'
  ],
  source: 'installed'
};
