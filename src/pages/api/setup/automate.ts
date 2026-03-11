import type { APIRoute } from 'astro';
import { isSupabaseAdminConfigured, supabaseAdmin } from '@/lib/supabase';
import { SettingsService } from '@/lib/services/settings-service';
import { getSiteContentRouting, resetAllSiteConfigCaches } from '@/lib/site-config';
import {
  detectRequestSiteUrl,
  getRuntimeEnv,
  hasRequiredSetupEnv,
  isMissingRelationError as isMissingTableError,
  sanitizeBaseUrl as sanitizeSiteUrl
} from '@/lib/setup/runtime';
import { buildInvitePasswordSetupPath } from '@/lib/auth/access-policy';
import {
  getStorageBucketConfig,
  type StorageBucketConfig,
  upsertStorageBucketConfig
} from '@/lib/storage/buckets';
import { DEFAULT_ARTICLE_ROUTING, normalizeArticleBasePath } from '@/lib/routing/articles';
import { ensureLocalizedSystemPages } from '@/lib/services/system-pages';
import { getCoreLocalePacks } from '@/lib/i18n/catalog';
import { DEFAULT_LOCALE, ensureDefaultLocaleInList, normalizeLocaleCode, normalizeLocaleList } from '@/lib/i18n/locales';

type AutomationActionStatus = 'ok' | 'warn' | 'fail';

type AutomationAction = {
  id: string;
  label: string;
  status: AutomationActionStatus;
  detail: string;
};

type SetupAutomationRequest = {
  adminEmail?: string;
  adminPassword?: string;
  inviteAdminIfMissing?: boolean;
  siteUrl?: string;
  articleBasePath?: string;
  articlePermalinkStyle?: 'segment' | 'wordpress';
  defaultLocale?: string;
  activeLocales?: string[];
  forceFeatureDefaultsDisabled?: boolean;
};

type NavLinkSetting = {
  type?: 'page' | 'custom';
  pageSlug?: string;
  label: string;
  href: string;
  labelByLocale?: Record<string, string>;
  hrefByLocale?: Record<string, string>;
};

const requiredBucketBlueprint: Array<{
  key: keyof StorageBucketConfig;
  public: boolean;
  allowedMimeTypes?: string[];
}> = [
  {
    key: 'media',
    public: true,
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/svg+xml',
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/ogg'
    ]
  },
  {
    key: 'migrationUploads',
    public: false,
    allowedMimeTypes: ['text/xml', 'application/xml', 'application/octet-stream']
  }
];
const coreRequiredTables = ['site_settings', 'authors', 'posts', 'pages'];

const slugify = (value: string): string => (
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
);

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isStrongEnoughPassword = (value: string) => value.length >= 8;
const defaultArticlesHref = `/${DEFAULT_ARTICLE_ROUTING.basePath}`;
const DEFAULT_TOP_AND_BOTTOM_MENU: NavLinkSetting[] = [
  { type: 'page', pageSlug: 'home', label: 'Home', href: '/' },
  { type: 'page', pageSlug: DEFAULT_ARTICLE_ROUTING.basePath, label: 'Articles', href: defaultArticlesHref },
  { type: 'page', pageSlug: 'about', label: 'About', href: '/about' },
  { type: 'page', pageSlug: 'contact', label: 'Contact', href: '/contact' }
];

const normalizePageSlug = (value: string): string | null => {
  const normalized = value.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
  if (!normalized) return 'home';
  if (!/^[a-z0-9-]+$/.test(normalized)) return null;
  return normalized;
};

const pageSlugToHref = (slug: string): string => (slug === 'home' ? '/' : `/${slug}`);

