import React, { useEffect, useMemo, useState } from 'react';
import { DEFAULT_ARTICLE_ROUTING, normalizeArticleBasePath } from '@/lib/routing/articles';
import { DEFAULT_LOCALE } from '@/lib/i18n/locales';
import {
  AuthStep,
  DatabaseStep,
  PlatformStep,
  RoutingStep,
  SuccessStep,
  VerificationStep
} from './setup-wizard/steps';
import type {
  AutomationProgressStatus,
  CheckStatus,
  DeployProvider,
  SetupAutomationPayload,
  SetupAutomationProgressAction,
  SetupCheck,
  SetupSqlTemplate,
  SetupStatusPayload,
  WizardStep
} from './setup-wizard/types';

const statusBadgeClasses: Record<CheckStatus, string> = {
  ok: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  warn: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  fail: 'bg-rose-500/15 text-rose-300 border-rose-500/30'
};

const statusLabels: Record<CheckStatus, string> = {
  ok: 'Ready',
  warn: 'Needs Attention',
  fail: 'Blocking'
};

const automationStatusBadgeClasses: Record<AutomationProgressStatus, string> = {
  ok: statusBadgeClasses.ok,
  warn: statusBadgeClasses.warn,
  fail: statusBadgeClasses.fail,
  pending: 'bg-sky-500/15 text-sky-200 border-sky-500/30'
};

const automationStatusLabels: Record<AutomationProgressStatus, string> = {
  ok: 'Done',
  warn: 'Needs Attention',
  fail: 'Failed',
  pending: 'Running'
};

const supabaseDashboardFallback = 'https://supabase.com/dashboard';
const supabaseAuthUsersPath = '/auth/users';
const supabaseAuthUrlConfigPath = '/auth/url-configuration';
const supabaseAuthSmtpPath = '/auth/providers';
const supabaseSqlEditorPath = '/sql/new';
const supabaseApiKeysPath = '/settings/api';

const providerLabel = (provider: DeployProvider) => (provider === 'vercel' ? 'Vercel' : 'Netlify');

const providerFromAdapterValue = (value: string | undefined | null): DeployProvider | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('netlify')) return 'netlify';
  if (normalized.includes('vercel')) return 'vercel';
  return null;
};

const providerFromSiteUrl = (value: string | undefined | null): DeployProvider | null => {
  if (!value) return null;
  try {
    const host = new URL(value).hostname.toLowerCase();
    if (host.includes('.netlify.app')) return 'netlify';
    if (host.includes('.vercel.app')) return 'vercel';
  } catch {
    return null;
  }
  return null;
};

const providerFromCurrentHost = (): DeployProvider | null => {
  if (typeof window === 'undefined') return null;
  const rawHost = window.location?.hostname;
  if (!rawHost) return null;
  const host = rawHost.toLowerCase();
  if (host.includes('.netlify.app')) return 'netlify';
  if (host.includes('.vercel.app')) return 'vercel';
  if (host.includes('netlify')) return 'netlify';
  if (host.includes('vercel')) return 'vercel';
  return null;
};

const resolveDetectedProvider = (payload: SetupStatusPayload | null): DeployProvider | null => {
  if (!payload) return null;
  if (payload.environment.deploymentTarget === 'vercel' || payload.environment.deploymentTarget === 'netlify') {
    return payload.environment.deploymentTarget;
  }
  return providerFromAdapterValue(payload.environment.adapter)
    || providerFromSiteUrl(payload.environment.siteUrl)
    || null;
};

const hostFromUrl = (value: string | null | undefined): string | null => {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
};

type ProviderConsoleLinks = {
  dashboard: string;
  envSettings: string;
  deploys: string;
  exactEnvLink: boolean;
  hint?: string;
};

