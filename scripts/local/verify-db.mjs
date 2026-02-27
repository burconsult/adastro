#!/usr/bin/env node

import { ensureDockerRunning, ensureSupabaseRunning, queryLocalPostgres } from './lib.mjs';

const expectSeed = process.argv.includes('--expect-seed');

const REQUIRED_CORE_TABLES = [
  'authors',
  'categories',
  'tags',
  'media_assets',
  'posts',
  'pages',
  'page_sections',
  'site_settings',
  'schema_migrations'
];

const FEATURE_TABLES = ['comments', 'newsletter_subscribers', 'newsletter_campaigns', 'newsletter_deliveries'];

function assertTablePresent(tableName) {
  const exists = queryLocalPostgres(`SELECT to_regclass('public.${tableName}') IS NOT NULL;`);
  if (exists !== 't') {
    throw new Error(`Required table \`${tableName}\` is missing.`);
  }
}

function assertTableAbsent(tableName) {
  const exists = queryLocalPostgres(`SELECT to_regclass('public.${tableName}') IS NOT NULL;`);
  if (exists !== 'f') {
    throw new Error(`Feature table \`${tableName}\` should not exist in core state.`);
  }
}

function assertSeedContent() {
  const expectedSlugs = ['home', 'blog', 'about', 'contact'];
  const slugRows = queryLocalPostgres(
    "SELECT slug FROM public.pages WHERE slug IN ('home','blog','about','contact') ORDER BY slug;"
  );

  const found = new Set(
    slugRows
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  );

  const missing = expectedSlugs.filter((slug) => !found.has(slug));
  if (missing.length > 0) {
    throw new Error(`Seed verification failed. Missing default pages: ${missing.join(', ')}`);
  }

  const publishedCount = Number(queryLocalPostgres("SELECT count(*) FROM public.posts WHERE status = 'published';"));
  if (!Number.isFinite(publishedCount) || publishedCount < 2) {
    throw new Error(`Seed verification failed. Expected at least 2 published posts, got ${publishedCount}.`);
  }
}

async function main() {
  ensureDockerRunning();
  ensureSupabaseRunning();

  for (const tableName of REQUIRED_CORE_TABLES) {
    assertTablePresent(tableName);
  }

  for (const tableName of FEATURE_TABLES) {
    assertTableAbsent(tableName);
  }

  if (expectSeed) {
    assertSeedContent();
  }

  console.log(`✅ Local database verification passed${expectSeed ? ' (core + seed)' : ' (core)'}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
