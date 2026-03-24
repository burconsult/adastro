#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { validateThemeCssSource, validateThemePackage } from '../../infra/themes/theme-contract.mjs';

const PROJECT_ROOT = process.cwd();
const THEME_ROOT = resolve(PROJECT_ROOT, 'src/lib/themes/installed');
const GLOBAL_CSS_PATH = resolve(PROJECT_ROOT, 'src/styles/global.css');
const REQUIRED_BUTTON_VARIANTS = ['btn-primary', 'btn-secondary', 'btn-outline', 'btn-ghost', 'btn-destructive', 'btn-sm'];
const COLOR_ESCAPE_PATTERNS = [
  /\b(?:bg|text|border|from|via|to)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)-[^\s"'`}]+/g,
  /#[0-9a-fA-F]{3,8}\b/g,
  /\b(?:bg|text|border)-(?:white|black)(?:\/[0-9.]+)?\b/g
];
const COLOR_SCAN_TARGETS = [
  resolve(PROJECT_ROOT, 'src/components/AdminMobileNav.tsx'),
  resolve(PROJECT_ROOT, 'src/components/AdminSidebar.tsx'),
  resolve(PROJECT_ROOT, 'src/components/BlogPostCard.astro'),
  resolve(PROJECT_ROOT, 'src/layouts/AdminLayout.astro'),
  resolve(PROJECT_ROOT, 'src/lib/components/ThemeManager.tsx'),
  resolve(PROJECT_ROOT, 'src/lib/components/admin/ListingPrimitives.tsx'),
  resolve(PROJECT_ROOT, 'src/lib/components/ui'),
];
const COLOR_SCAN_EXCLUDES = [
  join('__tests__')
];

function readThemeDirs() {
  return readdirSync(THEME_ROOT).filter((entry) => {
    const absolute = join(THEME_ROOT, entry);
    return statSync(absolute).isDirectory();
  });
}

function validateCoreTheme() {
  const css = readFileSync(GLOBAL_CSS_PATH, 'utf8');
  return validateThemeCssSource(css, 'adastro');
}

function validateSharedButtonVariants() {
  const css = readFileSync(GLOBAL_CSS_PATH, 'utf8');
  return REQUIRED_BUTTON_VARIANTS
    .filter((variant) => !css.includes(`.${variant}`))
    .map((variant) => `global.css: missing shared button variant ".${variant}"`);
}

function shouldSkipColorScan(path) {
  return COLOR_SCAN_EXCLUDES.some((fragment) => path.includes(fragment));
}

function collectFiles(targetPath) {
  if (!existsSync(targetPath) || shouldSkipColorScan(targetPath)) return [];

  const stats = statSync(targetPath);
  if (stats.isFile()) {
    return /\.(astro|ts|tsx|css)$/.test(targetPath) ? [targetPath] : [];
  }

  const files = [];
  for (const entry of readdirSync(targetPath, { withFileTypes: true })) {
    const absolute = join(targetPath, entry.name);
    if (shouldSkipColorScan(absolute)) continue;
    if (entry.isDirectory()) {
      files.push(...collectFiles(absolute));
    } else if (entry.isFile() && /\.(astro|ts|tsx|css)$/.test(entry.name)) {
      files.push(absolute);
    }
  }
  return files;
}

function validateColorEscapes() {
  const errors = [];

  for (const targetPath of COLOR_SCAN_TARGETS) {
    for (const filePath of collectFiles(targetPath)) {
      const source = readFileSync(filePath, 'utf8');
      const findings = COLOR_ESCAPE_PATTERNS
        .flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[0]))
        .filter(Boolean);

      if (findings.length > 0) {
        errors.push(`${filePath.replace(`${PROJECT_ROOT}/`, '')}: hardcoded color escape(s) -> ${[...new Set(findings)].join(', ')}`);
      }
    }
  }

  return errors;
}

function main() {
  const failures = [];
  const themes = readThemeDirs();

  const coreErrors = validateCoreTheme();
  if (coreErrors.length > 0) {
    failures.push({ themeId: 'adastro', errors: coreErrors });
  }

  for (const themeId of themes) {
    const themeRoot = join(THEME_ROOT, themeId);
    const { errors } = validateThemePackage(themeRoot);
    if (errors.length > 0) {
      failures.push({ themeId, errors });
    }
  }

  const variantErrors = validateSharedButtonVariants();
  if (variantErrors.length > 0) {
    failures.push({ themeId: 'shared-styles', errors: variantErrors });
  }

  const colorEscapeErrors = validateColorEscapes();
  if (colorEscapeErrors.length > 0) {
    failures.push({ themeId: 'theme-aware-ui', errors: colorEscapeErrors });
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

  console.log(`Theme token check passed for ${themes.length + 1} theme contract(s).`);
}

main();
