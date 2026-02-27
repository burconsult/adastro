#!/usr/bin/env node
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');

const THEME_ROOT = join(projectRoot, 'src/lib/themes');
const INSTALLED_ROOT = join(THEME_ROOT, 'installed');
const MANIFEST_PATH = join(THEME_ROOT, 'manifest.ts');

const usage = () => {
  console.log('Usage: node infra/themes/uninstall.js <theme-id>');
};

const toIdentifier = (value) => {
  const base = value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
  return `THEME_${base || 'MODULE'}_MODULE`;
};

const removeManifestEntries = (themeId) => {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`Manifest not found at ${MANIFEST_PATH}`);
  }

  const importName = toIdentifier(themeId);
  const importFragment = `./installed/${themeId}/`;
  const listLine = `  ${importName},`;

  const lines = readFileSync(MANIFEST_PATH, 'utf-8').split('\n');
  const nextLines = lines.filter((line) => {
    const trimmed = line.trim();
    if (trimmed === listLine.trim()) return false;
    if (line.includes(importFragment) && line.includes(importName)) return false;
    return true;
  });

  writeFileSync(MANIFEST_PATH, nextLines.join('\n'), 'utf-8');
};

const main = () => {
  const themeId = process.argv[2];
  if (!themeId) {
    usage();
    process.exit(1);
  }

  const installDir = join(INSTALLED_ROOT, themeId);
  if (!existsSync(installDir)) {
    console.error(`❌ Theme "${themeId}" is not installed in ${basename(INSTALLED_ROOT)}.`);
    process.exit(1);
  }

  try {
    removeManifestEntries(themeId);
    rmSync(installDir, { recursive: true, force: true });
    console.log(`✅ Uninstalled theme "${themeId}"`);
    console.log(`📍 Manifest updated: ${MANIFEST_PATH}`);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exitCode = 1;
  }
};

main();
