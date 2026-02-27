#!/usr/bin/env node

import {
  buildLocalAppEnv,
  ensureDockerRunning,
  ensureSupabaseRunning,
  readSupabaseStatusEnv,
  runCommand
} from './lib.mjs';

const commandArgs = process.argv.slice(2);

if (commandArgs.length === 0) {
  console.error('Usage: node scripts/local/with-local-env.mjs <command> [args...]');
  process.exit(1);
}

try {
  ensureDockerRunning();
  ensureSupabaseRunning();

  const statusEnv = readSupabaseStatusEnv();
  const env = buildLocalAppEnv(statusEnv);

  runCommand(commandArgs[0], commandArgs.slice(1), { env });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