const getProviderConsoleLinks = (provider: DeployProvider, siteUrl: string | null): ProviderConsoleLinks => {
  const host = hostFromUrl(siteUrl);

  if (provider === 'netlify') {
    if (host?.endsWith('.netlify.app')) {
      const siteSlug = host.slice(0, -'.netlify.app'.length);
      return {
        dashboard: `https://app.netlify.com/sites/${siteSlug}/overview`,
        envSettings: `https://app.netlify.com/sites/${siteSlug}/configuration/env`,
        deploys: `https://app.netlify.com/sites/${siteSlug}/deploys`,
        exactEnvLink: true
      };
    }
    return {
      dashboard: 'https://app.netlify.com/',
      envSettings: 'https://app.netlify.com/',
      deploys: 'https://app.netlify.com/',
      exactEnvLink: false,
      hint: 'Open your site, then Site configuration -> Environment variables.'
    };
  }

  const projectHint = host?.endsWith('.vercel.app') ? host.slice(0, -'.vercel.app'.length) : null;
  return {
    dashboard: 'https://vercel.com/dashboard',
    envSettings: 'https://vercel.com/dashboard',
    deploys: 'https://vercel.com/dashboard',
    exactEnvLink: false,
    hint: projectHint
      ? `Open project "${projectHint}" -> Settings -> Environment Variables.`
      : 'Open your project -> Settings -> Environment Variables.'
  };
};

const defaultAutomationProgress: SetupAutomationProgressAction[] = [
  {
    id: 'settings.defaults',
    label: 'Default settings',
    status: 'pending',
    detail: 'Initialize core settings and ensure bundled features stay inactive by default.'
  },
  {
    id: 'system.pages',
    label: 'System pages',
    status: 'pending',
    detail: 'Create editable Home, Articles, About, and Contact pages when missing.'
  },
  {
    id: 'storage.config',
    label: 'Storage configuration',
    status: 'pending',
    detail: 'Resolve and persist instance-specific bucket names.'
  },
  {
    id: 'storage.buckets',
    label: 'Storage buckets',
    status: 'pending',
    detail: 'Create missing buckets and verify availability.'
  },
  {
    id: 'auth.admin',
    label: 'Admin bootstrap',
    status: 'pending',
    detail: 'Assign admin role and optionally set/reset password for the provided email.'
  }
];

const copyToClipboard = async (value: string) => {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    throw new Error('Clipboard API unavailable');
  }
  await navigator.clipboard.writeText(value);
};

const normalizeBasePath = (value: string) => {
  const normalized = normalizeArticleBasePath(value);
  return normalized || DEFAULT_ARTICLE_ROUTING.basePath;
};

