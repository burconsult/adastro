#!/usr/bin/env node

import {
  ensureDockerRunning,
  getLocalSupabaseProjectName,
  queryLocalPostgres,
  readLocalSupabaseConfig,
  readSupabaseStatusEnv,
  runCommandResult,
  supabaseConfigPath,
  supabaseWorkdir
} from './lib.mjs';

const config = readLocalSupabaseConfig();
const projectId = getLocalSupabaseProjectName();
const portEntries = [
  ['API', config.ports.api],
  ['DB', config.ports.db],
  ['Studio', config.ports.studio],
  ['Mailpit', config.ports.mailpit],
  ['Analytics', config.ports.analytics]
].filter(([, port]) => Number.isFinite(port));

let failureCount = 0;
let warningCount = 0;

function report(level, label, detail) {
  const message = `${level.padEnd(4)} ${label}${detail ? `: ${detail}` : ''}`;
  console.log(message);
  if (level === 'FAIL') failureCount += 1;
  if (level === 'WARN') warningCount += 1;
}

function dockerContainersPublishingPort(port) {
  const result = runCommandResult(
    'docker',
    ['ps', '--filter', `publish=${port}`, '--format', '{{.Names}}'],
    { captureOutput: true }
  );
  if (result.error || result.status !== 0) return [];
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function listeningPortOwners(port) {
  const result = runCommandResult(
    'lsof',
    ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'],
    { captureOutput: true }
  );

  if (result.error) {
    return null;
  }

  if (result.status !== 0 || !result.stdout) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean);
}

function expectedProjectContainerNames(port) {
  return dockerContainersPublishingPort(port).filter((name) => name.endsWith(`_${projectId}`));
}

function statusEnvPort(statusEnv, key) {
  const value = statusEnv[key];
  if (!value) return null;
  try {
    return Number(new URL(value).port);
  } catch {
    return null;
  }
}

function databaseLooksBootstrapped() {
  try {
    return queryLocalPostgres("SELECT to_regclass('public.schema_migrations') IS NOT NULL;") === 't';
  } catch {
    return false;
  }
}

console.log('Adastro Local Doctor\n');
report('OK', 'Supabase workdir', supabaseWorkdir);
report('OK', 'Supabase config', supabaseConfigPath);
report('OK', 'Configured project id', projectId);

try {
  ensureDockerRunning();
  report('OK', 'Docker', 'available');
} catch (error) {
  report('FAIL', 'Docker', error instanceof Error ? error.message : String(error));
}

const cliVersion = runCommandResult('supabase', ['--version'], { captureOutput: true });
if (cliVersion.error || cliVersion.status !== 0) {
  report(
    'FAIL',
    'Supabase CLI',
    cliVersion.error ? String(cliVersion.error) : cliVersion.stderr || 'not available'
  );
} else {
  report('OK', 'Supabase CLI', cliVersion.stdout.split(/\r?\n/)[0] || 'available');
}

for (const [label, port] of portEntries) {
  const ownedContainers = expectedProjectContainerNames(port);
  if (ownedContainers.length > 0) {
    report('OK', `${label} port ${port}`, `owned by ${ownedContainers.join(', ')}`);
    continue;
  }

  const dockerOwners = dockerContainersPublishingPort(port);
  if (dockerOwners.length > 0) {
    report('FAIL', `${label} port ${port}`, `occupied by ${dockerOwners.join(', ')}`);
    continue;
  }

  const processOwners = listeningPortOwners(port);
  if (processOwners === null) {
    report('WARN', `${label} port ${port}`, 'unable to inspect local process bindings (`lsof` unavailable)');
    continue;
  }

  if (processOwners.length > 0) {
    report('FAIL', `${label} port ${port}`, `occupied by ${processOwners[0]}`);
    continue;
  }

  report('OK', `${label} port ${port}`, 'free');
}

let statusEnv = null;
try {
  statusEnv = readSupabaseStatusEnv();
  report('OK', 'Local Supabase stack', 'running');
} catch (error) {
  report(
    'WARN',
    'Local Supabase stack',
    `not running from ${supabaseWorkdir}. Start with \`npm run local:supabase:start\`.`
  );
}

if (statusEnv) {
  const expectedPorts = {
    API_URL: config.ports.api,
    DB_URL: config.ports.db,
    STUDIO_URL: config.ports.studio
  };

  for (const [key, expectedPort] of Object.entries(expectedPorts)) {
    if (!Number.isFinite(expectedPort)) continue;
    const actualPort = statusEnvPort(statusEnv, key);
    if (actualPort === expectedPort) {
      report('OK', `${key} port`, String(actualPort));
    } else {
      report('FAIL', `${key} port`, `expected ${expectedPort}, got ${actualPort ?? 'unknown'}`);
    }
  }

  if (databaseLooksBootstrapped()) {
    report('OK', 'Local database schema', 'bootstrapped');
  } else {
    report('WARN', 'Local database schema', 'missing app tables. Run `npm run local:db:full`.');
  }
}

console.log('');
if (failureCount > 0) {
  console.log(`Doctor found ${failureCount} blocking issue${failureCount === 1 ? '' : 's'}${warningCount > 0 ? ` and ${warningCount} warning${warningCount === 1 ? '' : 's'}` : ''}.`);
  process.exit(1);
}

if (warningCount > 0) {
  console.log(`Doctor found ${warningCount} warning${warningCount === 1 ? '' : 's'}.`);
} else {
  console.log('Doctor checks passed.');
}
