#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const projectRoot = resolve(__dirname, '../..');
export const supabaseWorkdir = resolve(projectRoot, 'infra/supabase');
const functionsSqlPath = resolve(projectRoot, 'infra/supabase/functions.sql');

function formatCommand(command, args) {
  return `${command} ${args.join(' ')}`.trim();
}

export function runCommand(command, args = [], options = {}) {
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

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = (result.stderr ?? '').trim();
    const stdout = (result.stdout ?? '').trim();
    const details = stderr || stdout || `exit code ${result.status}`;
    throw new Error(`Command failed: ${formatCommand(command, args)}\n${details}`);
  }

  return (result.stdout ?? '').trim();
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

export function readSupabaseStatusEnv() {
  const output = runCommand('supabase', ['status', '-o', 'env', '--workdir', supabaseWorkdir], {
    captureOutput: true
  });

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

export function buildLocalAppEnv(statusEnv) {
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

  const siteUrl = process.env.LOCAL_SITE_URL || 'http://127.0.0.1:4321';

  return {
    ...process.env,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_SECRET_KEY: secretKey,
    SITE_URL: siteUrl
  };
}

export function detectLocalDbContainerName() {
  const byPort = runCommand('docker', ['ps', '--filter', 'publish=54322', '--format', '{{.Names}}'], {
    captureOutput: true
  })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (byPort) return byPort;

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