export default function SetupWizard() {
  const [status, setStatus] = useState<SetupStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deployProvider, setDeployProvider] = useState<DeployProvider>('vercel');
  const [runtimeHostProvider, setRuntimeHostProvider] = useState<DeployProvider | null>(null);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const [articleBasePath, setArticleBasePath] = useState(DEFAULT_ARTICLE_ROUTING.basePath);
  const [articlePermalinkStyle, setArticlePermalinkStyle] = useState<'segment' | 'wordpress'>('segment');
  const [defaultLocale, setDefaultLocale] = useState(DEFAULT_LOCALE);
  const [activeLocales, setActiveLocales] = useState<string[]>([DEFAULT_LOCALE]);
  const [applyingRouting, setApplyingRouting] = useState(false);
  const [routingSaveMessage, setRoutingSaveMessage] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [sqlTemplates, setSqlTemplates] = useState<Partial<Record<SetupSqlTemplate, string>>>({});
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [inviteAdminIfMissing, setInviteAdminIfMissing] = useState(true);
  const [automatingSetup, setAutomatingSetup] = useState(false);
  const [automationResult, setAutomationResult] = useState<SetupAutomationPayload | null>(null);
  const [automationProgress, setAutomationProgress] = useState<SetupAutomationProgressAction[]>([]);
  const [automationError, setAutomationError] = useState<string | null>(null);
  const [completingSetup, setCompletingSetup] = useState(false);
  const [completeSetupMessage, setCompleteSetupMessage] = useState<string | null>(null);
  const [showAllVerificationChecks, setShowAllVerificationChecks] = useState(false);

  const runAutomaticRecheck = async () => {
    await loadStatus();
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        void loadStatus();
      }, 1800);
    }
  };

  useEffect(() => {
    setRuntimeHostProvider(providerFromCurrentHost());
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/setup/status');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to load setup status');
      }
      setStatus(payload as SetupStatusPayload);
      const resolvedProvider = resolveDetectedProvider(payload as SetupStatusPayload) || providerFromCurrentHost();
      if (resolvedProvider) {
        setDeployProvider(resolvedProvider);
      }
      const routing = (payload as SetupStatusPayload).contentRouting;
      const localeConfig = (payload as SetupStatusPayload).contentLocales;
      if (routing) {
        setArticleBasePath(normalizeBasePath(routing.articleBasePath || DEFAULT_ARTICLE_ROUTING.basePath));
        setArticlePermalinkStyle(routing.articlePermalinkStyle === 'wordpress' ? 'wordpress' : 'segment');
      }
      if (localeConfig) {
        const nextDefaultLocale = localeConfig.defaultLocale || DEFAULT_LOCALE;
        const nextActiveLocales = Array.from(new Set([nextDefaultLocale, ...(localeConfig.activeLocales || [])]));
        setDefaultLocale(nextDefaultLocale);
        setActiveLocales(nextActiveLocales);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load setup status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const detectedDeployProvider = useMemo<DeployProvider | null>(
    () => resolveDetectedProvider(status) || runtimeHostProvider,
    [runtimeHostProvider, status]
  );

  const effectiveDeployProvider = detectedDeployProvider ?? deployProvider;
  const effectiveDeployProviderLabel = providerLabel(effectiveDeployProvider);

  const adapterLabel = useMemo(() => {
    if (detectedDeployProvider) return providerLabel(detectedDeployProvider);
    const value = (status?.environment.adapter || '').trim().toLowerCase();
    if (value === 'vercel' || value === 'netlify') {
      return providerLabel(value);
    }
    return value ? value.toUpperCase() : 'Custom';
  }, [detectedDeployProvider, status?.environment.adapter]);

  const withSupabasePath = (path: string) => {
    const base = status?.environment.supabaseDashboardUrl || supabaseDashboardFallback;
    return `${base}${path}`;
  };

  const providerLinks = useMemo(
    () => getProviderConsoleLinks(effectiveDeployProvider, status?.environment.siteUrl || null),
    [effectiveDeployProvider, status?.environment.siteUrl]
  );

  const summary = useMemo(() => {
    if (!status) return { total: 0, ok: 0, blocking: 0, warnings: 0 };
    const total = status.checks.length;
    const ok = status.checks.filter((check) => check.status === 'ok').length;
    const blocking = status.checks.filter((check) => check.status === 'fail').length;
    const warnings = status.checks.filter((check) => check.status === 'warn').length;
    return { total, ok, blocking, warnings };
  }, [status]);

  const nextActionCheck = useMemo(() => {
    if (!status) return null;
    return status.checks.find((check) => check.status === 'fail')
      || status.checks.find((check) => check.status === 'warn')
      || null;
  }, [status]);

  const envChecks = useMemo(() => {
    if (!status) return [] as SetupCheck[];
    return status.checks.filter((check) => check.id.startsWith('env.'));
  }, [status]);

  const missingRequiredEnvChecks = useMemo(
    () => envChecks.filter((check) => check.id !== 'env.siteUrl' && check.status !== 'ok'),
    [envChecks]
  );

  const verificationChecks = useMemo(() => {
    if (!status) return [] as SetupCheck[];
    const notReady = status.checks.filter((check) => check.status !== 'ok');
    if (showAllVerificationChecks || notReady.length === 0) {
      return status.checks;
    }
    return notReady;
  }, [showAllVerificationChecks, status]);

  const automationPrerequisites = useMemo(() => {
    if (!status) return { ready: false, missing: [] as SetupCheck[] };
    const requiredIds = ['env.supabaseUrl', 'env.supabasePublishableKey', 'env.supabaseSecretKey', 'db.coreSchema'];
    const missing = requiredIds
      .map((id) => status.checks.find((check) => check.id === id))
      .filter((check): check is SetupCheck => Boolean(check && check.status !== 'ok'));
    return {
      ready: missing.length === 0,
      missing
    };
  }, [status]);

  const steps = useMemo<WizardStep[]>(() => [
    {
      id: 'platform',
      title: 'Environment + Docs',
      description: `Set env vars in ${effectiveDeployProviderLabel}, then redeploy.`
    },
    {
      id: 'database',
      title: 'Supabase Database',
      description: 'Run Core SQL in Supabase SQL Editor.'
    },
    {
      id: 'auth',
      title: 'Auth + Email Sender',
      description: 'Run automation, then configure Auth URLs + SMTP.'
    },
    {
      id: 'routing',
      title: 'Content URLs',
      description: 'Choose article URL model and save.'
    },
    {
      id: 'verify',
      title: 'Verification',
      description: 'Resolve issues and mark setup complete.'
    },
    ...(status?.setupCompleted
      ? [{
          id: 'success',
          title: 'Launch Complete',
          description: 'Everything is ready. Open your site and admin.'
        }]
      : [])
  ], [effectiveDeployProviderLabel, status?.setupCompleted]);

  const safeStepIndex = Math.min(currentStepIndex, Math.max(steps.length - 1, 0));
  const currentStep = steps[safeStepIndex];

  const envTemplate = useMemo(() => {
    if (!status) return '';
    const required = status.requiredEnv.map((key) => `${key}=`);
    return ['# Required', ...required].join('\n');
  }, [status]);

  const authRedirectAllowList = useMemo(() => {
    if (!status) return '';
    return [
      status.environment.expectedAuthCallbackUrl,
      status.environment.expectedInviteRedirectUrl
    ].filter((value): value is string => Boolean(value)).join('\n');
  }, [status]);

  const stepStatusById = useMemo<Record<string, CheckStatus>>(() => {
    if (!status) return {};

    const checkMap = new Map(status.checks.map((check) => [check.id, check.status] as const));
    const envRequiredChecks = ['env.supabaseUrl', 'env.supabasePublishableKey', 'env.supabaseSecretKey'];
    const hasBlockingEnv = envRequiredChecks.some((id) => checkMap.get(id) === 'fail');
    const hasPendingEnv = envRequiredChecks.some((id) => checkMap.get(id) !== 'ok');

    const platformStatus: CheckStatus = hasBlockingEnv
      ? 'fail'
      : hasPendingEnv || checkMap.get('env.siteUrl') === 'warn'
        ? 'warn'
        : 'ok';

    const dbStatus = checkMap.get('db.coreSchema') || 'warn';
    const authChecks = ['storage.buckets', 'auth.adminUser', 'content.siteUrlSetting'];
    const authStatuses = authChecks.map((id) => checkMap.get(id) || 'warn');
    const authStatus: CheckStatus = hasBlockingEnv || dbStatus === 'fail'
      ? 'fail'
      : authStatuses.some((state) => state === 'fail')
        ? 'fail'
        : authStatuses.every((state) => state === 'ok')
          ? 'ok'
          : 'warn';

    const routingStatus: CheckStatus = articleBasePath && articlePermalinkStyle ? 'ok' : 'warn';
    const verifyStatus: CheckStatus = summary.blocking > 0
      ? 'fail'
      : status.setupCompleted
        ? 'ok'
        : 'warn';
    const successStatus: CheckStatus = status.setupCompleted ? 'ok' : 'warn';

    return {
      platform: platformStatus,
      database: dbStatus,
      auth: authStatus,
      routing: routingStatus,
      verify: verifyStatus,
      success: successStatus
    };
  }, [articleBasePath, articlePermalinkStyle, status, summary.blocking]);

  const completedSteps = useMemo(
    () => steps.filter((step) => stepStatusById[step.id] === 'ok').length,
    [stepStatusById, steps]
  );

  const contentRoutingSql = useMemo(() => {
    const basePath = normalizeBasePath(articleBasePath);
    const permalinkStyle = articlePermalinkStyle === 'wordpress' ? 'wordpress' : 'segment';
    const normalizedActiveLocales = Array.from(new Set([defaultLocale, ...activeLocales]));
    return [
      "insert into site_settings (key, value, category, description)",
      `values ('content.articleBasePath', '${basePath}', 'content', 'Base path used for article routes')`,
      "on conflict (key) do update set value = excluded.value, category = excluded.category, description = excluded.description, updated_at = now();",
      '',
      "insert into site_settings (key, value, category, description)",
      `values ('content.articlePermalinkStyle', '${permalinkStyle}', 'content', 'Permalink style for article URLs')`,
      "on conflict (key) do update set value = excluded.value, category = excluded.category, description = excluded.description, updated_at = now();",
      '',
      "insert into site_settings (key, value, category, description)",
      `values ('content.defaultLocale', '\"${defaultLocale}\"'::jsonb, 'content', 'Default locale for localized routes')`,
      "on conflict (key) do update set value = excluded.value, category = excluded.category, description = excluded.description, updated_at = now();",
      '',
      "insert into site_settings (key, value, category, description)",
      `values ('content.locales', '${JSON.stringify(normalizedActiveLocales)}'::jsonb, 'content', 'Activated public locales')`,
      "on conflict (key) do update set value = excluded.value, category = excluded.category, description = excluded.description, updated_at = now();",
      '',
      '-- Optional: keep nav links aligned with the selected base path',
      'update site_settings',
      "set value = replace(value::text, '/" + DEFAULT_ARTICLE_ROUTING.basePath + "', '/" + basePath + "')::jsonb, updated_at = now()",
      "where key in ('navigation.topLinks', 'navigation.bottomLinks')",
      "  and jsonb_typeof(value) = 'array';"
    ].join('\n');
  }, [activeLocales, articleBasePath, articlePermalinkStyle, defaultLocale]);

  const adminBootstrapCommand = useMemo(() => {
    const email = adminEmail.trim() || 'admin@example.com';
    return `npm run admin:bootstrap -- --email ${email} --password 'UseAStrongPassword123!'`;
  }, [adminEmail]);

  const handleCopy = async (label: string, value: string) => {
    try {
      await copyToClipboard(value);
      setCopiedLabel(label);
      window.setTimeout(() => setCopiedLabel((current) => (current === label ? null : current)), 2000);
    } catch {
      setCopiedLabel(`Copy failed: ${label}`);
      window.setTimeout(() => setCopiedLabel(null), 2500);
    }
  };

  const copySqlTemplate = async (template: SetupSqlTemplate, label: string) => {
    try {
      let sql = sqlTemplates[template];
      if (!sql) {
        const response = await fetch(`/api/setup/sql?template=${template}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.sql) {
          throw new Error(payload?.error || `Could not load ${label} SQL.`);
        }
        sql = String(payload.sql);
        setSqlTemplates((current) => ({ ...current, [template]: sql as string }));
      }
      await handleCopy(`${label} SQL`, sql);
    } catch (copyError) {
      const message = copyError instanceof Error ? copyError.message : `Could not copy ${label} SQL.`;
      setCopiedLabel(message);
      window.setTimeout(() => setCopiedLabel(null), 3000);
    }
  };

  const moveStep = (direction: 1 | -1) => {
    setCurrentStepIndex((current) => {
      const next = current + direction;
      if (next < 0) return 0;
      if (next >= steps.length) return steps.length - 1;
      return next;
    });
  };

  const applyContentRouting = async () => {
    const basePath = normalizeBasePath(articleBasePath);
    const permalinkStyle = articlePermalinkStyle === 'wordpress' ? 'wordpress' : 'segment';

    try {
      setApplyingRouting(true);
      setRoutingSaveMessage(null);
      const response = await fetch('/api/setup/routing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleBasePath: basePath,
          articlePermalinkStyle: permalinkStyle,
          defaultLocale,
          activeLocales
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to update content routing from setup wizard.');
      }
      setRoutingSaveMessage('Routing settings saved. Use Recheck Setup to confirm all checks.');
      await loadStatus();
    } catch (saveError) {
      const text = saveError instanceof Error
        ? saveError.message
        : 'Could not save routing settings. Use SQL fallback below.';
      setRoutingSaveMessage(text);
    } finally {
      setApplyingRouting(false);
    }
  };

  const runAutomatedSetup = async () => {
    if (!status) return;
    if (!automationPrerequisites.ready) {
      setAutomationError('Automation is blocked until environment variables and core schema checks are ready.');
      return;
    }
    if (adminPassword && !adminEmail.trim()) {
      setAutomationError('Enter an admin email before setting an admin password.');
      return;
    }
    if (adminPassword && adminPassword.length < 8) {
      setAutomationError('Admin password must contain at least 8 characters.');
      return;
    }
    if (adminPassword && adminPassword !== adminPasswordConfirm) {
      setAutomationError('Admin password confirmation does not match.');
      return;
    }

    try {
      setAutomatingSetup(true);
      setAutomationError(null);
      setAutomationResult(null);
      setAutomationProgress(defaultAutomationProgress);

      const payload = {
        siteUrl: status.environment.siteUrl || undefined,
        articleBasePath: normalizeBasePath(articleBasePath),
        articlePermalinkStyle,
        defaultLocale,
        activeLocales,
        adminEmail: adminEmail.trim() || undefined,
        adminPassword: adminPassword || undefined,
        inviteAdminIfMissing,
        forceFeatureDefaultsDisabled: true
      };

      const response = await fetch('/api/setup/automate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || 'Setup automation failed.');
      }

      setAutomationResult(json as SetupAutomationPayload);
      const apiActions = (json as SetupAutomationPayload).actions || [];
      const mergedById = new Map<string, SetupAutomationProgressAction>();

      defaultAutomationProgress.forEach((action) => {
        mergedById.set(action.id, action);
      });
      apiActions.forEach((action) => {
        mergedById.set(action.id, {
          id: action.id,
          label: action.label,
          status: action.status,
          detail: action.detail
        });
      });
      const finalizedActions = [...mergedById.values()].map((action) => {
        if (action.status !== 'pending') return action;
        if (action.id === 'auth.admin' && !adminEmail.trim()) {
          return {
            ...action,
            status: 'warn' as const,
            detail: 'Skipped because no admin email was provided.'
          };
        }
        return {
          ...action,
          status: 'warn' as const,
          detail: 'No confirmation returned by API. Recheck setup status.'
        };
      });
      setAutomationProgress(finalizedActions);
      await runAutomaticRecheck();
    } catch (setupError) {
      setAutomationError(setupError instanceof Error ? setupError.message : 'Setup automation failed.');
      setAutomationProgress((current) => current.map((action) => (
        action.status === 'pending'
          ? { ...action, status: 'warn', detail: 'Not completed because automation stopped early.' }
          : action
      )));
    } finally {
      setAutomatingSetup(false);
    }
  };

  const availableLocaleOptions = useMemo(() => {
    const locales = status?.contentLocales?.availableLocales || [DEFAULT_LOCALE];
    return locales.map((locale) => {
      try {
        const label = new Intl.DisplayNames([locale], { type: 'language' }).of(locale) || locale;
        return { code: locale, label };
      } catch {
        return { code: locale, label: locale };
      }
    });
  }, [status?.contentLocales?.availableLocales]);

  const markSetupComplete = async () => {
    try {
      setCompletingSetup(true);
      setCompleteSetupMessage(null);
      const response = await fetch('/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Could not mark setup complete.');
      }
      setCompleteSetupMessage('Setup marked complete. Redirecting to the app routes is now enabled.');
      await loadStatus();
      setCurrentStepIndex(Number.MAX_SAFE_INTEGER);
    } catch (completionError) {
      const message = completionError instanceof Error
        ? completionError.message
        : 'Could not mark setup complete.';
      setCompleteSetupMessage(message);
    } finally {
      setCompletingSetup(false);
    }
  };

  const renderCurrentStep = () => {
    if (!status) return null;

    switch (currentStep.id) {
      case 'platform':
        return (
          <PlatformStep
            detectedDeployProvider={detectedDeployProvider}
            deployProvider={deployProvider}
            setDeployProvider={setDeployProvider}
            adapterLabel={adapterLabel}
            providerLinks={providerLinks}
            effectiveDeployProviderLabel={effectiveDeployProviderLabel}
            missingRequiredEnvChecks={missingRequiredEnvChecks}
            envChecks={envChecks}
            statusBadgeClasses={statusBadgeClasses}
            statusLabels={statusLabels}
            handleCopy={handleCopy}
            envTemplate={envTemplate}
            supabaseApiKeysUrl={withSupabasePath(supabaseApiKeysPath)}
          />
        );
      case 'database':
        return (
          <DatabaseStep
            withSupabasePath={withSupabasePath}
            supabaseSqlEditorPath={supabaseSqlEditorPath}
            copySqlTemplate={copySqlTemplate}
          />
        );
      case 'auth':
        return (
          <AuthStep
            status={status}
            withSupabasePath={withSupabasePath}
            supabaseAuthUsersPath={supabaseAuthUsersPath}
            supabaseAuthUrlConfigPath={supabaseAuthUrlConfigPath}
            supabaseAuthSmtpPath={supabaseAuthSmtpPath}
            automationPrerequisites={automationPrerequisites}
            adminEmail={adminEmail}
            setAdminEmail={setAdminEmail}
            adminPassword={adminPassword}
            setAdminPassword={setAdminPassword}
            adminPasswordConfirm={adminPasswordConfirm}
            setAdminPasswordConfirm={setAdminPasswordConfirm}
            inviteAdminIfMissing={inviteAdminIfMissing}
            setInviteAdminIfMissing={setInviteAdminIfMissing}
            automatingSetup={automatingSetup}
            runAutomatedSetup={runAutomatedSetup}
            automationError={automationError}
            automationProgress={automationProgress}
            automationStatusBadgeClasses={automationStatusBadgeClasses}
            automationStatusLabels={automationStatusLabels}
            automationResult={automationResult}
            authRedirectAllowList={authRedirectAllowList}
            handleCopy={handleCopy}
            adminBootstrapCommand={adminBootstrapCommand}
          />
        );
      case 'routing':
        return (
          <RoutingStep
            articleBasePath={articleBasePath}
            setArticleBasePath={setArticleBasePath}
            normalizeBasePath={normalizeBasePath}
            articlePermalinkStyle={articlePermalinkStyle}
            setArticlePermalinkStyle={setArticlePermalinkStyle}
            defaultLocale={defaultLocale}
            setDefaultLocale={setDefaultLocale}
            activeLocales={activeLocales}
            setActiveLocales={setActiveLocales}
            availableLocales={availableLocaleOptions}
            applyingRouting={applyingRouting}
            applyContentRouting={applyContentRouting}
            handleCopy={handleCopy}
            contentRoutingSql={contentRoutingSql}
            routingSaveMessage={routingSaveMessage}
          />
        );
      case 'success':
        return <SuccessStep />;
      case 'verify':
      default:
        return (
          <VerificationStep
            status={status}
            summary={summary}
            completingSetup={completingSetup}
            completeSetupMessage={completeSetupMessage}
            markSetupComplete={markSetupComplete}
            nextActionCheck={nextActionCheck}
            showAllVerificationChecks={showAllVerificationChecks}
            setShowAllVerificationChecks={setShowAllVerificationChecks}
            verificationChecks={verificationChecks}
            statusBadgeClasses={statusBadgeClasses}
            statusLabels={statusLabels}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden border-border/70 p-0">
        <div className="brand-gradient h-2 w-full" />
        <div className="space-y-4 p-6 sm:p-8">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/80">Setup Wizard</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              AdAstro - The Lightspeed CMS
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
              Guided setup for Supabase + {effectiveDeployProviderLabel}. Follow each step in order and launch.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary h-9 px-4 text-sm" onClick={() => void loadStatus()} disabled={loading}>
              {loading ? 'Checking...' : 'Recheck Setup'}
            </button>
            {copiedLabel && (
              <span className="rounded-md border border-border/70 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
                {copiedLabel}
              </span>
            )}
          </div>
        </div>
      </section>

      {error && (
        <section className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </section>
      )}

      {status && (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="order-2 card h-fit space-y-4 p-4 lg:order-1 lg:sticky lg:top-24">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Progress</p>
              <p className="mt-1 text-sm font-medium text-foreground">{completedSteps}/{steps.length} steps complete</p>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${Math.round((completedSteps / steps.length) * 100)}%` }}
              />
            </div>

            <nav className="space-y-2" aria-label="Setup steps">
              {steps.map((step, index) => {
                const isActive = index === safeStepIndex;
                const stepStatus = stepStatusById[step.id] || 'warn';
                return (
                  <div
                    key={step.id}
                    className={`rounded-lg border p-3 ${isActive ? 'border-primary/40 bg-primary/5' : 'border-border/70 bg-muted/20'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        className="min-w-0 text-left"
                        onClick={() => setCurrentStepIndex(index)}
                      >
                        <p className="text-xs text-muted-foreground">Step {index + 1}</p>
                        <p className="text-sm font-medium text-foreground">{step.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
                      </button>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClasses[stepStatus]}`}>
                        {statusLabels[stepStatus]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </nav>

            <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
              <p><span className="font-medium text-foreground">Checks:</span> {summary.ok}/{summary.total} ready</p>
              <p><span className="font-medium text-foreground">Blocking:</span> {summary.blocking}</p>
              <p><span className="font-medium text-foreground">Warnings:</span> {summary.warnings}</p>
            </div>
          </aside>

          <section className="order-1 card space-y-5 p-6 lg:order-2">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Step {safeStepIndex + 1} of {steps.length}</p>
              <h2 className="text-xl font-semibold text-foreground">{currentStep.title}</h2>
              <p className="text-sm text-muted-foreground">{currentStep.description}</p>
              <p className="text-xs text-muted-foreground">
                Step status is automatic and based on live checks from this environment.
              </p>
            </div>

            {renderCurrentStep()}

            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-background/95 pt-4 backdrop-blur">
              <button
                type="button"
                className="btn btn-outline h-9 px-4 text-sm"
                onClick={() => moveStep(-1)}
                disabled={safeStepIndex === 0}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary h-9 px-4 text-sm"
                onClick={() => moveStep(1)}
                disabled={safeStepIndex === steps.length - 1}
              >
                Next
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