const normalizeLocalizedStringMap = (value: unknown): Record<string, string> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([locale, rawValue]) => {
      const normalizedLocale = locale.trim().toLowerCase();
      const normalizedValue = typeof rawValue === 'string' ? rawValue.trim() : '';
      if (!/^[a-z]{2}(?:-[a-z]{2})?$/.test(normalizedLocale) || !normalizedValue) return null;
      return [normalizedLocale, normalizedValue] as const;
    })
    .filter((entry): entry is readonly [string, string] => Boolean(entry));

  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries);
};

const normalizeNavLinks = (value: unknown): NavLinkSetting[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as {
        type?: unknown;
        pageSlug?: unknown;
        label?: unknown;
        href?: unknown;
        labelByLocale?: unknown;
        hrefByLocale?: unknown;
      };
      const type = record.type === 'page' ? 'page' : 'custom';
      const pageSlug = typeof record.pageSlug === 'string' ? normalizePageSlug(record.pageSlug) : null;
      const label = typeof record.label === 'string' ? record.label.trim() : '';
      const href = typeof record.href === 'string' ? record.href.trim() : '';
      const labelByLocale = normalizeLocalizedStringMap(record.labelByLocale);
      const hrefByLocale = normalizeLocalizedStringMap(record.hrefByLocale);

      if (type === 'page' || pageSlug) {
        const resolvedSlug = pageSlug ?? normalizePageSlug(href);
        if (!resolvedSlug) return null;
        return {
          type: 'page',
          pageSlug: resolvedSlug,
          label,
          href: pageSlugToHref(resolvedSlug),
          ...(labelByLocale ? { labelByLocale } : {}),
          ...(hrefByLocale ? { hrefByLocale } : {})
        };
      }

      const hasLocalizedHref = Boolean(hrefByLocale && Object.keys(hrefByLocale).length > 0);
      if (!label || (!href && !hasLocalizedHref)) return null;
      return {
        type: 'custom',
        label,
        href,
        ...(labelByLocale ? { labelByLocale } : {}),
        ...(hrefByLocale ? { hrefByLocale } : {})
      };
    })
    .filter((entry): entry is NavLinkSetting => Boolean(entry));
};

const ensureRequiredNavLinks = (links: NavLinkSetting[], articleBasePath: string): NavLinkSetting[] => {
  const articlesSlug = articleBasePath;
  const articlesHref = pageSlugToHref(articlesSlug);
  const requiredLinks = DEFAULT_TOP_AND_BOTTOM_MENU.map((link) => (
    link.pageSlug === DEFAULT_ARTICLE_ROUTING.basePath
      ? { ...link, pageSlug: articlesSlug, href: articlesHref }
      : link
  ));
  const byTarget = new Map(links.map((link) => [link.pageSlug || link.href, link]));

  for (const required of requiredLinks) {
    const key = required.pageSlug || required.href;
    if (!byTarget.has(key)) {
      links.push(required);
      byTarget.set(key, required);
    }
  }

  return links;
};

const probeCoreSchema = async (): Promise<{
  exists: boolean;
  missingTables: string[];
  hasExecSql: boolean;
}> => {
  const tableResults = await Promise.all(coreRequiredTables.map(async (table) => {
    const { error } = await (supabaseAdmin as any)
      .from(table)
      .select('*', { head: true, count: 'exact' })
      .limit(1);

    if (!error) {
      return { table, exists: true };
    }

    const message = String(error.message || '');
    if (isMissingTableError(message)) {
      return { table, exists: false };
    }

    throw new Error(`Could not verify core table ${table}: ${message}`);
  }));

  const missingTables = tableResults.filter((entry) => !entry.exists).map((entry) => entry.table);
  const { error: execSqlError } = await (supabaseAdmin as any).rpc('exec_sql', { sql: 'select 1 as ok' });
  const hasExecSql = !execSqlError;

  return {
    exists: missingTables.length === 0 && hasExecSql,
    missingTables,
    hasExecSql
  };
};

