#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, readdirSync, copyFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');
loadEnv({ path: join(projectRoot, '.env') });

const FEATURE_ROOT = join(projectRoot, 'src/lib/features');
const MANIFEST_PATH = join(FEATURE_ROOT, 'manifest.ts');
const SERVER_MANIFEST_PATH = join(FEATURE_ROOT, 'server-manifest.ts');
const IMPORT_MARKER = '// @feature-installer-imports';
const LIST_MARKER = '// @feature-installer-list';
const SERVER_IMPORT_MARKER = '// @feature-server-installer-imports';
const SERVER_LIST_MARKER = '// @feature-server-installer-list';

const usage = () => {
  console.log('Usage: node infra/features/install.js <path-to-zip-or-folder>');
  console.log('       node infra/features/install.js --id <feature-id> <path-to-zip-or-folder>');
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

const readFeatureMeta = (rootDir) => {
  const metaPath = join(rootDir, 'feature.json');
  if (!existsSync(metaPath)) {
    throw new Error('Missing feature.json in feature package.');
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
  return `FEATURE_${base || 'MODULE'}_MODULE`;
};

const toServerIdentifier = (value) => {
  const base = value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
  return `FEATURE_${base || 'MODULE'}_SERVER_MODULE`;
};

const updateManifestFile = ({
  manifestPath,
  importMarker,
  listMarker,
  importLine,
  listLine,
  duplicateMessage
}) => {
  if (!existsSync(manifestPath)) {
    throw new Error(`Manifest not found at ${manifestPath}`);
  }

  let content = readFileSync(manifestPath, 'utf-8');
  if (!content.includes(importMarker) || !content.includes(listMarker)) {
    throw new Error('Manifest markers not found. Ensure the manifest has installer markers.');
  }

  if (content.includes(importLine)) {
    throw new Error(duplicateMessage);
  }

  content = content.replace(importMarker, `${importLine}\n${importMarker}`);
  content = content.replace(listMarker, `${listLine}\n  ${listMarker}`);

  writeFileSync(manifestPath, content, 'utf-8');
};

const updateManifest = (featureId, entryImportPath) => {
  const importName = toIdentifier(featureId);
  const importLine = `import { FEATURE_MODULE as ${importName} } from './${featureId}/${entryImportPath}.js';`;
  const listLine = `  ${importName},`;

  updateManifestFile({
    manifestPath: MANIFEST_PATH,
    importMarker: IMPORT_MARKER,
    listMarker: LIST_MARKER,
    importLine,
    listLine,
    duplicateMessage: `Feature "${featureId}" already registered in manifest.`
  });
};

const updateServerManifest = (featureId, serverEntryImportPath) => {
  const importName = toServerIdentifier(featureId);
  const importLine = `import { FEATURE_SERVER_MODULE as ${importName} } from './${featureId}/${serverEntryImportPath}.js';`;
  const listLine = `  ${importName},`;

  updateManifestFile({
    manifestPath: SERVER_MANIFEST_PATH,
    importMarker: SERVER_IMPORT_MARKER,
    listMarker: SERVER_LIST_MARKER,
    importLine,
    listLine,
    duplicateMessage: `Feature "${featureId}" already registered in server manifest.`
  });
};

const loadSupabaseAdmin = () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required to run feature migrations.');
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

const applyMigrations = async (packageRoot, meta) => {
  const migrationsDir = meta.migrationsDir || 'migrations';
  const migrationsRoot = join(packageRoot, migrationsDir);
  if (!existsSync(migrationsRoot)) {
    return;
  }

  const files = readdirSync(migrationsRoot)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    return;
  }

  const supabaseAdmin = loadSupabaseAdmin();
  for (const file of files) {
    const sql = readFileSync(join(migrationsRoot, file), 'utf-8');
    const { error } = await supabaseAdmin.rpc('exec_sql', { sql });
    if (error) {
      throw new Error(`Failed to run migration ${file}: ${error.message}`);
    }
  }
};

const getRootFromZip = (zipPath) => {
  const tempRoot = mkdtempSync(join(projectRoot, 'infra/features/.tmp-'));
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
    const meta = readFeatureMeta(packageRoot);
    const featureId = (idOverride || meta.id || '').trim();
    if (!featureId) {
      throw new Error('feature.json must include an "id".');
    }
    if (!/^[a-z][a-z0-9-]*$/.test(featureId)) {
      throw new Error('Feature id must be lowercase and kebab-cased (ex: "newsletter").');
    }

    const entry = (meta.entry || 'index.ts').trim();
    const entryPath = join(packageRoot, entry);
    if (!existsSync(entryPath)) {
      throw new Error(`Entry file not found: ${entry}`);
    }
    const serverEntry = (meta.serverEntry || 'server.ts').trim();
    const serverEntryPath = join(packageRoot, serverEntry);
    if (!existsSync(serverEntryPath)) {
      throw new Error(`Server entry file not found: ${serverEntry}. Expected to export FEATURE_SERVER_MODULE.`);
    }

    const installDir = join(FEATURE_ROOT, featureId);
    if (existsSync(installDir)) {
      throw new Error(`Feature "${featureId}" is already installed.`);
    }

    ensureDir(FEATURE_ROOT);
    copyDir(packageRoot, installDir);

    await applyMigrations(packageRoot, meta);
    const entryImport = normalizeEntryImport(entry);
    const serverEntryImport = normalizeEntryImport(serverEntry);
    updateManifest(featureId, entryImport);
    updateServerManifest(featureId, serverEntryImport);

    console.log(`✅ Installed feature "${featureId}"`);
    console.log(`📍 Client manifest updated: ${MANIFEST_PATH}`);
    console.log(`📍 Server manifest updated: ${SERVER_MANIFEST_PATH}`);
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
