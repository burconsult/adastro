#!/usr/bin/env node

import {
  buildLocalAppEnv,
  ensureDockerRunning,
  ensureSupabaseRunning,
  readSupabaseStatusEnv,
  runNpmScript
} from './lib.mjs';

const mode = process.argv[2] || 'dev';
const extraArgs = process.argv.slice(3);

if (!['dev', 'preview', 'build'].includes(mode)) {
  console.error(`Unsupported app mode: ${mode}`);
  console.error('Usage: node scripts/local/run-app.mjs [dev|preview|build] [extra args...]');
  process.exit(1);
}

try {
  ensureDockerRunning();
  ensureSupabaseRunning();

  const statusEnv = readSupabaseStatusEnv();
  const host = process.env.LOCAL_APP_HOST || '127.0.0.1';
  const port = process.env.LOCAL_APP_PORT || '4321';
  const env = buildLocalAppEnv(statusEnv, { host, port });

  if (mode === 'build') {
    runNpmScript('build', extraArgs, env);
  } else {
    runNpmScript(mode, ['--host', host, '--port', port, ...extraArgs], env);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
