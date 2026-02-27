#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, readdirSync, copyFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');

const THEME_ROOT = join(projectRoot, 'src/lib/themes');
const INSTALLED_ROOT = join(THEME_ROOT, 'installed');
const MANIFEST_PATH = join(THEME_ROOT, 'manifest.ts');
const IMPORT_MARKER = '// @theme-installer-imports';
const LIST_MARKER = '// @theme-installer-list';

const usage = () => {
  console.log('Usage: node infra/themes/install.js <path-to-zip-or-folder>');
  console.log('       node infra/themes/install.js --id <theme-id> <path-to-zip-or-folder>');
};

const ensureDir = (path) => {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
};

const copyDir = (source, destination) => {
  ensureDir(destination);
  const entries = readdirSync(source, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(source, entry.name);
    const destPath = join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      copyFileSync(srcPath, destPath);
    }
  }
};

const readThemeMeta = (rootDir) => {
  const metaPath = join(rootDir, 'theme.json');
  if (!existsSync(metaPath)) {
    throw new Error('Missing theme.json in theme package.');
  }
  const raw = readFileSync(metaPath, 'utf-8');
  return JSON.parse(raw);
};

const normalizeEntryImport = (entry) => {
  const normalized = entry.replace(/\\/g, '/');
  const withoutExt = normalized.replace(/\.(ts|tsx|js|jsx)$/i, '');
  return withoutExt;
};

const toIdentifier = (value) => {
  const base = value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
  return `THEME_${base || 'MODULE'}_MODULE`;
};

const updateManifest = (themeId, entryImportPath) => {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`Manifest not found at ${MANIFEST_PATH}`);
  }

  const importName = toIdentifier(themeId);
  const importLine = `import { THEME_MODULE as ${importName} } from './installed/${themeId}/${entryImportPath}.js';`;
  const listLine = `  ${importName},`;

  let content = readFileSync(MANIFEST_PATH, 'utf-8');
  if (!content.includes(IMPORT_MARKER) || !content.includes(LIST_MARKER)) {
    throw new Error('Manifest markers not found. Ensure the manifest has installer markers.');
  }

  if (content.includes(importLine)) {
    throw new Error(`Theme "${themeId}" already registered in manifest.`);
  }

  content = content.replace(IMPORT_MARKER, `${importLine}\n${IMPORT_MARKER}`);
  content = content.replace(LIST_MARKER, `${listLine}\n  ${LIST_MARKER}`);

  writeFileSync(MANIFEST_PATH, content, 'utf-8');
};

const getRootFromZip = (zipPath) => {
  const tempRoot = mkdtempSync(join(projectRoot, 'infra/themes/.tmp-'));
  try {
    execFileSync('unzip', ['-q', zipPath, '-d', tempRoot], { stdio: 'ignore' });
  } catch (error) {
    rmSync(tempRoot, { recursive: true, force: true });
    throw new Error('Failed to unzip archive. Ensure "unzip" is available.');
  }

  const entries = readdirSync(tempRoot, { withFileTypes: true });
  if (entries.length === 1 && entries[0].isDirectory()) {
    return { root: join(tempRoot, entries[0].name), tempRoot };
  }

  return { root: tempRoot, tempRoot };
};

const parseArgs = (args) => {
  let source;
  let id;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--id') {
      id = args[i + 1];
      i += 1;
    } else if (!source) {
      source = arg;
    }
  }
  return { source, id };
};

const main = async () => {
  const { source, id: idOverride } = parseArgs(process.argv.slice(2));
  if (!source) {
    usage();
    process.exit(1);
  }

  const sourcePath = resolve(process.cwd(), source);
  if (!existsSync(sourcePath)) {
    console.error(`❌ Source not found: ${sourcePath}`);
    process.exit(1);
  }

  let packageRoot = sourcePath;
  let tempRoot = null;
  const isZip = extname(sourcePath).toLowerCase() === '.zip';

  if (isZip) {
    const result = getRootFromZip(sourcePath);
    packageRoot = result.root;
    tempRoot = result.tempRoot;
  } else if (!statSync(sourcePath).isDirectory()) {
    console.error('❌ Source must be a directory or a .zip archive.');
    process.exit(1);
  }

  try {
    const meta = readThemeMeta(packageRoot);
    const themeId = (idOverride || meta.id || '').trim();
    if (!themeId) {
      throw new Error('theme.json must include an "id".');
    }
    if (!/^[a-z][a-z0-9-]*$/.test(themeId)) {
      throw new Error('Theme id must be lowercase and kebab-cased (ex: "midnight-ocean").');
    }

    const entry = (meta.entry || 'index.ts').trim();
    const entryPath = join(packageRoot, entry);
    if (!existsSync(entryPath)) {
      throw new Error(`Entry file not found: ${entry}`);
    }

    const installDir = join(INSTALLED_ROOT, themeId);
    if (existsSync(installDir)) {
      throw new Error(`Theme "${themeId}" is already installed.`);
    }

    ensureDir(INSTALLED_ROOT);
    copyDir(packageRoot, installDir);

    const entryImport = normalizeEntryImport(entry);
    updateManifest(themeId, entryImport);

    console.log(`✅ Installed theme "${themeId}"`);
    console.log(`📍 Manifest updated: ${MANIFEST_PATH}`);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (tempRoot) {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
};

await main();
