#!/usr/bin/env node

import {
  buildLocalAppEnv,
  ensureDockerRunning,
  ensureSupabaseRunning,
  formatShellEnvExports,
  LOCAL_APP_ENV_KEYS,
  readSupabaseStatusEnv
} from './lib.mjs';

const asJson = process.argv.includes('--json');

try {
  ensureDockerRunning();
  ensureSupabaseRunning();

  const statusEnv = readSupabaseStatusEnv();
  const env = buildLocalAppEnv(statusEnv);
  const localEnv = Object.fromEntries(LOCAL_APP_ENV_KEYS.map((key) => [key, env[key]]));

  if (asJson) {
    console.log(JSON.stringify(localEnv, null, 2));
  } else {
    console.log(formatShellEnvExports(localEnv));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
