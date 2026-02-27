import type { APIRoute } from 'astro';
import { isSupabaseAdminConfigured, supabaseAdmin } from '@/lib/supabase';
import { getSiteContentRouting } from '@/lib/site-config';
import { getStorageBucketConfig } from '@/lib/storage/buckets';
import { buildInvitePasswordSetupPath } from '@/lib/auth/access-policy';
import {
  detectDeploymentTarget,
  detectRequestSiteUrl,
  getRuntimeEnv,
  isConfigured,
  isMissingRelationError,
  normalizeBooleanSetting,
  normalizeDeploymentProvider,
  sanitizeBaseUrl,
  SETUP_ALLOW_REENTRY_KEY,
  SETUP_COMPLETION_KEY,
  type DeploymentTarget
} from '@/lib/setup/runtime';

type CheckStatus = 'ok' | 'warn' | 'fail';

type SetupCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  action?: string;
};

type SetupStatusPayload = {
  generatedAt: string;
  setupCompleted: boolean;
  branding: {
    name: string;
    tagline: string;
  };
  environment: {
    adapter: string;
    deploymentTarget: 'vercel' | 'netlify' | 'custom';
    siteUrl: string | null;
    expectedAuthCallbackUrl: string | null;
    expectedInviteRedirectUrl: string | null;
    supabaseDashboardUrl: string | null;
  };
  contentRouting: {
    articleBasePath: string;
    articlePermalinkStyle: 'segment' | 'wordpress';
  };
  checks: SetupCheck[];
  requiredEnv: string[];
  optionalEnv: string[];
};

const coreRequiredTables = ['site_settings', 'authors', 'posts', 'pages'];

const probeTable = async (tableName: string): Promise<{ exists: boolean; reason?: string }> => {
  const { error } = await (supabaseAdmin as any)
    .from(tableName)
    .select('*', { head: true, count: 'exact' })
    .limit(1);

  if (!error) return { exists: true };

  const message = String(error.message || '');
  if (isMissingRelationError(message)) {
    return { exists: false, reason: 'table_missing' };
  }

  return { exists: false, reason: message || 'unknown_error' };
};

const probeExecSqlFunction = async (): Promise<{ exists: boolean; reason?: string }> => {
  const { error } = await (supabaseAdmin as any).rpc('exec_sql', { sql: 'select 1 as ok' });
  if (!error) return { exists: true };

  const message = String(error.message || '');
  if (
    message.toLowerCase().includes('could not find the function')
    || message.toLowerCase().includes('function public.exec_sql')
    || message.toLowerCase().includes('does not exist')
  ) {
    return { exists: false, reason: 'function_missing' };
  }

  return { exists: false, reason: message || 'unknown_error' };
};

const probeCoreSchemaReadiness = async (): Promise<{
  ready: boolean;
  missingTables: string[];
  tableErrors: string[];
  hasExecSql: boolean;
  execSqlReason?: string;
}> => {
  const tableResults = await Promise.all(coreRequiredTables.map(async (table) => ({
    table,
    result: await probeTable(table)
  })));

  const missingTables = tableResults
    .filter(({ result }) => !result.exists && result.reason === 'table_missing')
    .map(({ table }) => table);
  const tableErrors = tableResults
    .filter(({ result }) => !result.exists && result.reason && result.reason !== 'table_missing')
    .map(({ table, result }) => `${table}: ${result.reason}`);

  const execSqlProbe = await probeExecSqlFunction();
  const hasExecSql = execSqlProbe.exists;

  return {
    ready: missingTables.length === 0 && tableErrors.length === 0 && hasExecSql,
    missingTables,
    tableErrors,
    hasExecSql,
    execSqlReason: execSqlProbe.reason
  };
};

