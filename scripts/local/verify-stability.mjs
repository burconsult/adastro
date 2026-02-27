#!/usr/bin/env node

import { runCommand } from './lib.mjs';

const quickRunsArg = process.argv.find((arg) => arg.startsWith('--quick-runs='));
const quickRuns = Number.parseInt(quickRunsArg?.split('=')[1] ?? '2', 10);
const runFull = process.argv.includes('--full');

if (!Number.isFinite(quickRuns) || quickRuns < 1 || quickRuns > 10) {
  console.error('Invalid --quick-runs value. Use a number between 1 and 10.');
  process.exit(1);
}

for (let index = 1; index <= quickRuns; index += 1) {
  console.log(`\n[stability] quick run ${index}/${quickRuns}`);
  runCommand('node', ['scripts/local/verify-local.mjs', 'quick']);
}

if (runFull) {
  console.log('\n[stability] full run 1/1');
  runCommand('node', ['scripts/local/verify-local.mjs', 'full']);
}

console.log(`\n✅ Stability verification passed (quick x${quickRuns}${runFull ? ' + full x1' : ''}).`);
