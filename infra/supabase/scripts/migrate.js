#!/usr/bin/env node

/**
 * Database migration script for Adastro
 * 
 * Usage:
 *   node infra/supabase/scripts/migrate.js setup    # Run initial schema setup
 *   node infra/supabase/scripts/migrate.js seed     # Run seed data
 *   node infra/supabase/scripts/migrate.js reset    # Reset database (development only)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { config as loadEnv } from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const scriptsDir = dirname(__filename)
const supabaseInfraRoot = dirname(scriptsDir)
const infraRoot = dirname(supabaseInfraRoot)
const projectRoot = dirname(infraRoot)

// Load local environment defaults for CLI usage.
// Production/CI should inject environment variables explicitly.
loadEnv({ path: join(projectRoot, '.env') })
loadEnv({ path: join(projectRoot, '.env.local') })

// Load environment variables
const supabaseUrl = process.env.SUPABASE_URL
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseSecretKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   SUPABASE_URL')
  console.error('   SUPABASE_SECRET_KEY')
  console.error('')
  console.error('Ensure environment variables are set (for local CLI usage, use project-root .env).')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const MIGRATIONS_TABLE = 'schema_migrations'

const safeIdentifier = (identifier) => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: "${identifier}"`)
  }
  return identifier
}

const escapeSqlString = (value) => String(value).replace(/'/g, "''")
const shouldStripOwnerOnlySql = process.env.ADASTRO_CLI_APPLY_OWNER_SQL !== 'true'

function preprocessMigrationSql(filePath, sql) {
  const fileName = filePath.split('/').pop() || filePath
  if (!shouldStripOwnerOnlySql || fileName !== '000_core.sql') {
    return { sql, skippedSections: [] }
  }

  const skippedSections = []
  let processedSql = sql

  const authUsersTriggerPattern = /DROP TRIGGER IF EXISTS on_auth_user_created ON auth\.users;\s*CREATE TRIGGER on_auth_user_created\s*AFTER INSERT ON auth\.users\s*FOR EACH ROW EXECUTE FUNCTION public\.handle_new_auth_user\(\);\s*/g
  const authTriggerMatches = processedSql.match(authUsersTriggerPattern)
  if (authTriggerMatches?.length) {
    processedSql = processedSql.replace(authUsersTriggerPattern, '')
    skippedSections.push(`auth.users trigger DDL (${authTriggerMatches.length} block)`)
  }

  const storageDropPoliciesPattern = /DROP POLICY IF EXISTS "[^"]+" ON storage\.objects;\n?/g
  const storageDropPolicyMatches = processedSql.match(storageDropPoliciesPattern)
  if (storageDropPolicyMatches?.length) {
    processedSql = processedSql.replace(storageDropPoliciesPattern, '')
    skippedSections.push(`storage.objects DROP POLICY statements (${storageDropPolicyMatches.length})`)
  }

  const storageCreatePoliciesPattern = /CREATE POLICY "[^"]+" ON storage\.objects[\s\S]*?;\n?/g
  const storageCreatePolicyMatches = processedSql.match(storageCreatePoliciesPattern)
  if (storageCreatePolicyMatches?.length) {
    processedSql = processedSql.replace(storageCreatePoliciesPattern, '')
    skippedSections.push(`storage.objects CREATE POLICY statements (${storageCreatePolicyMatches.length})`)
  }

  return {
    sql: processedSql,
    skippedSections
  }
}

const tableExists = async (tableName) => {
  const table = safeIdentifier(tableName)
  const { error } = await supabase.rpc('exec_sql', {
    sql: `SELECT 1 FROM public.${table} LIMIT 1;`
  })

  if (!error) return true
  const message = String(error.message || '').toLowerCase()
  if (message.includes('relation') && message.includes('does not exist')) {
    return false
  }
  if (message.includes('does not exist')) {
    return false
  }

  throw new Error(`Failed to check table "${table}": ${error.message}`)
}

const columnExists = async (tableName, columnName) => {
  const table = safeIdentifier(tableName)
  const column = safeIdentifier(columnName)
  const { error } = await supabase.rpc('exec_sql', {
    sql: `SELECT ${column} FROM public.${table} LIMIT 1;`
  })

  if (!error) return true
  const message = String(error.message || '').toLowerCase()
  if (message.includes('column') && message.includes('does not exist')) {
    return false
  }
  if (message.includes('relation') && message.includes('does not exist')) {
    return false
  }
  if (message.includes('does not exist')) {
    return false
  }

  throw new Error(`Failed to check column "${table}.${column}": ${error.message}`)
}

