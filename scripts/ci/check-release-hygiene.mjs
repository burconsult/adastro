#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DOC_PATHS = [
  'README.md',
  'INSTALLATION.md',
  'docs/architecture/README.md',
  'docs/architecture/system-map.md',
  'docs/engineering/local-testing.md',
  'docs/release-gates.md',
  'docs/release-execution-board.md',
  'docs/performance-release-checklist.md',
  'docs/release-smoke-test.md',
  'docs/feature-development.md'
];

const BANNED_PATTERNS = [
  {
    pattern: /\bSUPABASE_ANON_KEY\b/g,
    message: 'legacy key name SUPABASE_ANON_KEY'
  },
  {
    pattern: /\bSUPABASE_SERVICE_ROLE_KEY\b/g,
    message: 'legacy key name SUPABASE_SERVICE_ROLE_KEY'
  },
  {
    pattern: /\bPUBLIC_SITE_URL\b/g,
    message: 'deprecated PUBLIC_SITE_URL variable'
  },
  {
    pattern: /\/Users\/[^/\n]+\/Developer\/astroblog\//g,
    message: 'machine-specific absolute workspace path'
  },
  {
    pattern: /\bAstroblog\b/g,
    message: 'old project branding "Astroblog"'
  }
];

function countMatches(source, pattern) {
  const matches = source.match(pattern);
  return matches ? matches.length : 0;
}

function main() {
  const issues = [];

  for (const relativePath of DOC_PATHS) {
    const absolutePath = resolve(process.cwd(), relativePath);
    const source = readFileSync(absolutePath, 'utf8');

    for (const banned of BANNED_PATTERNS) {
      const count = countMatches(source, banned.pattern);
      if (count > 0) {
        issues.push(`${relativePath}: found ${count} occurrence(s) of ${banned.message}`);
      }
    }
  }

  if (issues.length > 0) {
    console.error('Release hygiene check failed.');
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log(`Release hygiene check passed for ${DOC_PATHS.length} documentation file(s).`);
}

main();
