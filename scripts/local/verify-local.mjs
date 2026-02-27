#!/usr/bin/env node

import {
  buildLocalAppEnv,
  ensureDockerRunning,
  ensureExecSqlFunction,
  ensureSupabaseRunning,
  readSupabaseStatusEnv,
  runCommand,
  runMigration,
  runNpmScript
} from './lib.mjs';

const mode = process.argv[2] || 'quick';

if (!['quick', 'full'].includes(mode)) {
  console.error(`Unsupported verify mode: ${mode}`);
  console.error('Usage: node scripts/local/verify-local.mjs [quick|full]');
  process.exit(1);
}

try {
  const withSeed = mode === 'full';

  ensureDockerRunning();
  ensureSupabaseRunning();
  ensureExecSqlFunction();

  const statusEnv = readSupabaseStatusEnv();
  const env = buildLocalAppEnv(statusEnv);

  runMigration('reset', env);
  runMigration('setup', env);

  if (withSeed) {
    runMigration('seed', env);
  }

  const verifyDbArgs = ['scripts/local/verify-db.mjs'];
  if (withSeed) {
    verifyDbArgs.push('--expect-seed');
  }
  runCommand('node', verifyDbArgs, { env });
  runCommand('node', ['scripts/ci/check-admin-consistency.mjs'], { env });
  runCommand('node', ['scripts/ci/check-theme-tokens.mjs'], { env });
  if (withSeed) {
    runCommand('node', ['scripts/local/verify-default-content.mjs'], { env });
    runCommand('node', ['scripts/ci/check-release-hygiene.mjs'], { env });
  }

  if (mode === 'quick') {
    runNpmScript(
      'test:run',
      [
        'src/lib/components/__tests__/SetupWizard.test.tsx',
        'src/lib/auth/__tests__/middleware.test.ts',
        'src/lib/services/__tests__/settings-service.test.ts'
      ],
      env
    );
  }

  if (mode === 'full') {
    runNpmScript('test:run', [], env);
    runNpmScript('build', [], env);
  }

  console.log(`✅ Local verification passed (${mode}).`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
