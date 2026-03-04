#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PROJECT_ROOT = process.cwd();
const ADMIN_PAGES_ROOT = resolve(PROJECT_ROOT, 'src/pages/admin');
const ADMIN_ROOT_PAGE = resolve(PROJECT_ROOT, 'src/pages/admin.astro');
const NAV_ITEMS_PATH = resolve(PROJECT_ROOT, 'src/components/admin/nav-items.tsx');
const COMMENTS_PAGE_PATH = resolve(PROJECT_ROOT, 'src/pages/admin/comments.astro');

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function toProjectPath(absolutePath) {
  return absolutePath.replace(`${PROJECT_ROOT}/`, '');
}

function assertFileContains(filePath, pattern, errorMessage, issues) {
  const source = readFileSync(filePath, 'utf8');
  if (!pattern.test(source)) {
    issues.push(`${toProjectPath(filePath)}: ${errorMessage}`);
  }
  return source;
}

function routeFromPagePath(pagePath) {
  if (pagePath === ADMIN_ROOT_PAGE) return '/admin';

  const relative = toProjectPath(pagePath)
    .replace(/^src\/pages\//, '')
    .replace(/\.astro$/, '');
  return `/${relative}`;
}

function collectStaticAdminRoutes() {
  const pageFiles = [
    ADMIN_ROOT_PAGE,
    ...walk(ADMIN_PAGES_ROOT).filter((file) => file.endsWith('.astro'))
  ];

  return pageFiles
    .filter((file) => !file.includes('['))
    .map((file) => routeFromPagePath(file));
}

function parseNavRoutes() {
  const source = readFileSync(NAV_ITEMS_PATH, 'utf8');
  const routes = new Set();
  const routeRe = /href:\s*'([^']+)'/g;
  let match;
  while ((match = routeRe.exec(source)) !== null) {
    if (match[1].startsWith('/admin')) {
      routes.add(match[1]);
    }
  }
  return routes;
}

function main() {
  const issues = [];
  const adminPageFiles = [
    ADMIN_ROOT_PAGE,
    ...walk(ADMIN_PAGES_ROOT).filter((file) => file.endsWith('.astro'))
  ];

  for (const pageFile of adminPageFiles) {
    const source = readFileSync(pageFile, 'utf8');
    const isRedirectOnly = /Astro\.redirect\(\s*['"][^'"]+['"]\s*\)/.test(source);
    if (isRedirectOnly) continue;
    const hasClientHydration = /client:(load|idle|visible|media|only)\b/.test(source);

    if (!/import\s+AdminLayout\s+from\s+["']@\/layouts\/AdminLayout\.astro["'];?/.test(source)) {
      issues.push(`${toProjectPath(pageFile)}: missing AdminLayout import`);
    }
    if (!/<AdminLayout\b/.test(source)) {
      issues.push(`${toProjectPath(pageFile)}: missing <AdminLayout> wrapper`);
    }
    if (!/import\s+AdminPageHeader\s+from\s+["']@\/components\/admin\/AdminPageHeader\.astro["'];?/.test(source)) {
      issues.push(`${toProjectPath(pageFile)}: missing AdminPageHeader import`);
    }
    if (!/<AdminPageHeader\b/.test(source)) {
      issues.push(`${toProjectPath(pageFile)}: missing <AdminPageHeader> usage`);
    }
    if (hasClientHydration && !/<noscript>/.test(source)) {
      issues.push(`${toProjectPath(pageFile)}: missing <noscript> fallback for hydrated admin UI.`);
    }
  }

  const staticRoutes = new Set(collectStaticAdminRoutes());
  const navRoutes = parseNavRoutes();

  for (const navRoute of navRoutes) {
    if (!staticRoutes.has(navRoute)) {
      issues.push(`src/components/admin/nav-items.tsx: nav route "${navRoute}" has no matching static admin page.`);
    }
  }

  const commentsSource = readFileSync(COMMENTS_PAGE_PATH, 'utf8');
  if (!commentsSource.includes("Astro.redirect('/admin/features/comments')")) {
    issues.push('src/pages/admin/comments.astro: missing redirect to /admin/features/comments legacy route.');
  }

  if (issues.length > 0) {
    console.error('Admin consistency check failed.');
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log(`Admin consistency check passed for ${adminPageFiles.length} admin page(s).`);
}

main();