const ensureBuckets = async (bucketConfig: StorageBucketConfig): Promise<AutomationAction> => {
  const { data: existingBuckets, error: listError } = await supabaseAdmin.storage.listBuckets();
  if (listError) {
    return {
      id: 'storage.buckets',
      label: 'Storage buckets',
      status: 'warn',
      detail: `Could not list buckets automatically: ${listError.message}`
    };
  }

  const existing = new Set((existingBuckets || []).map((bucket) => bucket.id || bucket.name));
  const created: string[] = [];
  const failed: string[] = [];

  for (const blueprint of requiredBucketBlueprint) {
    const bucketName = bucketConfig[blueprint.key];
    if (existing.has(bucketName)) continue;

    const { error } = await supabaseAdmin.storage.createBucket(bucketName, {
      public: blueprint.public,
      allowedMimeTypes: blueprint.allowedMimeTypes
    });

    if (error) {
      failed.push(`${bucketName} (${error.message})`);
      continue;
    }
    created.push(bucketName);
  }

  if (failed.length > 0) {
    return {
      id: 'storage.buckets',
      label: 'Storage buckets',
      status: 'warn',
      detail: created.length > 0
        ? `Created: ${created.join(', ')}. Failed: ${failed.join('; ')}`
        : `Could not create required buckets: ${failed.join('; ')}`
    };
  }

  return {
    id: 'storage.buckets',
    label: 'Storage buckets',
    status: 'ok',
    detail: created.length > 0
      ? `Created missing buckets: ${created.join(', ')}.`
      : `Required buckets already exist (${bucketConfig.media}, ${bucketConfig.migrationUploads}).`
  };
};