const buildPayload = async (request: Request): Promise<SetupStatusPayload> => {
  const checks: SetupCheck[] = [];
  const contentRouting = await getSiteContentRouting();
  let setupCompleted = false;

  const supabaseUrl = (import.meta.env.SUPABASE_URL as string | undefined) || getRuntimeEnv('SUPABASE_URL');
  const supabasePublishableKey = (import.meta.env.SUPABASE_PUBLISHABLE_KEY as string | undefined) || getRuntimeEnv('SUPABASE_PUBLISHABLE_KEY');
  const supabaseSecretKey = (import.meta.env.SUPABASE_SECRET_KEY as string | undefined) || getRuntimeEnv('SUPABASE_SECRET_KEY');
  const siteUrlFromEnv = sanitizeBaseUrl((import.meta.env.SITE_URL as string | undefined) || getRuntimeEnv('SITE_URL'));
  const siteUrlDetected = detectRequestSiteUrl(request);
  const siteUrl = siteUrlFromEnv || siteUrlDetected;

  const hasSupabaseUrl = isConfigured(supabaseUrl, 'https://placeholder.supabase.co');
  const hasSupabasePublishableKey = isConfigured(supabasePublishableKey, 'placeholder-publishable-key');
  const hasSecretKey = isConfigured(supabaseSecretKey, 'missing-secret-key');
  const hasSiteUrl = Boolean(siteUrl);
  const hasConfiguredSiteUrl = Boolean(siteUrlFromEnv);
  const deploymentTarget = detectDeploymentTarget(request);
  const configuredAdapter = normalizeDeploymentProvider(
    (import.meta.env.ASTRO_ADAPTER as string | undefined) || getRuntimeEnv('ASTRO_ADAPTER')
  );
  const adapter = configuredAdapter || (deploymentTarget === 'custom' ? 'custom' : deploymentTarget);

  let supabaseDashboardUrl: string | null = null;
  if (hasSupabaseUrl && supabaseUrl) {
    try {
      const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
      if (projectRef) {
        supabaseDashboardUrl = `https://supabase.com/dashboard/project/${projectRef}`;
      }
    } catch {
      supabaseDashboardUrl = null;
    }
  }

  checks.push({
    id: 'env.supabaseUrl',
    label: 'SUPABASE_URL configured',
    status: hasSupabaseUrl ? 'ok' : 'fail',
    detail: hasSupabaseUrl ? 'Supabase project URL is configured.' : 'Set SUPABASE_URL in environment variables.',
    action: hasSupabaseUrl ? undefined : 'Add SUPABASE_URL in your deploy/project environment.'
  });
  checks.push({
    id: 'env.supabasePublishableKey',
    label: 'SUPABASE_PUBLISHABLE_KEY configured',
    status: hasSupabasePublishableKey ? 'ok' : 'fail',
    detail: hasSupabasePublishableKey ? 'Public publishable key is configured.' : 'Set SUPABASE_PUBLISHABLE_KEY for client auth.',
    action: hasSupabasePublishableKey ? undefined : 'Add SUPABASE_PUBLISHABLE_KEY in your deploy/project environment.'
  });
  checks.push({
    id: 'env.supabaseSecretKey',
    label: 'SUPABASE_SECRET_KEY configured',
    status: hasSecretKey ? 'ok' : 'fail',
    detail: hasSecretKey ? 'Server secret key is configured.' : 'Set SUPABASE_SECRET_KEY for admin routes/migrations.',
    action: hasSecretKey ? undefined : 'Add SUPABASE_SECRET_KEY as a server-only environment variable.'
  });
  checks.push({
    id: 'env.siteUrl',
    label: 'SITE_URL / deployment URL',
    status: hasConfiguredSiteUrl ? 'ok' : hasSiteUrl ? 'warn' : 'warn',
    detail: hasConfiguredSiteUrl
      ? `SITE_URL is configured as ${siteUrl}.`
      : hasSiteUrl
        ? `SITE_URL is not set. Using detected deployment URL ${siteUrl}.`
        : 'No production URL found. Canonical URLs and auth redirects may be incorrect.',
    action: hasConfiguredSiteUrl
      ? undefined
      : 'Set SITE_URL to your production/custom domain for stable redirects and canonical URLs.'
  });

  if (hasSupabaseUrl && hasSecretKey && isSupabaseAdminConfigured) {
    const coreSchema = await probeCoreSchemaReadiness();
    const coreReadinessDetail = coreSchema.ready
      ? 'Core tables and helper functions are available.'
      : coreSchema.tableErrors.length > 0
        ? `Could not fully verify core schema: ${coreSchema.tableErrors.join('; ')}`
        : [
            coreSchema.missingTables.length > 0 ? `Missing tables: ${coreSchema.missingTables.join(', ')}` : null,
            !coreSchema.hasExecSql ? 'Missing helper function: public.exec_sql(text)' : null
          ].filter(Boolean).join('. ');

    checks.push({
      id: 'db.coreSchema',
      label: 'Core schema migrated',
      status: coreSchema.ready ? 'ok' : 'fail',
      detail: coreReadinessDetail,
      action: coreSchema.ready
        ? undefined
        : 'In Setup Wizard Step 2, copy and run the Core Schema SQL in Supabase SQL Editor.'
    });

    if (coreSchema.ready) {
      const { data: setupGateSettings, error: setupGateError } = await (supabaseAdmin as any)
        .from('site_settings')
        .select('key,value')
        .in('key', [SETUP_COMPLETION_KEY, SETUP_ALLOW_REENTRY_KEY]);

      const completionSetting = (setupGateSettings || []).find((setting: { key?: string }) => setting.key === SETUP_COMPLETION_KEY);
      const allowReentrySetting = (setupGateSettings || []).find((setting: { key?: string }) => setting.key === SETUP_ALLOW_REENTRY_KEY);
      setupCompleted = !setupGateError && normalizeBooleanSetting(completionSetting?.value);
      const setupAllowReentry = !setupGateError && normalizeBooleanSetting(allowReentrySetting?.value);

      checks.push({
        id: 'setup.completed',
        label: 'Setup completion gate',
        status: setupCompleted ? 'ok' : 'warn',
        detail: setupCompleted
          ? 'Setup gate is marked complete.'
          : 'Setup is not marked complete yet.',
        action: setupCompleted
          ? undefined
          : 'Finish steps, then mark setup complete from Step 5 in the setup wizard.'
      });

      checks.push({
        id: 'setup.allowReentry',
        label: 'Setup wizard re-entry toggle',
        status: setupCompleted && !setupAllowReentry ? 'ok' : 'warn',
        detail: !setupCompleted
          ? 'Setup not completed yet. This toggle applies after completion.'
          : setupAllowReentry
            ? 'Setup wizard remains accessible after completion.'
            : 'Setup wizard is locked after completion (recommended).',
        action: setupAllowReentry
          ? 'Disable `setup.allowReentry` in Admin → Settings to harden production access.'
          : undefined
      });

      const { data: themeSetting, error: themeError } = await (supabaseAdmin as any)
        .from('site_settings')
        .select('value')
        .eq('key', 'appearance.theme.active')
        .maybeSingle();

      checks.push({
        id: 'content.defaultTheme',
        label: 'Default theme setting',
        status: !themeError && Boolean(themeSetting?.value) ? 'ok' : 'warn',
        detail: !themeError && Boolean(themeSetting?.value)
          ? `Default theme is set to "${themeSetting.value}".`
          : 'No explicit default theme setting found yet.',
        action: !themeError && Boolean(themeSetting?.value)
          ? undefined
          : 'Set `appearance.theme.active` from Admin → Settings before launch.'
      });

      const { data: siteUrlSetting, error: siteUrlSettingError } = await (supabaseAdmin as any)
        .from('site_settings')
        .select('value')
        .eq('key', 'site.url')
        .maybeSingle();
      const configuredSiteUrl = sanitizeBaseUrl(
        typeof siteUrlSetting?.value === 'string' ? siteUrlSetting.value : undefined
      );
      const siteUrlSettingMatchesEnv = Boolean(
        hasSiteUrl
        && configuredSiteUrl
        && configuredSiteUrl === siteUrl
      );

      checks.push({
        id: 'content.siteUrlSetting',
        label: '`site.url` setting synced',
        status: !siteUrlSettingError && siteUrlSettingMatchesEnv ? 'ok' : 'warn',
        detail: !siteUrlSettingError && configuredSiteUrl
          ? `Current setting value: ${configuredSiteUrl}.`
          : 'No valid `site.url` setting found in database.',
        action: !siteUrlSettingError && siteUrlSettingMatchesEnv
          ? undefined
          : 'Set `site.url` in Admin → Settings → General to match SITE_URL (or detected deployment URL).'
      });

      const { count: publishedCount, error: publishedCountError } = await (supabaseAdmin as any)
        .from('posts')
        .select('id', { head: true, count: 'exact' })
        .eq('status', 'published');

      checks.push({
        id: 'content.initialPublishedPost',
        label: 'Published content baseline',
        status: !publishedCountError && (publishedCount || 0) > 0 ? 'ok' : 'warn',
        detail: !publishedCountError
          ? `${publishedCount || 0} published post(s) detected.`
          : 'Could not verify published posts automatically.',
        action: !publishedCountError && (publishedCount || 0) > 0
          ? undefined
          : 'Create and publish at least one post so article routes are validated.'
      });

      const requiredSystemSlugs = ['home', 'about', 'contact'];
      const { data: systemPages, error: systemPagesError } = await (supabaseAdmin as any)
        .from('pages')
        .select('slug, status')
        .in('slug', requiredSystemSlugs)
        .eq('status', 'published');
      const existingSystemSlugs = new Set((systemPages || []).map((page: { slug?: string }) => page.slug).filter(Boolean));
      const missingSystemPages = requiredSystemSlugs.filter((slug) => !existingSystemSlugs.has(slug));

      checks.push({
        id: 'content.systemPages',
        label: 'Core system pages',
        status: !systemPagesError && missingSystemPages.length === 0 ? 'ok' : 'warn',
        detail: !systemPagesError
          ? missingSystemPages.length === 0
            ? 'Home, About, and Contact pages are published.'
            : `Missing published system pages: ${missingSystemPages.join(', ')}.`
          : 'Could not verify system pages automatically.',
        action: !systemPagesError && missingSystemPages.length === 0
          ? undefined
          : 'Run Setup Step 4 automation or create Home/About/Contact pages from Admin -> Pages.'
      });
    }

    const storageBuckets = await getStorageBucketConfig({
      siteUrl,
      bypassCache: true
    });
    const requiredBuckets = [storageBuckets.media, storageBuckets.migrationUploads];
    const { data: bucketList, error: bucketError } = await supabaseAdmin.storage.listBuckets();
    if (bucketError) {
      checks.push({
        id: 'storage.buckets',
        label: 'Supabase storage buckets',
        status: 'warn',
        detail: 'Could not verify storage buckets automatically.',
        action: 'Use Setup Wizard Step 3 automated setup to create buckets. If it fails, create them manually in Supabase Storage.'
      });
    } else {
      const bucketNames = new Set((bucketList || []).map((bucket) => bucket.name));
      const missingBuckets = requiredBuckets.filter((name) => !bucketNames.has(name));
      checks.push({
        id: 'storage.buckets',
        label: 'Supabase storage buckets',
        status: missingBuckets.length === 0 ? 'ok' : 'warn',
        detail: missingBuckets.length === 0
          ? `Required buckets are present (${requiredBuckets.join(', ')}).`
          : `Missing buckets: ${missingBuckets.join(', ')}.`,
        action: missingBuckets.length === 0
          ? undefined
          : 'Use Setup Wizard Step 3 automated setup to create buckets.'
      });
    }

    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200
    });

    if (usersError) {
      checks.push({
        id: 'auth.adminUser',
        label: 'Admin account bootstrap',
        status: 'warn',
        detail: 'Could not verify admin users automatically.',
        action: 'Use Setup Wizard Step 3 automated setup with an admin email (invite optional).'
      });
    } else {
      const users = usersData?.users || [];
      const adminExists = users.some((user) => user.app_metadata?.role === 'admin');
      checks.push({
        id: 'auth.adminUser',
        label: 'Admin account bootstrap',
        status: adminExists ? 'ok' : 'warn',
        detail: adminExists
          ? 'At least one admin user exists.'
          : 'No admin role user detected yet.',
        action: adminExists
          ? undefined
          : 'Use Setup Wizard Step 3 automated setup with an admin email to assign admin role.'
      });
    }
  } else {
    checks.push({
      id: 'db.connectivity',
      label: 'Supabase connectivity checks',
      status: 'warn',
      detail: 'Skipped live Supabase checks because required admin environment variables are missing.',
      action: 'Configure SUPABASE_URL + SUPABASE_SECRET_KEY, then refresh this wizard.'
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    setupCompleted,
    branding: {
      name: 'AdAstro',
      tagline: 'The Lightspeed CMS'
    },
    environment: {
      adapter,
      deploymentTarget,
      siteUrl,
      expectedAuthCallbackUrl: siteUrl ? `${siteUrl}/auth/callback` : null,
      expectedInviteRedirectUrl: siteUrl
        ? `${siteUrl}/auth/callback?redirect=${encodeURIComponent(buildInvitePasswordSetupPath('admin'))}`
        : null,
      supabaseDashboardUrl
    },
    contentRouting: {
      articleBasePath: contentRouting.articleBasePath,
      articlePermalinkStyle: contentRouting.articlePermalinkStyle
    },
    checks,
    requiredEnv: [
      'SUPABASE_URL',
      'SUPABASE_PUBLISHABLE_KEY',
      'SUPABASE_SECRET_KEY'
    ],
    optionalEnv: [
      'SITE_URL',
      'ASTRO_ADAPTER',
      'MEDIA_STORAGE_BUCKET',
      'MIGRATION_UPLOADS_BUCKET'
    ]
  };
};

export const GET: APIRoute = async ({ request }) => {
  try {
    const payload = await buildPayload(request);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('Setup status endpoint failed:', error);
    return new Response(JSON.stringify({ error: 'Failed to build setup status.' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  }
};
