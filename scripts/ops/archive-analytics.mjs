#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_RETENTION_DAYS = 180;
const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), 'var/analytics-archives');
const PAGE_SIZE = 1000;

const parseArgs = (argv) => {
  const result = {
    retentionDays: undefined,
    outputDir: DEFAULT_OUTPUT_DIR,
    prune: false,
    help: false
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      result.help = true;
      continue;
    }
    if (arg === '--prune') {
      result.prune = true;
      continue;
    }
    if (arg.startsWith('--retention-days=')) {
      result.retentionDays = Number(arg.slice('--retention-days='.length));
      continue;
    }
    if (arg.startsWith('--output-dir=')) {
      result.outputDir = path.resolve(process.cwd(), arg.slice('--output-dir='.length));
    }
  }

  return result;
};

const printHelp = () => {
  console.log('Usage: node scripts/ops/archive-analytics.mjs [--retention-days=180] [--output-dir=./var/analytics-archives] [--prune]');
  console.log('');
  console.log('Requires SUPABASE_URL and SUPABASE_SECRET_KEY in the environment.');
};

const clampRetentionDays = (value) => {
  if (!Number.isFinite(value)) return DEFAULT_RETENTION_DAYS;
  return Math.min(3650, Math.max(7, Math.round(value)));
};

const getCutoffIso = (retentionDays) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - clampRetentionDays(retentionDays));
  return cutoff.toISOString();
};

const createAdminClient = () => {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secret) {
    throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required.');
  }

  return createClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

const loadRetentionDaysFromSettings = async (client) => {
  const { data, error } = await client
    .from('site_settings')
    .select('value')
    .eq('key', 'analytics.retention')
    .maybeSingle();

  if (error || !data?.value || typeof data.value !== 'object') {
    return DEFAULT_RETENTION_DAYS;
  }

  const retentionDays = Number(data.value.retentionDays);
  return clampRetentionDays(retentionDays);
};

const fetchArchiveRows = async (client, cutoffIso) => {
  const rows = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from('analytics_events')
      .select('id, event_type, entity_type, entity_id, data, user_agent, ip_address, created_at')
      .lt('created_at', cutoffIso)
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to read analytics events: ${error.message}`);
    }

    const page = Array.isArray(data) ? data : [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      return rows;
    }
  }
};

const run = async () => {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const client = createAdminClient();
  const retentionDays = clampRetentionDays(
    options.retentionDays ?? await loadRetentionDaysFromSettings(client)
  );
  const cutoffIso = getCutoffIso(retentionDays);

  const rows = await fetchArchiveRows(client, cutoffIso);
  const archivePayload = {
    exportedAt: new Date().toISOString(),
    retentionDays,
    pruneBefore: cutoffIso,
    rowCount: rows.length,
    rows
  };

  await fs.mkdir(options.outputDir, { recursive: true });
  const fileName = `analytics-archive-before-${cutoffIso.slice(0, 10)}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const outputPath = path.join(options.outputDir, fileName);

  await fs.writeFile(outputPath, JSON.stringify(archivePayload, null, 2));
  console.log(`Archived ${rows.length} analytics events to ${outputPath}`);

  if (!options.prune || rows.length === 0) {
    return;
  }

  const { error } = await client
    .from('analytics_events')
    .delete()
    .lt('created_at', cutoffIso);

  if (error) {
    throw new Error(`Failed to prune analytics events: ${error.message}`);
  }

  console.log(`Pruned ${rows.length} analytics events older than ${cutoffIso}`);
};

run().catch((error) => {
  console.error('archive-analytics failed:', error);
  process.exitCode = 1;
});
