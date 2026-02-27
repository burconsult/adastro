#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MAP_PATH = 'docs/architecture/map.json';

const ARCHITECTURE_PATTERNS = [
  /^src\/middleware\.ts$/,
  /^src\/lib\/site-config\.ts$/,
  /^src\/lib\/routing\//,
  /^src\/lib\/setup\//,
  /^src\/lib\/settings\//,
  /^src\/lib\/features\//,
  /^src\/lib\/themes\//,
  /^src\/lib\/database\/repositories\//,
  /^src\/lib\/services\/settings-service\.ts$/,
  /^src\/pages\/api\/setup\//,
  /^src\/pages\/api\/features\//,
  /^src\/pages\/api\/admin\/features\//,
  /^infra\/supabase\/migrations\//
];

function run(command) {
  return execSync(command, { encoding: 'utf8' }).trim();
}

function getMergeBase(baseRef, headRef) {
  try {
    return run(`git merge-base ${baseRef} ${headRef}`);
  } catch {
    return '';
  }
}

function parseChangedFiles(base, head) {
  if (!base || !head) return [];
  const output = run(`git diff --name-only ${base}...${head}`);
  if (!output) return [];
  return output.split('\n').map((file) => file.trim()).filter(Boolean);
}

function getBaseAndHead() {
  const cliBase = process.argv[2];
  const cliHead = process.argv[3];
  if (cliBase && cliHead) {
    return { base: cliBase, head: cliHead };
  }

  const envHead = process.env.GITHUB_SHA || run('git rev-parse HEAD');
  const baseRefName = process.env.GITHUB_BASE_REF;
  if (baseRefName) {
    const baseRef = `origin/${baseRefName}`;
    const mergeBase = getMergeBase(baseRef, envHead);
    if (mergeBase) {
      return { base: mergeBase, head: envHead };
    }
  }

  const fallbackBase = run('git rev-parse HEAD~1');
  return { base: fallbackBase, head: envHead };
}

function validateMapJson() {
  const absolutePath = resolve(process.cwd(), MAP_PATH);
  const raw = readFileSync(absolutePath, 'utf8');
  const map = JSON.parse(raw);

  const requiredTopLevelKeys = ['project', 'version', 'surfaces', 'coreModules', 'features', 'tableOwnership', 'env', 'gates'];
  const missing = requiredTopLevelKeys.filter((key) => !(key in map));
  if (missing.length > 0) {
    throw new Error(`Missing required keys in ${MAP_PATH}: ${missing.join(', ')}`);
  }
}

function main() {
  const { base, head } = getBaseAndHead();
  const changedFiles = parseChangedFiles(base, head);

  if (changedFiles.length === 0) {
    console.log('No changed files detected. Architecture map check skipped.');
    return;
  }

  const architectureTouchedFiles = changedFiles.filter((file) =>
    ARCHITECTURE_PATTERNS.some((pattern) => pattern.test(file))
  );
  const mapTouched = changedFiles.includes(MAP_PATH);

  if (architectureTouchedFiles.length > 0 && !mapTouched) {
    console.error('Architecture map is likely stale.');
    console.error(`Changed architecture-sensitive files (${architectureTouchedFiles.length}):`);
    architectureTouchedFiles.forEach((file) => console.error(`- ${file}`));
    console.error(`\nExpected update: ${MAP_PATH}`);
    process.exit(1);
  }

  try {
    validateMapJson();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Invalid architecture map JSON: ${message}`);
    process.exit(1);
  }

  if (architectureTouchedFiles.length === 0 && mapTouched) {
    console.log('Architecture map changed without architecture-sensitive code changes.');
  } else {
    console.log('Architecture map check passed.');
  }
}

main();