async function ensureMigrationsTable() {
  const createSql = `
    CREATE TABLE IF NOT EXISTS public.${MIGRATIONS_TABLE} (
      id BIGSERIAL PRIMARY KEY,
      version TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      notes TEXT
    );

    REVOKE SELECT ON TABLE public.${MIGRATIONS_TABLE} FROM anon, authenticated;
    GRANT SELECT, INSERT, UPDATE ON TABLE public.${MIGRATIONS_TABLE} TO service_role;
  `
  const { error } = await supabase.rpc('exec_sql', { sql: createSql })
  if (error) {
    throw new Error(`Failed to ensure ${MIGRATIONS_TABLE} table: ${error.message}`)
  }
}

async function getAppliedMigrations() {
  // PostgREST table introspection can be stale or unavailable in service-key flows.
  // Migration replay safety relies on reflection checks in migrationAlreadyReflected().
  return new Set()
}

async function markMigrationApplied(version, notes = null) {
  const safeVersion = escapeSqlString(version)
  const safeNotes = notes == null ? 'NULL' : `'${escapeSqlString(notes)}'`
  const sql = `
    INSERT INTO public.${MIGRATIONS_TABLE} (version, notes)
    VALUES ('${safeVersion}', ${safeNotes})
    ON CONFLICT (version) DO UPDATE
    SET notes = EXCLUDED.notes;
  `

  const { error } = await supabase.rpc('exec_sql', { sql })

  if (error) {
    throw new Error(`Failed to record migration ${version}: ${error.message}`)
  }
}

async function migrationAlreadyReflected(version) {
  switch (version) {
    case '000_core.sql':
      return (await tableExists('site_settings')) && (await columnExists('media_assets', 'original_filename'))
    case '001_content_locales.sql':
      return (await columnExists('posts', 'locale')) && (await columnExists('pages', 'locale'))
    default:
      return false
  }
}

async function ensureExecSqlFunction() {
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: 'select 1;' })
    if (!error) {
      return
    }

    if (!String(error.message).includes('exec_sql')) {
      throw error
    }
  } catch (err) {
    if (!String(err?.message ?? '').includes('exec_sql')) {
      // Different failure, rethrow so caller can handle appropriately
      throw err
    }
  }

  const functionsPath = join(supabaseInfraRoot, 'functions.sql')
  const sql = readFileSync(functionsPath, 'utf8')
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]

  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseSecretKey}`,
      apikey: supabaseSecretKey
    },
    body: JSON.stringify({ query: sql })
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Failed to install exec_sql helper: ${response.status} ${response.statusText} - ${details}`)
  }

  console.log('✅ Installed exec_sql helper function')

  const { error: verifyError } = await supabase.rpc('exec_sql', { sql: 'select 1;' })
  if (verifyError) {
    throw new Error(`exec_sql helper verification failed: ${verifyError.message}`)
  }
}

async function runSQLFile(filePath, description) {
  console.log(`📄 Running ${description}...`)
  
  try {
    const originalSql = readFileSync(filePath, 'utf8')
    const { sql, skippedSections } = preprocessMigrationSql(filePath, originalSql)
    if (skippedSections.length > 0) {
      console.warn(
        `⚠️  ${description}: skipped owner-only SQL for CLI execution -> ${skippedSections.join(', ')}`
      )
      console.warn(
        '   Run infra/supabase/migrations/000_core.sql in Supabase SQL Editor if you need those policies/triggers applied now.'
      )
    }

    const { error } = await supabase.rpc('exec_sql', { sql })
    
    if (error) {
      console.error(`❌ Error running ${description}:`, error.message)
      return false
    }
    
    console.log(`✅ ${description} completed successfully`)
    return true
  } catch (err) {
    console.error(`❌ Error reading ${filePath}:`, err.message)
    return false
  }
}

