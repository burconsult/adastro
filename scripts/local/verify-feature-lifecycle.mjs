#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildLocalAppEnv,
  detectLocalDbContainerName,
  ensureDockerRunning,
  ensureExecSqlFunction,
  ensureSupabaseRunning,
  queryLocalPostgres,
  readSupabaseStatusEnv,
  runCommand,
  runMigration
} from './lib.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');
const featureRoot = resolve(projectRoot, 'src/lib/features');

const FEATURE_FIXTURES = [
  {
    id: 'comments',
    enableKey: 'features.comments.enabled',
    tables: ['comments'],
    migrations: [
      resolve(featureRoot, 'comments/migrations/000_comments.sql')
    ],
    uninstallSqlPath: resolve(featureRoot, 'comments/uninstall.sql'),
    use: () => {
      const postId = scalarValue(
        "SELECT id::text FROM public.posts WHERE status = 'published' ORDER BY created_at ASC LIMIT 1;"
      );
      assert(Boolean(postId), 'comments: requires at least one published post for lifecycle probe.');
      execSql(`
        INSERT INTO public.comments (post_id, author_name, author_email, content, status)
        VALUES ('${escapeSql(postId)}', 'Lifecycle Bot', 'lifecycle@example.com', 'Feature lifecycle comment', 'approved');
      `);
      const count = numberValue('SELECT count(*)::text FROM public.comments;');
      assert(count >= 1, 'comments: data probe insert should persist.');
      return count;
    }
  },
  {
    id: 'newsletter',
    enableKey: 'features.newsletter.enabled',
    tables: ['newsletter_subscribers', 'newsletter_campaigns', 'newsletter_deliveries'],
    migrations: [
      resolve(featureRoot, 'newsletter/migrations/000_newsletter.sql')
    ],
    uninstallSqlPath: resolve(featureRoot, 'newsletter/uninstall.sql'),
    use: () => {
      const suffix = Date.now().toString().slice(-6);
      const subscriberEmail = `lifecycle-${suffix}@example.com`;
      const subscriberId = scalarValue(`
        INSERT INTO public.newsletter_subscribers (email, status, source)
        VALUES ('${escapeSql(subscriberEmail)}', 'subscribed', 'lifecycle-test')
        RETURNING id::text;
      `);
      assert(Boolean(subscriberId), 'newsletter: subscriber probe insert should return id.');

      const campaignId = scalarValue(`
        INSERT INTO public.newsletter_campaigns (template_key, subject, body_html, provider, status, recipients_count, delivered_count, failed_count)
        VALUES ('new_post', 'Lifecycle campaign', '<p>Lifecycle</p>', 'console', 'completed', 1, 1, 0)
        RETURNING id::text;
      `);
      assert(Boolean(campaignId), 'newsletter: campaign probe insert should return id.');

      execSql(`
        INSERT INTO public.newsletter_deliveries (campaign_id, subscriber_id, email, status)
        VALUES (
          '${escapeSql(campaignId)}',
          '${escapeSql(subscriberId)}',
          '${escapeSql(subscriberEmail)}',
          'delivered'
        );
      `);

      const subscribers = numberValue('SELECT count(*)::text FROM public.newsletter_subscribers;');
      const campaigns = numberValue('SELECT count(*)::text FROM public.newsletter_campaigns;');
      const deliveries = numberValue('SELECT count(*)::text FROM public.newsletter_deliveries;');
      assert(subscribers >= 1 && campaigns >= 1 && deliveries >= 1, 'newsletter: data probes should persist.');
      return subscribers + campaigns + deliveries;
    }
  },
  {
    id: 'ai',
    enableKey: 'features.ai.enabled',
    tables: [],
    migrations: [],
    uninstallSqlPath: null,
    use: () => {
      setSetting('features.ai.defaultProvider.text', 'gemini');
      const value = getSettingJsonText('features.ai.defaultProvider.text');
      assert(value === 'gemini', 'ai: usage probe should persist provider change.');
      return 1;
    }
  }
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function escapeSql(value) {
  return String(value).replace(/'/g, "''");
}

function jsonLiteral(value) {
  return `'${escapeSql(JSON.stringify(value))}'::jsonb`;
}

function scalarValue(sql) {
  const output = queryLocalPostgres(sql);
  const line = output
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find(Boolean);
  return line || '';
}

function numberValue(sql) {
  const raw = scalarValue(sql);
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function tableExists(tableName) {
  const exists = scalarValue(`SELECT to_regclass('public.${escapeSql(tableName)}') IS NOT NULL;`);
  return exists === 't';
}

function runSqlScript(sql, label) {
  const containerName = detectLocalDbContainerName();
  if (!containerName) {
    throw new Error(`Could not find local Supabase Postgres container while running ${label}.`);
  }

  runCommand(
    'docker',
    ['exec', '-i', containerName, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
    {
      input: sql,
      stdio: ['pipe', 'inherit', 'inherit']
    }
  );
}

function runSqlFile(filePath, label) {
  const sql = readFileSync(filePath, 'utf8');
  runSqlScript(sql, label);
}

function execSql(sql) {
  queryLocalPostgres(sql);
}

function setSetting(key, value, category = 'extras') {
  execSql(`
    INSERT INTO public.site_settings (key, value, category, description)
    VALUES (
      '${escapeSql(key)}',
      ${jsonLiteral(value)},
      '${escapeSql(category)}',
      'Lifecycle verification setting'
    )
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          category = EXCLUDED.category,
          description = EXCLUDED.description,
          updated_at = NOW();
  `);
}

function deleteSettingsPrefix(prefix) {
  execSql(`DELETE FROM public.site_settings WHERE key LIKE '${escapeSql(prefix)}%';`);
}

function getSettingJsonText(key) {
  const raw = scalarValue(`
    SELECT value::text
    FROM public.site_settings
    WHERE key = '${escapeSql(key)}'
    LIMIT 1;
  `);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function isFeatureEnabled(settingKey) {
  const value = getSettingJsonText(settingKey);
  if (value === null || value === undefined) return false;
  return value === true;
}

function countSettingsPrefix(prefix) {
  return numberValue(`
    SELECT count(*)::text
    FROM public.site_settings
    WHERE key LIKE '${escapeSql(prefix)}%';
  `);
}

function verifyFeatureLifecycle(feature) {
  console.log(`\n--- Verifying lifecycle: ${feature.id} ---`);

  assert(!isFeatureEnabled(feature.enableKey), `${feature.id}: expected default inactive state.`);
  feature.tables.forEach((tableName) => {
    assert(!tableExists(tableName), `${feature.id}: table ${tableName} should not exist before activation.`);
  });

  for (const migrationPath of feature.migrations) {
    runSqlFile(migrationPath, `${feature.id} migration`);
  }
  setSetting(feature.enableKey, true);

  assert(isFeatureEnabled(feature.enableKey), `${feature.id}: activation should set enabled=true.`);
  feature.tables.forEach((tableName) => {
    assert(tableExists(tableName), `${feature.id}: table ${tableName} should exist after activation.`);
  });

  const probeCount = feature.use();
  assert(probeCount >= 1, `${feature.id}: usage probe should produce data.`);

  setSetting(feature.enableKey, false);
  assert(!isFeatureEnabled(feature.enableKey), `${feature.id}: deactivation should set enabled=false.`);

  if (feature.tables.length > 0) {
    const probeTable = feature.tables[0];
    const retainedCount = numberValue(`SELECT count(*)::text FROM public.${probeTable};`);
    assert(retainedCount >= 1, `${feature.id}: data should remain after deactivation.`);
  }

  if (feature.uninstallSqlPath) {
    runSqlFile(feature.uninstallSqlPath, `${feature.id} uninstall`);
  }
  deleteSettingsPrefix(`features.${feature.id}.`);

  assert(countSettingsPrefix(`features.${feature.id}.`) === 0, `${feature.id}: settings prefix should be removed on uninstall.`);
  feature.tables.forEach((tableName) => {
    assert(!tableExists(tableName), `${feature.id}: table ${tableName} should be removed on uninstall.`);
  });

  for (const migrationPath of feature.migrations) {
    runSqlFile(migrationPath, `${feature.id} reinstall migration`);
  }
  setSetting(feature.enableKey, false);
  assert(!isFeatureEnabled(feature.enableKey), `${feature.id}: reinstall should restore inactive default state.`);

  feature.tables.forEach((tableName) => {
    assert(tableExists(tableName), `${feature.id}: table ${tableName} should exist after reinstall.`);
    const rowCount = numberValue(`SELECT count(*)::text FROM public.${tableName};`);
    assert(rowCount === 0, `${feature.id}: table ${tableName} should be empty after reinstall.`);
  });

  console.log(`✅ ${feature.id}: activate -> use -> deactivate -> uninstall -> reinstall passed.`);
}

let localEnv = null;

try {
  ensureDockerRunning();
  ensureSupabaseRunning();
  ensureExecSqlFunction();

  const statusEnv = readSupabaseStatusEnv();
  localEnv = buildLocalAppEnv(statusEnv);

  runMigration('reset', localEnv);
  runMigration('setup', localEnv);
  runMigration('seed', localEnv);

  FEATURE_FIXTURES.forEach((feature) => verifyFeatureLifecycle(feature));

  console.log('\n✅ Feature lifecycle verification passed for ai/comments/newsletter.');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (localEnv) {
    try {
      runMigration('reset', localEnv);
      runMigration('setup', localEnv);
      console.log('↺ Local database reset to core baseline.');
    } catch (restoreError) {
      console.error(
        restoreError instanceof Error
          ? `Failed to restore local core baseline: ${restoreError.message}`
          : `Failed to restore local core baseline: ${String(restoreError)}`
      );
      process.exitCode = 1;
    }
  }
}
