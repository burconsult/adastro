import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const REQUIRED_THEME_TOKENS = [
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
  'border-strong',
  'input',
  'ring',
  'link',
  'link-hover',
  'inverse',
  'inverse-foreground',
  'surface-1',
  'surface-2',
  'surface-3',
  'surface-overlay',
  'media-overlay-start',
  'media-overlay-end',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
  'chart1',
  'chart2',
  'chart3',
  'chart4',
  'chart5',
  'radius-sm',
  'radius-md',
  'radius-lg',
  'radius-pill',
  'border-width-default',
  'border-width-focus',
  'elevation-sm',
  'elevation-md',
  'elevation-lg',
  'elevation-xl',
  'elevation-2xl',
  'font-body',
  'font-heading'
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

const stripQuotes = (value) => value.replace(/^['"]|['"]$/g, '');

const readJsonFile = (path) => JSON.parse(readFileSync(path, 'utf8'));

const validateRelativeAsset = (rootDir, relativePath, label) => {
  if (!relativePath || typeof relativePath !== 'string') return `${label}: missing path`;
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return `${label}: remote assets are not allowed`;
  }
  if (relativePath.startsWith('/')) {
    return `${label}: assets must be relative to the theme package`;
  }
  if (!existsSync(join(rootDir, relativePath))) {
    return `${label}: missing asset "${relativePath}"`;
  }
  return null;
};

export function validateThemeMetadata(meta, rootDir) {
  const errors = [];

  if (!meta || typeof meta !== 'object') {
    return ['theme.json must contain a valid object'];
  }

  const requiredStrings = ['id', 'label', 'description', 'version', 'author', 'entry', 'previewDescription'];
  for (const key of requiredStrings) {
    if (typeof meta[key] !== 'string' || meta[key].trim().length === 0) {
      errors.push(`theme.json: "${key}" must be a non-empty string`);
    }
  }

  if (!/^[a-z][a-z0-9-]*$/.test(meta.id || '')) {
    errors.push('theme.json: "id" must be lowercase kebab-case');
  }

  if (meta.fontImports !== undefined) {
    errors.push('theme.json: "fontImports" is no longer supported');
  }

  if (!meta.fonts || typeof meta.fonts !== 'object') {
    errors.push('theme.json: "fonts" must be an object with "body" and "heading"');
  } else {
    if (typeof meta.fonts.body !== 'string' || meta.fonts.body.trim().length === 0) {
      errors.push('theme.json: fonts.body must be a non-empty string');
    }
    if (typeof meta.fonts.heading !== 'string' || meta.fonts.heading.trim().length === 0) {
      errors.push('theme.json: fonts.heading must be a non-empty string');
    }
  }

  if (!Array.isArray(meta.previewFeatures) || meta.previewFeatures.length === 0) {
    errors.push('theme.json: "previewFeatures" must be a non-empty array of strings');
  } else if (meta.previewFeatures.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
    errors.push('theme.json: "previewFeatures" must only contain non-empty strings');
  }

  if (typeof meta.previewImage === 'string' && meta.previewImage.trim().length > 0) {
    const previewImageError = validateRelativeAsset(rootDir, meta.previewImage.trim(), 'theme.json previewImage');
    if (previewImageError) errors.push(previewImageError);
  }

  return errors;
}

const extractUrls = (css) => {
  const urls = [];
  const pattern = /url\(([^)]+)\)/g;
  for (const match of css.matchAll(pattern)) {
    const value = stripQuotes(match[1].trim());
    if (value.length > 0 && !value.startsWith('data:')) {
      urls.push(value);
    }
  }
  return urls;
};

const extractImports = (css) => {
  const imports = [];
  const pattern = /@import\s+(?:url\()?["']?([^"')\s;]+)["']?\)?/g;
  for (const match of css.matchAll(pattern)) {
    const value = stripQuotes(match[1].trim());
    if (value.length > 0) {
      imports.push(value);
    }
  }
  return imports;
};

const validateCssAssets = (css, rootDir) => {
  const errors = [];

  for (const importPath of extractImports(css)) {
    if (importPath.startsWith('http://') || importPath.startsWith('https://')) {
      errors.push(`theme.css: remote import "${importPath}" is not allowed`);
      continue;
    }
    if (importPath.startsWith('/')) {
      errors.push(`theme.css: import "${importPath}" must be relative to the theme package`);
      continue;
    }
    if (rootDir && importPath.startsWith('.')) {
      const normalizedImport = importPath.split('?')[0];
      if (!existsSync(join(rootDir, normalizedImport))) {
        errors.push(`theme.css: missing import "${importPath}"`);
      }
    }
  }

  for (const assetPath of extractUrls(css)) {
    if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
      errors.push(`theme.css: remote asset "${assetPath}" is not allowed`);
      continue;
    }
    if (assetPath.startsWith('/')) {
      errors.push(`theme.css: asset "${assetPath}" must be relative to the theme package`);
      continue;
    }
    if (rootDir && !existsSync(join(rootDir, assetPath))) {
      errors.push(`theme.css: missing asset "${assetPath}"`);
    }
  }
  return errors;
};

export function validateThemeCssSource(css, themeId, rootDir = null) {
  const errors = [];

  for (const block of BLOCK_PATTERNS(themeId)) {
    const match = css.match(block.pattern);
    if (!match) {
      errors.push(`${block.label}: missing selector block`);
      continue;
    }

    const blockBody = match[1];
    const missing = REQUIRED_THEME_TOKENS.filter((token) => !new RegExp(`--${token}\\s*:`).test(blockBody));
    if (missing.length > 0) {
      errors.push(`${block.label}: missing tokens -> ${missing.join(', ')}`);
    }
  }

  return errors.concat(validateCssAssets(css, rootDir));
}

export function validateThemePackage(rootDir) {
  const errors = [];
  const metaPath = join(rootDir, 'theme.json');
  const cssPath = join(rootDir, 'theme.css');

  if (!existsSync(metaPath)) {
    errors.push('Missing theme.json in theme package.');
    return { meta: null, errors };
  }

  const meta = readJsonFile(metaPath);
  errors.push(...validateThemeMetadata(meta, rootDir));

  if (!existsSync(cssPath)) {
    errors.push('Missing theme.css in theme package.');
    return { meta, errors };
  }

  const css = readFileSync(cssPath, 'utf8');
  errors.push(...validateThemeCssSource(css, meta?.id || '', rootDir));

  return { meta, errors };
}
