#!/usr/bin/env node
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');

const FEATURE_ROOT = join(projectRoot, 'src/lib/features');
const LEGACY_INSTALLED_ROOT = join(FEATURE_ROOT, 'installed');
const MANIFEST_PATH = join(FEATURE_ROOT, 'manifest.ts');
const SERVER_MANIFEST_PATH = join(FEATURE_ROOT, 'server-manifest.ts');

const usage = () => {
  console.log('Usage: node infra/features/uninstall.js <feature-id> [--remove-files]');
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toIdentifier = (value) => {
  const base = value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
  return `FEATURE_${base || 'MODULE'}_MODULE`;
};

const toBundledIdentifier = (value) => {
  const base = value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
  return `${base || 'FEATURE'}_FEATURE_MODULE`;
};

const toServerIdentifier = (value) => {
  const base = value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
  return `FEATURE_${base || 'MODULE'}_SERVER_MODULE`;
};

const toBundledServerIdentifier = (value) => {
  const base = value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
  return `${base || 'FEATURE'}_FEATURE_SERVER_MODULE`;
};

const parseImportLine = (line) => {
  const importMatch = line.match(/^import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]([^'"]+)['"];?\s*$/);
  if (!importMatch) return null;
  const importClause = importMatch[1].trim();
  const importPath = importMatch[2].trim();
  const aliasMatch = importClause.match(/\bas\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*$/);
  const alias = aliasMatch ? aliasMatch[1] : importClause.split(',')[0]?.trim();
  if (!alias) return null;
  return { alias, importPath };
};

const removeManifestEntries = (manifestPath, featureId, aliases) => {
  if (!existsSync(manifestPath)) {
    throw new Error(`Manifest not found at ${manifestPath}`);
  }

  const importPathPattern = new RegExp(`^\\.\\/(?:installed\\/)?${escapeRegExp(featureId)}\\/`);
  const aliasesToRemove = new Set(aliases);
  const listLinePatterns = [];
  let removed = false;

  const lines = readFileSync(manifestPath, 'utf-8').split('\n');
  const withoutFeatureImports = lines.filter((line) => {
    const parsedImport = parseImportLine(line);
    if (!parsedImport) return true;
    if (!importPathPattern.test(parsedImport.importPath)) return true;
    aliasesToRemove.add(parsedImport.alias);
    removed = true;
    return false;
  });

  aliasesToRemove.forEach((alias) => {
    listLinePatterns.push(new RegExp(`^\\s*${escapeRegExp(alias)}\\s*,\\s*$`));
  });

  const nextLines = withoutFeatureImports.filter((line) => {
    for (const pattern of listLinePatterns) {
      if (pattern.test(line)) {
        removed = true;
        return false;
      }
    }
    return true;
  });

  writeFileSync(manifestPath, nextLines.join('\n'), 'utf-8');
  return removed;
};

const main = () => {
  const featureId = process.argv[2];
  const removeFiles = process.argv.includes('--remove-files');
  if (!featureId) {
    usage();
    process.exit(1);
  }

  const featureDir = join(FEATURE_ROOT, featureId);
  const legacyInstallDir = join(LEGACY_INSTALLED_ROOT, featureId);
  const removedTargets = [];

  try {
    const manifestChanged = removeManifestEntries(MANIFEST_PATH, featureId, [
      toIdentifier(featureId),
      toBundledIdentifier(featureId)
    ]);
    const serverManifestChanged = removeManifestEntries(SERVER_MANIFEST_PATH, featureId, [
      toServerIdentifier(featureId),
      toBundledServerIdentifier(featureId)
    ]);

    if (removeFiles && existsSync(featureDir)) {
      rmSync(featureDir, { recursive: true, force: true });
      removedTargets.push(featureId);
    }
    if (existsSync(legacyInstallDir)) {
      rmSync(legacyInstallDir, { recursive: true, force: true });
      removedTargets.push(`installed/${featureId}`);
    }

    if (!manifestChanged && !serverManifestChanged && removedTargets.length === 0) {
      throw new Error(`Feature "${featureId}" was not found in manifest or install directories.`);
    }

    console.log(`✅ Uninstalled feature "${featureId}"`);
    if (removedTargets.length > 0) {
      console.log(`🗑️ Removed: ${removedTargets.join(', ')}`);
    }
    console.log(`📍 Client manifest updated: ${MANIFEST_PATH}`);
    console.log(`📍 Server manifest updated: ${SERVER_MANIFEST_PATH}`);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exitCode = 1;
  }
};

main();
