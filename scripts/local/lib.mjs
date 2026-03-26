#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const projectRoot = resolve(__dirname, '../..');
export const supabaseWorkdir = resolve(projectRoot, 'infra');
export const supabaseConfigPath = resolve(projectRoot, 'infra/supabase/config.toml');
const functionsSqlPath = resolve(projectRoot, 'infra/supabase/functions.sql');
export const LOCAL_APP_ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SITE_URL'
];

function formatCommand(command, args) {
  return `${command} ${args.join(' ')}`.trim();
}

export function runCommandResult(command, args = [], options = {}) {
  const {
    cwd = projectRoot,
    env = process.env,
    captureOutput = false,
    input,
    stdio
  } = options;

  const resolvedStdio = stdio ?? (captureOutput ? 'pipe' : 'inherit');
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: resolvedStdio,
    input
  });

  return {
    error: result.error ?? null,
    status: result.status ?? (result.error ? 1 : 0),
    stderr: (result.stderr ?? '').trim(),
    stdout: (result.stdout ?? '').trim()
  };
}

export function runCommand(command, args = [], options = {}) {
  const result = runCommandResult(command, args, options);

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const details = result.stderr || result.stdout || `exit code ${result.status}`;
    throw new Error(`Command failed: ${formatCommand(command, args)}\n${details}`);
  }

  return result.stdout;
}

export function ensureDockerRunning() {
  runCommand('docker', ['info'], { captureOutput: true });
}

export function ensureSupabaseRunning() {
  try {
    runCommand('supabase', ['status', '--workdir', supabaseWorkdir], { captureOutput: true });
    return;
  } catch {
    runCommand('supabase', ['start', '--workdir', supabaseWorkdir]);
  }
}

export function parseSupabaseStatusEnv(output) {
  const env = {};
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    const value =
      rawValue.startsWith('"') && rawValue.endsWith('"')
        ? rawValue.slice(1, -1)
        : rawValue;
    if (key) {
      env[key] = value;
    }
  }

  return env;
}

export function readSupabaseStatusEnv() {
  const output = runCommand('supabase', ['status', '-o', 'env', '--workdir', supabaseWorkdir], {
    captureOutput: true
  });

  return parseSupabaseStatusEnv(output);
}

export function parseLocalSupabaseConfig(configText) {
  const config = {
    ports: {}
  };
  let section = 'root';

  for (const rawLine of configText.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }

    const stringMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s*=\s*"([^"]*)"$/);
    if (stringMatch) {
      const [, key, value] = stringMatch;
      if (section === 'root' && key === 'project_id') {
        config.projectId = value;
      }
      continue;
    }

    const numberMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s*=\s*(\d+)$/);
    if (!numberMatch) continue;

    const [, key, value] = numberMatch;
    if (key !== 'port' && key !== 'shadow_port') continue;

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) continue;

    switch (`${section}.${key}`) {
      case 'api.port':
        config.ports.api = numericValue;
        break;
      case 'db.port':
        config.ports.db = numericValue;
        break;
      case 'db.shadow_port':
        config.ports.dbShadow = numericValue;
        break;
      case 'db.pooler.port':
        config.ports.dbPooler = numericValue;
        break;
      case 'studio.port':
        config.ports.studio = numericValue;
        break;
      case 'inbucket.port':
        config.ports.mailpit = numericValue;
        break;
      case 'analytics.port':
        config.ports.analytics = numericValue;
        break;
      default:
        break;
    }
  }

  return config;
}

export function readLocalSupabaseConfig() {
  return parseLocalSupabaseConfig(readFileSync(supabaseConfigPath, 'utf8'));
}

export function getLocalSupabaseProjectName() {
  return readLocalSupabaseConfig().projectId || basename(supabaseWorkdir);
}

