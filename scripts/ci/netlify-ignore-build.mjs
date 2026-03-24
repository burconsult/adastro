import { execFileSync } from 'node:child_process';

const IGNORE_ONLY_PATTERNS = [
  /^\.github\//,
  /^\.kiro\//,
  /^\.vscode\//,
  /^docs\//,
  /^external_docs\//,
  /^release\//,
  /^tests\//,
  /^scripts\/local\//,
  /^scripts\/ci\/check-[^/]+\.mjs$/,
  /^scripts\/ci\/smoke-hosted\.mjs$/,
  /^\.DS_Store$/,
  /^CHANGELOG\.md$/,
  /^CONTRIBUTING\.md$/,
  /^INSTALLATION\.md$/,
  /^LICENSE$/,
  /^README\.md$/,
  /^SECURITY\.md$/
];

const baseRef = process.env.CACHED_COMMIT_REF;
const headRef = process.env.COMMIT_REF;

if (!baseRef || !headRef) {
  process.exit(1);
}

const changedFiles = execFileSync('git', ['diff', '--name-only', baseRef, headRef, '--'], {
  encoding: 'utf8'
})
  .split('\n')
  .map((file) => file.trim())
  .filter(Boolean);

if (changedFiles.length === 0) {
  console.log('No file changes detected, skipping Netlify build.');
  process.exit(0);
}

const requiresBuild = changedFiles.some((file) => (
  !IGNORE_ONLY_PATTERNS.some((pattern) => pattern.test(file))
));

if (requiresBuild) {
  console.log('App-affecting changes detected, continuing Netlify build.');
  process.exit(1);
}

console.log('Only docs/tests/local-tooling changes detected, skipping Netlify build.');
process.exit(0);
