# Theme Packages

Theme packages are installable bundles that add new `data-theme` palettes without
changing the core codebase. A theme package ships its own CSS variables and
metadata so it can be activated from the admin dashboard.

Theme packages must not rely on remote font or stylesheet URLs. If a theme
needs custom typography, use local font assets or local build-managed imports.

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
  "previewDescription": "Cool ocean surfaces with bright action contrast.",
  "previewFeatures": ["Blue action palette", "Quiet surfaces", "Readable admin chrome"],
  "version": "1.0.0",
  "author": "Burconsult",
  "entry": "index.ts",
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
  previewDescription: 'Cool ocean surfaces with bright action contrast.',
  previewFeatures: ['Blue action palette', 'Quiet surfaces', 'Readable admin chrome'],
  version: '1.0.0',
  author: 'Burconsult',
  fonts: {
    body: '"Outfit", system-ui, sans-serif',
    heading: '"Sora", system-ui, sans-serif'
  },
  source: 'installed'
};
```

## theme.css (required)

Theme CSS defines variables for both light and dark mode using the
`data-theme` attribute. Variables should follow the core token names.
Beyond colors and fonts, themes also control geometry, borders, semantic
surfaces, sidebar chrome, and elevation.

```css
:root[data-theme="midnight-ocean"] {
  --background: 222 28% 12%;
  --foreground: 210 40% 98%;
  --card: 222 28% 14%;
  --card-foreground: 210 40% 98%;
  --popover: 222 28% 14%;
  --popover-foreground: 210 40% 98%;
  --primary: 196 74% 50%;
  --primary-foreground: 210 30% 10%;
  --accent: 186 52% 22%;
  --accent-foreground: 180 40% 96%;
  --secondary: 220 18% 18%;
  --secondary-foreground: 210 40% 96%;
  --muted: 220 18% 18%;
  --muted-foreground: 214 18% 70%;
  --destructive: 0 70% 48%;
  --destructive-foreground: 210 40% 98%;
  --success: 154 63% 40%;
  --success-foreground: 210 40% 98%;
  --warning: 38 95% 56%;
  --warning-foreground: 32 94% 10%;
  --info: 196 74% 50%;
  --info-foreground: 210 40% 98%;
  --border: 220 18% 22%;
  --border-strong: 220 16% 32%;
  --input: 220 18% 22%;
  --ring: 196 74% 50%;
  --link: 196 74% 50%;
  --link-hover: 186 66% 58%;
  --inverse: 210 40% 98%;
  --inverse-foreground: 220 30% 10%;
  --surface-1: 222 28% 14%;
  --surface-2: 220 18% 18%;
  --surface-3: 220 18% 22%;
  --surface-overlay: 220 30% 8%;
  --media-overlay-start: 220 30% 8%;
  --media-overlay-end: 196 74% 50%;
  --sidebar: 220 20% 12%;
  --sidebar-foreground: 210 40% 98%;
  --sidebar-primary: 196 74% 50%;
  --sidebar-primary-foreground: 220 30% 10%;
  --sidebar-accent: 186 52% 22%;
  --sidebar-accent-foreground: 210 40% 98%;
  --sidebar-border: 220 18% 22%;
  --sidebar-ring: 196 74% 50%;
  --chart1: 196 74% 50%;
  --chart2: 154 63% 40%;
  --chart3: 38 95% 56%;
  --chart4: 221 83% 53%;
  --chart5: 0 70% 48%;
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-pill: 999px;
  --border-width-default: 1px;
  --border-width-focus: 3px;
  --elevation-sm: 0 1px 2px hsl(var(--foreground) / 0.08);
  --elevation-md: 0 6px 14px hsl(var(--foreground) / 0.1);
  --elevation-lg: 0 12px 24px hsl(var(--foreground) / 0.12);
  --elevation-xl: 0 18px 34px hsl(var(--foreground) / 0.14);
  --elevation-2xl: 0 26px 46px hsl(var(--foreground) / 0.18);
  --font-body: "Outfit", system-ui, sans-serif;
  --font-heading: "Sora", system-ui, sans-serif;
}

.dark[data-theme="midnight-ocean"] {
  --background: 220 30% 6%;
  --foreground: 210 40% 98%;
  --card: 220 24% 10%;
  --card-foreground: 210 40% 98%;
  --popover: 220 24% 10%;
  --popover-foreground: 210 40% 98%;
  --primary: 196 74% 56%;
  --primary-foreground: 210 30% 10%;
  --accent: 186 42% 18%;
  --accent-foreground: 180 40% 96%;
  --secondary: 220 18% 16%;
  --secondary-foreground: 210 40% 96%;
  --muted: 220 18% 16%;
  --muted-foreground: 214 18% 72%;
  --destructive: 0 70% 58%;
  --destructive-foreground: 210 40% 98%;
  --success: 154 63% 46%;
  --success-foreground: 210 40% 98%;
  --warning: 38 95% 56%;
  --warning-foreground: 32 94% 10%;
  --info: 196 74% 56%;
  --info-foreground: 210 40% 98%;
  --border: 220 18% 16%;
  --border-strong: 214 18% 68%;
  --input: 220 18% 16%;
  --ring: 196 74% 56%;
  --link: 196 74% 56%;
  --link-hover: 186 66% 64%;
  --inverse: 210 40% 98%;
  --inverse-foreground: 220 30% 10%;
  --surface-1: 220 24% 10%;
  --surface-2: 220 18% 14%;
  --surface-3: 220 18% 16%;
  --surface-overlay: 220 30% 4%;
  --media-overlay-start: 220 30% 4%;
  --media-overlay-end: 196 74% 56%;
  --sidebar: 220 24% 8%;
  --sidebar-foreground: 210 40% 98%;
  --sidebar-primary: 196 74% 56%;
  --sidebar-primary-foreground: 220 30% 10%;
  --sidebar-accent: 186 42% 18%;
  --sidebar-accent-foreground: 210 40% 98%;
  --sidebar-border: 220 18% 16%;
  --sidebar-ring: 196 74% 56%;
  --chart1: 196 74% 56%;
  --chart2: 154 63% 46%;
  --chart3: 38 95% 56%;
  --chart4: 221 83% 60%;
  --chart5: 0 70% 58%;
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-pill: 999px;
  --border-width-default: 1px;
  --border-width-focus: 3px;
  --elevation-sm: 0 1px 2px hsl(var(--foreground) / 0.12);
  --elevation-md: 0 8px 16px hsl(var(--background) / 0.5);
  --elevation-lg: 0 14px 28px hsl(var(--background) / 0.55);
  --elevation-xl: 0 20px 36px hsl(var(--background) / 0.58);
  --elevation-2xl: 0 28px 48px hsl(var(--background) / 0.6);
  --font-body: "Outfit", system-ui, sans-serif;
  --font-heading: "Sora", system-ui, sans-serif;
}
```

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