async function setupDatabase() {
  console.log('🚀 Setting up database schema...\n')
  await ensureMigrationsTable()
  const appliedMigrations = await getAppliedMigrations()
  
  const migrationsDir = join(supabaseInfraRoot, 'migrations')
  const migrations = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => ({
      file: join(migrationsDir, file),
      description: `Migration ${file}`
    }))
  
  for (const migration of migrations) {
    const version = migration.description.replace('Migration ', '')

    if (appliedMigrations.has(version)) {
      console.log(`⏭️  Skipping ${version} (already recorded in ${MIGRATIONS_TABLE})`)
      continue
    }

    const reflected = await migrationAlreadyReflected(version)
    if (reflected) {
      console.log(`⏭️  Skipping ${version} (database already contains expected objects)`)
      await ensureMigrationsTable()
      await markMigrationApplied(version, 'baseline-skip')
      continue
    }

    const success = await runSQLFile(migration.file, migration.description)
    if (!success) {
      console.error('❌ Migration failed. Stopping.')
      process.exit(1)
    }
    // Some bootstrap migrations rebuild public schema and remove schema_migrations.
    await ensureMigrationsTable()
    await markMigrationApplied(version)
  }
  
  console.log('\n✅ Database schema setup completed!')
}

async function seedDatabase() {
  console.log('🌱 Seeding database with sample data...\n')
  
  const success = await runSQLFile(
    join(supabaseInfraRoot, 'seed.sql'),
    'Seed data insertion'
  )
  
  if (!success) {
    console.error('❌ Seeding failed.')
    process.exit(1)
  }
  
  console.log('\n✅ Database seeding completed!')
}

async function resetDatabase() {
  console.log('⚠️  Resetting database (this will delete all data)...\n')
  
  // Confirm in production
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Cannot reset database in production environment')
    process.exit(1)
  }
  
  const resetSql = `
    DO $$
    DECLARE
      item RECORD;
    BEGIN
      -- Drop views first, then tables, to avoid dependency issues.
      FOR item IN
        SELECT schemaname, viewname
        FROM pg_views
        WHERE schemaname = 'public'
      LOOP
        EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', item.schemaname, item.viewname);
      END LOOP;

      FOR item IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public'
      LOOP
        EXECUTE format('DROP TABLE IF EXISTS %I.%I CASCADE', item.schemaname, item.tablename);
      END LOOP;

      FOR item IN
        SELECT sequence_schema, sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
      LOOP
        EXECUTE format('DROP SEQUENCE IF EXISTS %I.%I CASCADE', item.sequence_schema, item.sequence_name);
      END LOOP;
    END;
    $$;
  `

  console.log('🧹 Dropping all public schema tables, views, and sequences...')
  const { error } = await supabase.rpc('exec_sql', { sql: resetSql })
  if (error) {
    console.error('❌ Error resetting public schema objects:', error.message)
    process.exit(1)
  }

  const verifySql = `
    DO $$
    DECLARE
      remaining_tables integer;
      remaining_views integer;
      remaining_sequences integer;
    BEGIN
      SELECT count(*) INTO remaining_tables FROM pg_tables WHERE schemaname = 'public';
      SELECT count(*) INTO remaining_views FROM pg_views WHERE schemaname = 'public';
      SELECT count(*) INTO remaining_sequences FROM information_schema.sequences WHERE sequence_schema = 'public';

      IF remaining_tables > 0 OR remaining_views > 0 OR remaining_sequences > 0 THEN
        RAISE EXCEPTION 'Reset incomplete. Remaining objects -> tables: %, views: %, sequences: %',
          remaining_tables, remaining_views, remaining_sequences;
      END IF;
    END;
    $$;
  `

  const { error: verifyError } = await supabase.rpc('exec_sql', { sql: verifySql })
  if (verifyError) {
    console.error('❌ Reset verification failed:', verifyError.message)
    process.exit(1)
  }
  
  console.log('\n✅ Database reset completed!')
}

// Main execution
const command = process.argv[2]

await ensureExecSqlFunction().catch((error) => {
  console.error('❌ Unable to prepare database helper function:', error.message)
  process.exit(1)
})

switch (command) {
  case 'setup':
    await setupDatabase()
    break
  case 'seed':
    await seedDatabase()
    break
  case 'reset':
    await resetDatabase()
    break
  case 'full':
    await setupDatabase()
    await seedDatabase()
    break
  default:
    console.log('Adastro - Database Migration Tool\n')
    console.log('Usage:')
    console.log('  node infra/supabase/scripts/migrate.js setup    # Run initial schema setup')
    console.log('  node infra/supabase/scripts/migrate.js seed     # Run seed data')
    console.log('  node infra/supabase/scripts/migrate.js full     # Setup + seed')
    console.log('  node infra/supabase/scripts/migrate.js reset    # Reset database (dev only)')
    console.log('')
    console.log('Make sure to set SUPABASE_URL and SUPABASE_SECRET_KEY in your .env file')
}
