#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const THEME_ROOT = resolve(process.cwd(), 'src/lib/themes/installed');
const REQUIRED_TOKENS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'success',
  'success-foreground',
  'warning',
  'warning-foreground',
  'info',
  'info-foreground',
  'border',
  'input',
  'ring',
  'radius',
  'surface-border-width',
  'elevation-sm',
  'elevation-md',
  'elevation-lg',
  'elevation-xl',
  'elevation-2xl',
  'font-body',
  'font-heading',
  'font-sans',
  'font-serif'
];

const BLOCK_PATTERNS = (themeId) => [
  {
    label: `:root[data-theme="${themeId}"]`,
    pattern: new RegExp(`:root\\[data-theme="${themeId}"\\]\\s*\\{([\\s\\S]*?)\\}`)
  },
  {
    label: `.dark[data-theme="${themeId}"]`,
    pattern: new RegExp(`\\.dark\\[data-theme="${themeId}"\\]\\s*\\{([\\s\\S]*?)\\}`)
  }
];

function readThemeDirs() {
  return readdirSync(THEME_ROOT).filter((entry) => {
    const absolute = join(THEME_ROOT, entry);
    return statSync(absolute).isDirectory();
  });
}

function missingTokens(blockBody) {
  return REQUIRED_TOKENS.filter((token) => !new RegExp(`--${token}\\s*:`).test(blockBody));
}

function validateTheme(themeId) {
  const cssPath = join(THEME_ROOT, themeId, 'theme.css');
  const css = readFileSync(cssPath, 'utf8');
  const errors = [];

  for (const block of BLOCK_PATTERNS(themeId)) {
    const match = css.match(block.pattern);
    if (!match) {
      errors.push(`${block.label}: missing selector block`);
      continue;
    }

    const blockBody = match[1];
    const missing = missingTokens(blockBody);
    if (missing.length > 0) {
      errors.push(`${block.label}: missing tokens -> ${missing.join(', ')}`);
    }
  }

  return errors;
}

function main() {
  const themes = readThemeDirs();
  const failures = [];

  for (const themeId of themes) {
    const errors = validateTheme(themeId);
    if (errors.length > 0) {
      failures.push({ themeId, errors });
    }
  }

  if (failures.length > 0) {
    console.error('Theme token check failed.');
    for (const failure of failures) {
      console.error(`- ${failure.themeId}`);
      for (const error of failure.errors) {
        console.error(`  - ${error}`);
      }
    }
    process.exit(1);
  }

  console.log(`Theme token check passed for ${themes.length} installed theme(s).`);
}

main();
