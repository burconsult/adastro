# Theme Packages

Theme packages are installable bundles that add new `data-theme` palettes without
changing the core codebase. A theme package ships its own CSS variables and
metadata so it can be activated from the admin dashboard.

## Package Structure

```
my-theme/
  theme.json
  index.ts
  theme.css
```

## theme.json (required)

```json
{
  "id": "midnight-ocean",
  "label": "Midnight Ocean",
  "description": "Inky blues with sea-glass accents.",
  "version": "1.0.0",
  "author": "Burconsult",
  "entry": "index.ts",
  "fontImports": [
    "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&family=Sora:wght@400;600;700&display=swap"
  ],
  "fonts": {
    "body": "\"Outfit\", system-ui, sans-serif",
    "heading": "\"Sora\", system-ui, sans-serif"
  }
}
```

## index.ts (required)

```ts
import './theme.css';
import type { ThemeModule } from '@/lib/themes/types';

export const THEME_MODULE: ThemeModule = {
  id: 'midnight-ocean',
  label: 'Midnight Ocean',
  description: 'Inky blues with sea-glass accents.',
  version: '1.0.0',
  author: 'Burconsult',
  accent: 'hsl(198 78% 44%)',
  fonts: {
    body: '"Outfit", system-ui, sans-serif',
    heading: '"Sora", system-ui, sans-serif'
  },
  fontImports: [
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&family=Sora:wght@400;600;700&display=swap'
  ],
  source: 'installed'
};
```

## theme.css (required)

Theme CSS defines variables for both light and dark mode using the
`data-theme` attribute. Variables should follow the core token names.
Beyond colors and fonts, themes can also control geometry and elevation:

- `--radius` (drives `rounded`, `rounded-sm` ... `rounded-3xl`)
- `--elevation-sm|md|lg|xl|2xl` (drives `shadow-sm` ... `shadow-2xl`)
- `--surface-border-width` (used by shared surface components like `.card`)

```css
:root[data-theme="midnight-ocean"] {
  --background: 222 28% 12%;
  --foreground: 210 40% 98%;
  --primary: 196 74% 50%;
  --primary-foreground: 210 30% 10%;
  --accent: 186 52% 22%;
  --accent-foreground: 180 40% 96%;
  --border: 220 18% 22%;
  --input: 220 18% 22%;
  --ring: 196 74% 50%;
  --radius: 0.5rem;
  --elevation-sm: 0 1px 2px hsl(var(--foreground) / 0.08);
  --elevation-md: 0 6px 14px hsl(var(--foreground) / 0.1);
  --elevation-lg: 0 12px 24px hsl(var(--foreground) / 0.12);
  --elevation-xl: 0 18px 34px hsl(var(--foreground) / 0.14);
  --elevation-2xl: 0 26px 46px hsl(var(--foreground) / 0.18);
  --surface-border-width: 1px;
  --font-body: "Outfit", system-ui, sans-serif;
  --font-heading: "Sora", system-ui, sans-serif;
  --font-sans: var(--font-body);
  --font-serif: var(--font-heading);
}

.dark[data-theme="midnight-ocean"] {
  --background: 220 30% 6%;
  --foreground: 210 40% 98%;
  --primary: 196 74% 56%;
  --primary-foreground: 210 30% 10%;
  --accent: 186 42% 18%;
  --accent-foreground: 180 40% 96%;
  --border: 220 18% 16%;
  --input: 220 18% 16%;
  --ring: 196 74% 56%;
  --radius: 0.5rem;
  --elevation-sm: 0 1px 2px hsl(var(--foreground) / 0.12);
  --elevation-md: 0 8px 16px hsl(var(--background) / 0.5);
  --elevation-lg: 0 14px 28px hsl(var(--background) / 0.55);
  --elevation-xl: 0 20px 36px hsl(var(--background) / 0.58);
  --elevation-2xl: 0 28px 48px hsl(var(--background) / 0.6);
  --surface-border-width: 1px;
  --font-body: "Outfit", system-ui, sans-serif;
  --font-heading: "Sora", system-ui, sans-serif;
  --font-sans: var(--font-body);
  --font-serif: var(--font-heading);
}
```

If you want fully angular UI for a theme, set `--radius: 0` and optionally
override `rounded-full` utilities:

```css
:root[data-theme="my-theme"] .rounded-full {
  border-radius: 0 !important;
}
```

## Installation (CLI)

```bash
node infra/themes/install.js /path/to/theme.zip
node infra/themes/uninstall.js midnight-ocean
```

## Notes
- Themes are installed into `src/lib/themes/installed/<id>`.
- The installer updates `src/lib/themes/manifest.ts` to register new themes.
- Admin UI support (preview + activate) is handled in the Appearance section.