const findAuthUserByEmail = async (email: string) => {
  let page = 1;
  const perPage = 200;

  while (page <= 20) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Could not list auth users: ${error.message}`);

    const users = data?.users || [];
    const match = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;

    if (users.length < perPage) break;
    page += 1;
  }

  return null;
};

const resolveUniqueAuthorSlug = async (baseSlug: string, email: string): Promise<string> => {
  let candidate = baseSlug || 'admin';
  let attempt = 2;

  while (attempt <= 50) {
    const { data, error } = await (supabaseAdmin as any)
      .from('authors')
      .select('slug,email')
      .eq('slug', candidate)
      .maybeSingle();

    if (error && !isMissingTableError(String(error.message || ''))) {
      throw new Error(`Could not validate author slug: ${error.message}`);
    }

    if (!data || data.email?.toLowerCase() === email.toLowerCase()) {
      return candidate;
    }

    candidate = `${baseSlug}-${attempt}`;
    attempt += 1;
  }

  return `${baseSlug}-${Date.now().toString().slice(-6)}`;
};

const ensureAuthorProfile = async (user: any): Promise<void> => {
  const email = String(user.email || '').trim().toLowerCase();
  if (!email) return;

  const displayNameRaw = String(user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0] || 'Admin');
  const displayName = displayNameRaw.slice(0, 120);
  const baseSlug = slugify(displayName) || slugify(email.split('@')[0] || '') || 'admin';

  const { data: existing, error: existingError } = await (supabaseAdmin as any)
    .from('authors')
    .select('id,slug,email,auth_user_id,name')
    .eq('email', email)
    .maybeSingle();

  if (existingError && !isMissingTableError(String(existingError.message || ''))) {
    throw new Error(`Could not load author profile: ${existingError.message}`);
  }

  if (existing) {
    const updates: Record<string, any> = {
      auth_user_id: user.id,
      updated_at: new Date().toISOString()
    };
    if (!existing.name) updates.name = displayName;
    if (!existing.slug) {
      updates.slug = await resolveUniqueAuthorSlug(baseSlug, email);
    }

    const { error } = await (supabaseAdmin as any)
      .from('authors')
      .update(updates)
      .eq('id', existing.id);
    if (error) throw new Error(`Could not update author profile: ${error.message}`);
    return;
  }

  const slug = await resolveUniqueAuthorSlug(baseSlug, email);
  const { error: insertError } = await (supabaseAdmin as any)
    .from('authors')
    .insert({
      name: displayName,
      email,
      slug,
      auth_user_id: user.id
    });

  if (insertError) {
    throw new Error(`Could not create author profile: ${insertError.message}`);
  }
};

const bootstrapAdminUser = async (
  request: SetupAutomationRequest,
  resolvedSiteUrl: string | null
): Promise<AutomationAction | null> => {
  const rawEmail = (request.adminEmail || '').trim().toLowerCase();
  const rawPassword = request.adminPassword || '';
  const hasPassword = rawPassword.length > 0;
  if (!rawEmail) return null;

  if (!isValidEmail(rawEmail)) {
    return {
      id: 'auth.admin',
      label: 'Admin bootstrap',
      status: 'warn',
      detail: 'Admin email is not valid. Enter a full email address and retry.'
    };
  }
  if (hasPassword && !isStrongEnoughPassword(rawPassword)) {
    return {
      id: 'auth.admin',
      label: 'Admin bootstrap',
      status: 'warn',
      detail: 'Admin password is too short. Use at least 8 characters.'
    };
  }

  let user = await findAuthUserByEmail(rawEmail);
  let createdWithPassword = false;

  if (!user && hasPassword) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: rawEmail,
      password: rawPassword,
      email_confirm: true,
      app_metadata: { role: 'admin' }
    });

    if (error) {
      return {
        id: 'auth.admin',
        label: 'Admin bootstrap',
        status: 'warn',
        detail: `Could not create ${rawEmail} with password: ${error.message}`
      };
    }

    user = data?.user || await findAuthUserByEmail(rawEmail);
    createdWithPassword = true;
  }

  if (!user && request.inviteAdminIfMissing) {
    const redirectTo = resolvedSiteUrl
      ? `${resolvedSiteUrl}/auth/callback?redirect=${encodeURIComponent(buildInvitePasswordSetupPath('admin'))}`
      : undefined;
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(rawEmail, {
      redirectTo
    });

    if (error) {
      return {
        id: 'auth.admin',
        label: 'Admin bootstrap',
        status: 'warn',
        detail: `Could not invite ${rawEmail}: ${error.message}`
      };
    }

    user = data?.user || await findAuthUserByEmail(rawEmail);
    if (!user) {
      return {
        id: 'auth.admin',
        label: 'Admin bootstrap',
        status: 'warn',
        detail: `Invite sent to ${rawEmail}. Accept the invite, then run automation again to apply admin role.`
      };
    }
  }

  if (!user) {
    return {
      id: 'auth.admin',
      label: 'Admin bootstrap',
      status: 'warn',
      detail: `No auth user found for ${rawEmail}. Create/invite the user in Supabase Auth, then rerun this step.`
    };
  }

  const appMetadata = {
    ...(user.app_metadata || {}),
    role: 'admin'
  };
  const updatePayload: Record<string, unknown> = {
    app_metadata: appMetadata
  };
  if (hasPassword) {
    updatePayload.password = rawPassword;
    updatePayload.email_confirm = true;
  }

  const { error: roleError } = await supabaseAdmin.auth.admin.updateUserById(user.id, updatePayload);
  if (roleError) {
    return {
      id: 'auth.admin',
      label: 'Admin bootstrap',
      status: 'warn',
      detail: `Could not assign admin role for ${rawEmail}: ${roleError.message}`
    };
  }

  try {
    await ensureAuthorProfile({ ...user, app_metadata: appMetadata });
  } catch (error) {
    return {
      id: 'auth.admin',
      label: 'Admin bootstrap',
      status: 'warn',
      detail: error instanceof Error
        ? `Admin role assigned, but author sync needs review: ${error.message}`
        : 'Admin role assigned, but author sync needs review.'
    };
  }

  return {
    id: 'auth.admin',
    label: 'Admin bootstrap',
    status: 'ok',
    detail: hasPassword
      ? `${createdWithPassword ? 'Created user, set password,' : 'Updated password and'} admin role confirmed for ${rawEmail}, and author profile is linked.`
      : `Admin role confirmed for ${rawEmail}, and author profile is linked.`
  };
};

const applySettingsDefaults = async (
  request: SetupAutomationRequest,
  resolvedSiteUrl: string | null
): Promise<AutomationAction> => {
  const settingsService = new SettingsService();
  await settingsService.initializeDefaultSettings();
  const availableCoreLocales = Object.keys(getCoreLocalePacks());
  const effectiveArticleBasePath = typeof request.articleBasePath === 'string' && request.articleBasePath.trim()
    ? normalizeArticleBasePath(request.articleBasePath)
    : normalizeArticleBasePath(undefined);
  const requestedDefaultLocale = normalizeLocaleCode(request.defaultLocale, DEFAULT_LOCALE);
  const normalizedDefaultLocale = availableCoreLocales.includes(requestedDefaultLocale)
    ? requestedDefaultLocale
    : DEFAULT_LOCALE;
  const normalizedActiveLocales = ensureDefaultLocaleInList(
    normalizedDefaultLocale,
    normalizeLocaleList(request.activeLocales, normalizedDefaultLocale)
  ).filter((locale) => availableCoreLocales.includes(locale));

  const updates: Record<string, unknown> = {};
  if (resolvedSiteUrl) {
    updates['site.url'] = resolvedSiteUrl;
  }

  updates['content.articleBasePath'] = effectiveArticleBasePath;
  updates['content.defaultLocale'] = normalizedDefaultLocale;
  updates['content.locales'] = normalizedActiveLocales;
  if (request.articlePermalinkStyle === 'segment' || request.articlePermalinkStyle === 'wordpress') {
    updates['content.articlePermalinkStyle'] = request.articlePermalinkStyle;
  }

  if (request.forceFeatureDefaultsDisabled !== false) {
    updates['features.ai.enabled'] = false;
    updates['features.comments.enabled'] = false;
    updates['features.newsletter.enabled'] = false;
  }

  const navSettings = await settingsService.getSettings([
    'navigation.topLinks',
    'navigation.bottomLinks'
  ]);
  const topLinks = normalizeNavLinks(navSettings['navigation.topLinks']);
  const bottomLinks = normalizeNavLinks(navSettings['navigation.bottomLinks']);
  updates['navigation.topLinks'] = ensureRequiredNavLinks(topLinks, effectiveArticleBasePath);
  updates['navigation.bottomLinks'] = ensureRequiredNavLinks(bottomLinks, effectiveArticleBasePath);

  if (Object.keys(updates).length > 0) {
    await settingsService.updateSettings(updates);
  }

  return {
    id: 'settings.defaults',
    label: 'Default settings',
    status: 'ok',
    detail: 'Default settings are initialized and core feature toggles are set to inactive.'
  };
};

const ensureSystemPages = async (
  articleBasePath: string,
  locales: string[],
  defaultLocale: string
): Promise<AutomationAction> => {
  try {
    const targetLocales = ensureDefaultLocaleInList(defaultLocale, locales);
    const createdSlugsByLocale: string[] = [];
    for (const locale of targetLocales) {
      const result = await ensureLocalizedSystemPages({
        articleBasePath,
        targetLocale: locale,
        sourceLocale: defaultLocale,
        fallbackSourceLocale: DEFAULT_LOCALE
      });
      if (result.createdSlugs.length > 0) {
        createdSlugsByLocale.push(`${locale}: ${result.createdSlugs.join(', ')}`);
      }
    }

    return {
      id: 'system.pages',
      label: 'System pages',
      status: 'ok',
      detail: createdSlugsByLocale.length > 0
        ? `Created editable system pages for locales: ${createdSlugsByLocale.join(' | ')}.`
        : `Editable system pages already exist for locales ${targetLocales.map((locale) => locale.toUpperCase()).join(', ')}.`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    return {
      id: 'system.pages',
      label: 'System pages',
      status: 'warn',
      detail: `Could not create system pages: ${message}`
    };
  }
};

const configureStorageBuckets = async (resolvedSiteUrl: string | null): Promise<StorageBucketConfig> => {
  const bucketConfig = await getStorageBucketConfig({
    siteUrl: resolvedSiteUrl,
    bypassCache: true
  });
  await upsertStorageBucketConfig(bucketConfig);
  return bucketConfig;
};

export const POST: APIRoute = async ({ request }) => {
  if (!isSupabaseAdminConfigured) {
    return new Response(JSON.stringify({
      error: 'SUPABASE_SECRET_KEY is required for setup automation.'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  }

  if (!hasRequiredSetupEnv()) {
    return new Response(JSON.stringify({
      error: 'Required Supabase environment is incomplete. Configure env vars, redeploy, then rerun setup automation.'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  }

  let payload: SetupAutomationRequest = {};
  try {
    payload = await request.json() as SetupAutomationRequest;
  } catch {
    payload = {};
  }

  try {
    const resolvedSiteUrl = sanitizeSiteUrl(payload.siteUrl)
      || sanitizeSiteUrl((import.meta.env.SITE_URL as string | undefined) || getRuntimeEnv('SITE_URL'))
      || detectRequestSiteUrl(request);

    const coreSchema = await probeCoreSchema();
    if (!coreSchema.exists) {
      const missingParts = [
        coreSchema.missingTables.length > 0 ? `missing tables: ${coreSchema.missingTables.join(', ')}` : null,
        !coreSchema.hasExecSql ? 'missing helper function: public.exec_sql(text)' : null
      ].filter(Boolean).join('; ');
      return new Response(JSON.stringify({
        error: `Core schema is not initialized yet (${missingParts || 'unknown issue'}). Run the Core SQL step first.`
      }), {
        status: 409,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      });
    }

    const actions: AutomationAction[] = [];
    actions.push(await applySettingsDefaults(payload, resolvedSiteUrl));
    resetAllSiteConfigCaches();
    const contentRouting = await getSiteContentRouting();
    const availableCoreLocales = Object.keys(getCoreLocalePacks());
    const defaultLocale = normalizeLocaleCode(payload.defaultLocale, DEFAULT_LOCALE);
    const normalizedDefaultLocale = availableCoreLocales.includes(defaultLocale) ? defaultLocale : DEFAULT_LOCALE;
    const activeLocales = ensureDefaultLocaleInList(
      normalizedDefaultLocale,
      normalizeLocaleList(payload.activeLocales, normalizedDefaultLocale)
    ).filter((locale) => availableCoreLocales.includes(locale));
    actions.push(await ensureSystemPages(
      normalizeArticleBasePath(contentRouting.articleBasePath),
      activeLocales,
      normalizedDefaultLocale
    ));

    const bucketConfig = await configureStorageBuckets(resolvedSiteUrl);
    actions.push({
      id: 'storage.config',
      label: 'Storage configuration',
      status: 'ok',
      detail: `Using media bucket "${bucketConfig.media}" and migration bucket "${bucketConfig.migrationUploads}".`
    });
    actions.push(await ensureBuckets(bucketConfig));

    const adminAction = await bootstrapAdminUser(payload, resolvedSiteUrl);
    if (adminAction) {
      actions.push(adminAction);
    }
    resetAllSiteConfigCaches();

    const hasFail = actions.some((action) => action.status === 'fail');
    const hasWarn = actions.some((action) => action.status === 'warn');

    return new Response(JSON.stringify({
      ok: !hasFail,
      status: hasFail ? 'fail' : hasWarn ? 'warn' : 'ok',
      actions
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('Setup automation API error:', error);
    return new Response(JSON.stringify({ error: 'Setup automation failed.' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  }
};
