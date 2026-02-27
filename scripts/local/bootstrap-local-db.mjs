#!/usr/bin/env node

import {
  buildLocalAppEnv,
  ensureDockerRunning,
  ensureExecSqlFunction,
  ensureSupabaseRunning,
  readSupabaseStatusEnv,
  runMigration
} from './lib.mjs';

const mode = process.argv[2] || 'full';
const validModes = new Set(['reset', 'setup', 'seed', 'core', 'full']);

if (!validModes.has(mode)) {
  console.error(`Unsupported mode: ${mode}`);
  console.error('Usage: node scripts/local/bootstrap-local-db.mjs [reset|setup|seed|core|full]');
  process.exit(1);
}

try {
  ensureDockerRunning();
  ensureSupabaseRunning();
  ensureExecSqlFunction();

  const statusEnv = readSupabaseStatusEnv();
  const env = buildLocalAppEnv(statusEnv);

  switch (mode) {
    case 'reset':
      runMigration('reset', env);
      break;
    case 'setup':
      runMigration('setup', env);
      break;
    case 'seed':
      runMigration('seed', env);
      break;
    case 'core':
      runMigration('reset', env);
      runMigration('setup', env);
      break;
    case 'full':
      runMigration('reset', env);
      runMigration('setup', env);
      runMigration('seed', env);
      break;
    default:
      break;
  }

  console.log(`✅ Local database bootstrap complete (${mode}).`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