export function resolveLocalSiteUrl(options = {}) {
  const explicitSiteUrl = String(options.siteUrl ?? process.env.LOCAL_SITE_URL ?? '').trim();
  if (explicitSiteUrl) {
    return explicitSiteUrl;
  }

  const host = String(options.host ?? process.env.LOCAL_APP_HOST ?? '127.0.0.1').trim() || '127.0.0.1';
  const port = String(options.port ?? process.env.LOCAL_APP_PORT ?? '4321').trim() || '4321';
  return `http://${host}:${port}`;
}

export function buildLocalAppEnv(statusEnv, options = {}) {
  const supabaseUrl = statusEnv.API_URL || statusEnv.SUPABASE_URL;
  const publishableKey = statusEnv.PUBLISHABLE_KEY || statusEnv.ANON_KEY;
  const secretKey =
    statusEnv.SERVICE_ROLE_KEY ||
    statusEnv.SUPABASE_SECRET_KEY ||
    statusEnv.SECRET_KEY;

  if (!supabaseUrl || !publishableKey || !secretKey) {
    throw new Error(
      'Could not resolve local Supabase credentials from `supabase status -o env`. Expected API_URL, ANON_KEY/PUBLISHABLE_KEY, and SERVICE_ROLE_KEY (mapped to SUPABASE_SECRET_KEY).'
    );
  }

  const siteUrl = resolveLocalSiteUrl(options);

  return {
    ...process.env,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_SECRET_KEY: secretKey,
    SITE_URL: siteUrl
  };
}

export function formatShellEnvExports(env, keys = LOCAL_APP_ENV_KEYS) {
  return keys
    .map((key) => {
      const value = String(env[key] ?? '');
      const escapedValue = value.replace(/'/g, `'\\''`);
      return `export ${key}='${escapedValue}'`;
    })
    .join('\n');
}

export function detectLocalDbContainerName() {
  let byPort = null;

  try {
    const statusEnv = readSupabaseStatusEnv();
    const dbUrl = statusEnv.DB_URL;
    if (dbUrl) {
      const dbPort = new URL(dbUrl).port;
      if (dbPort) {
        byPort = runCommand('docker', ['ps', '--filter', `publish=${dbPort}`, '--format', '{{.Names}}'], {
          captureOutput: true
        })
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find(Boolean);
      }
    }
  } catch {
    byPort = null;
  }

  if (byPort) return byPort;

  const supabaseLocalProjectName = getLocalSupabaseProjectName();
  const byProjectLabel = runCommand(
    'docker',
    ['ps', '--filter', `label=com.supabase.cli.project=${supabaseLocalProjectName}`, '--format', '{{.Names}}'],
    { captureOutput: true }
  )
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((name) => /^supabase_db_/.test(name));

  if (byProjectLabel) return byProjectLabel;

  const byNamePattern = runCommand('docker', ['ps', '--format', '{{.Names}}'], { captureOutput: true })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((name) => /^supabase_db_/.test(name));

  return byNamePattern || null;
}

export function queryLocalPostgres(sql) {
  const containerName = detectLocalDbContainerName();
  if (!containerName) {
    throw new Error('Could not find a running local Supabase DB container. Start Supabase first.');
  }

  return runCommand(
    'docker',
    ['exec', containerName, 'psql', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-c', sql],
    { captureOutput: true }
  ).trim();
}

export function ensureExecSqlFunction() {
  const containerName = detectLocalDbContainerName();
  if (!containerName) {
    throw new Error('Could not find a running local Supabase DB container. Start Supabase first.');
  }

  const sql = readFileSync(functionsSqlPath, 'utf8');
  runCommand(
    'docker',
    ['exec', '-i', containerName, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
    {
      input: sql,
      stdio: ['pipe', 'inherit', 'inherit']
    }
  );
}

export function runMigration(command, env) {
  runCommand('node', ['infra/supabase/scripts/migrate.js', command], { env });
}

export function runNpmScript(script, extraArgs = [], env = process.env) {
  const args = ['run', script];
  if (extraArgs.length > 0) {
    args.push('--', ...extraArgs);
  }

  runCommand('npm', args, { env });
}
