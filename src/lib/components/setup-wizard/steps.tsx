import React from 'react';
import type {
  AutomationProgressStatus,
  CheckStatus,
  DeployProvider,
  SetupAutomationPayload,
  SetupAutomationProgressAction,
  SetupCheck,
  SetupStatusPayload
} from './types';

type StatusClassMap = Record<CheckStatus, string>;
type StatusLabelMap = Record<CheckStatus, string>;
type AutomationStatusClassMap = Record<AutomationProgressStatus, string>;
type AutomationStatusLabelMap = Record<AutomationProgressStatus, string>;

type ProviderConsoleLinks = {
  dashboard: string;
  envSettings: string;
  deploys: string;
  exactEnvLink: boolean;
  hint?: string;
};

export type PlatformStepProps = {
  detectedDeployProvider: DeployProvider | null;
  deployProvider: DeployProvider;
  setDeployProvider: (value: DeployProvider) => void;
  adapterLabel: string;
  providerLinks: ProviderConsoleLinks;
  effectiveDeployProviderLabel: string;
  missingRequiredEnvChecks: SetupCheck[];
  envChecks: SetupCheck[];
  statusBadgeClasses: StatusClassMap;
  statusLabels: StatusLabelMap;
  handleCopy: (label: string, value: string) => Promise<void>;
  envTemplate: string;
  supabaseApiKeysUrl: string;
};

export function PlatformStep({
  detectedDeployProvider,
  deployProvider,
  setDeployProvider,
  adapterLabel,
  providerLinks,
  effectiveDeployProviderLabel,
  missingRequiredEnvChecks,
  envChecks,
  statusBadgeClasses,
  statusLabels,
  handleCopy,
  envTemplate,
  supabaseApiKeysUrl
}: PlatformStepProps) {
  const providerLabel = (provider: DeployProvider) => (provider === 'vercel' ? 'Vercel' : 'Netlify');

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Set required variables, redeploy once, then recheck.</p>
      <div className="flex flex-wrap gap-2">
        {detectedDeployProvider ? (
          <span className="inline-flex rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            Target detected: {providerLabel(detectedDeployProvider)}
          </span>
        ) : (
          <div className="inline-flex rounded-lg border border-border/70 bg-background/60 p-1">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${deployProvider === 'vercel' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setDeployProvider('vercel')}
            >
              Vercel
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${deployProvider === 'netlify' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setDeployProvider('netlify')}
            >
              Netlify
            </button>
          </div>
        )}
        <span className="inline-flex rounded-md border border-border/70 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
          Adapter detected: {adapterLabel}
        </span>
      </div>

      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>Open <a href={providerLinks.envSettings} target="_blank" rel="noreferrer" className="text-primary hover:underline">{effectiveDeployProviderLabel} environment settings</a>.</li>
        <li>Add <code>SUPABASE_URL</code>, <code>SUPABASE_PUBLISHABLE_KEY</code>, <code>SUPABASE_SECRET_KEY</code>.</li>
        <li>Redeploy from <a href={providerLinks.deploys} target="_blank" rel="noreferrer" className="text-primary hover:underline">{effectiveDeployProviderLabel} deploys</a>, then click <strong>Recheck Setup</strong>.</li>
      </ol>

      {!providerLinks.exactEnvLink && providerLinks.hint && (
        <p className="text-xs text-muted-foreground">{providerLinks.hint}</p>
      )}

      <div className={`rounded-lg border p-3 text-xs ${missingRequiredEnvChecks.length === 0 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-amber-500/40 bg-amber-500/10 text-amber-100'}`}>
        {missingRequiredEnvChecks.length === 0
          ? 'Required environment variables are ready.'
          : `Missing required variables: ${missingRequiredEnvChecks.map((check) => check.label.replace(' configured', '')).join(', ')}`}
      </div>

      <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
        <p className="text-xs font-medium text-foreground">Current env check results</p>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {envChecks.map((check) => (
            <li key={check.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/60 px-2 py-1.5">
              <span>{check.label}</span>
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClasses[check.status]}`}>
                {statusLabels[check.status]}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-outline h-8 px-3 text-xs"
          onClick={() => void handleCopy('required env template', envTemplate)}
        >
          Copy Required Env
        </button>
        <a
          href={providerLinks.envSettings}
          target="_blank"
          rel="noreferrer"
          className="btn btn-outline h-8 px-3 text-xs"
        >
          Open {effectiveDeployProviderLabel} Env Settings
        </a>
        <a
          href={supabaseApiKeysUrl}
          target="_blank"
          rel="noreferrer"
          className="btn btn-outline h-8 px-3 text-xs"
        >
          Open Supabase API Keys
        </a>
        <a
          href="/installation"
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary h-8 px-3 text-xs"
        >
          Open INSTALLATION.md
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        <code>SITE_URL</code> is optional but recommended. If unset, AdAstro uses the detected deployment URL.
      </p>
    </div>
  );
}

type DatabaseStepProps = {
  withSupabasePath: (path: string) => string;
  supabaseSqlEditorPath: string;
  copySqlTemplate: (template: 'core' | 'seed' | 'admin', label: string) => Promise<void>;
};

export function DatabaseStep({ withSupabasePath, supabaseSqlEditorPath, copySqlTemplate }: DatabaseStepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Run core schema SQL in Supabase SQL Editor.</p>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>Open SQL Editor in Supabase.</li>
        <li>Copy and run <strong>Core SQL</strong>.</li>
        <li>Run <strong>Automated Setup</strong> in Step 3.</li>
        <li>Optional: run <strong>Demo SQL</strong> after Core SQL.</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <a
          href={withSupabasePath(supabaseSqlEditorPath)}
          target="_blank"
          rel="noreferrer"
          className="btn btn-outline h-8 px-3 text-xs"
        >
          Open Supabase SQL Editor
        </a>
        <button type="button" className="btn btn-primary h-8 px-3 text-xs" onClick={() => void copySqlTemplate('core', 'Core schema')}>
          Copy Core SQL (Manual)
        </button>
        <button type="button" className="btn btn-outline h-8 px-3 text-xs" onClick={() => void copySqlTemplate('seed', 'Demo content')}>
          Copy Demo SQL (Optional)
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Core SQL is idempotent and safe to run on non-empty databases.</p>
    </div>
  );
}

type AuthStepProps = {
  status: SetupStatusPayload;
  withSupabasePath: (path: string) => string;
  supabaseAuthUsersPath: string;
  supabaseAuthUrlConfigPath: string;
  supabaseAuthSmtpPath: string;
  automationPrerequisites: { ready: boolean; missing: SetupCheck[] };
  adminEmail: string;
  setAdminEmail: (value: string) => void;
  adminPassword: string;
  setAdminPassword: (value: string) => void;
  adminPasswordConfirm: string;
  setAdminPasswordConfirm: (value: string) => void;
  inviteAdminIfMissing: boolean;
  setInviteAdminIfMissing: (value: boolean) => void;
  automatingSetup: boolean;
  runAutomatedSetup: () => Promise<void>;
  automationError: string | null;
  automationProgress: SetupAutomationProgressAction[];
  automationStatusBadgeClasses: AutomationStatusClassMap;
  automationStatusLabels: AutomationStatusLabelMap;
  automationResult: SetupAutomationPayload | null;
  authRedirectAllowList: string;
  handleCopy: (label: string, value: string) => Promise<void>;
  adminBootstrapCommand: string;
};

export function AuthStep({
  status,
  withSupabasePath,
  supabaseAuthUsersPath,
  supabaseAuthUrlConfigPath,
  supabaseAuthSmtpPath,
  automationPrerequisites,
  adminEmail,
  setAdminEmail,
  adminPassword,
  setAdminPassword,
  adminPasswordConfirm,
  setAdminPasswordConfirm,
  inviteAdminIfMissing,
  setInviteAdminIfMissing,
  automatingSetup,
  runAutomatedSetup,
  automationError,
  automationProgress,
  automationStatusBadgeClasses,
  automationStatusLabels,
  automationResult,
  authRedirectAllowList,
  handleCopy,
  adminBootstrapCommand
}: AuthStepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Run automation here, then finish Auth URL + email sender settings in Supabase.</p>

      <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
        <p className="text-sm font-medium text-foreground">Automated in wizard</p>
        <p className="text-xs text-muted-foreground">Sets defaults, keeps bundled features inactive, creates buckets, and bootstraps admin user access.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Admin email (optional but recommended)</span>
            <input
              type="email"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={adminEmail}
              onChange={(event) => setAdminEmail(event.target.value)}
              placeholder="you@yourdomain.com"
            />
          </label>
          <label className="flex items-center gap-2 rounded-md border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={inviteAdminIfMissing}
              onChange={(event) => setInviteAdminIfMissing(event.target.checked)}
              className="rounded border-input text-primary focus:ring-primary"
            />
            Invite admin user if it does not exist yet
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Admin password (optional, min 8 chars)</span>
            <input
              type="password"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              placeholder="Set or reset admin password"
              autoComplete="new-password"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Confirm admin password</span>
            <input
              type="password"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={adminPasswordConfirm}
              onChange={(event) => setAdminPasswordConfirm(event.target.value)}
              placeholder="Repeat password"
              autoComplete="new-password"
            />
          </label>
        </div>
        {adminPassword && (
          <p className="text-xs text-muted-foreground">
            Password is sent only to this setup request and not displayed back in logs/UI.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary h-8 px-3 text-xs"
            onClick={() => void runAutomatedSetup()}
            disabled={automatingSetup || !automationPrerequisites.ready}
          >
            {automatingSetup ? 'Running automation...' : 'Run Automated Setup'}
          </button>
          <a
            href={withSupabasePath(supabaseAuthUsersPath)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline h-8 px-3 text-xs"
          >
            Open Supabase Users
          </a>
        </div>

        {!automationPrerequisites.ready && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            <p className="font-medium">Automation prerequisites are not ready.</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {automationPrerequisites.missing.map((check) => (
                <li key={check.id}>
                  {check.label}: {check.action || check.detail}
                </li>
              ))}
            </ul>
          </div>
        )}

        {automationError && (
          <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {automationError}
          </p>
        )}

        {(automatingSetup || automationProgress.length > 0) && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">{automatingSetup ? 'Automation progress' : 'Automation confirmation'}</p>
            <div className="space-y-2">
              {automationProgress.map((action) => (
                <div key={action.id} className="rounded-md border border-border/70 bg-background/60 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">{action.label}</p>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${automationStatusBadgeClasses[action.status]}`}>
                      {automationStatusLabels[action.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{action.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {automationResult && (
          <p className="text-xs text-muted-foreground">
            Final result: {automationResult.status === 'ok' ? 'Completed' : automationResult.status === 'warn' ? 'Completed with warnings' : 'Failed'}.
          </p>
        )}
      </div>

      <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-4">
        <p className="text-sm font-medium text-foreground">Manual in Supabase (required)</p>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Set <strong>Site URL</strong> to your root domain (no <code>/auth/callback</code>).</li>
          <li>Paste the full callback + invite list into <strong>Redirect URLs</strong> (single copy action below).</li>
          <li>Configure SMTP sender/provider.</li>
          <li>Send a password reset test email.</li>
        </ol>
      </div>

      <div className="space-y-2 rounded-lg border border-border/70 bg-background/60 p-4 text-xs text-muted-foreground">
        <p><span className="font-medium text-foreground">Site URL:</span> <code>{status.environment.siteUrl || 'Not available yet'}</code></p>
        <p><span className="font-medium text-foreground">Auth callback URL:</span> <code>{status.environment.expectedAuthCallbackUrl || 'Not available yet'}</code></p>
        <p><span className="font-medium text-foreground">Invite redirect URL:</span> <code>{status.environment.expectedInviteRedirectUrl || 'Not available yet'}</code></p>
      </div>

      <p className="text-xs text-muted-foreground">If any URL shows “Not available yet”, return to Step 1, set env vars, redeploy, and recheck.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className="btn btn-outline h-8 px-3 text-xs"
          onClick={() => status.environment.siteUrl && void handleCopy('Auth Site URL', status.environment.siteUrl)}
          disabled={!status.environment.siteUrl}
        >
          Copy Site URL
        </button>
        <button
          type="button"
          className="btn btn-outline h-8 px-3 text-xs"
          onClick={() => authRedirectAllowList && void handleCopy('Redirect URLs allow-list', authRedirectAllowList)}
          disabled={!authRedirectAllowList}
        >
          Copy Full Redirect URLs List
        </button>
        <a
          href={withSupabasePath(supabaseAuthUrlConfigPath)}
          target="_blank"
          rel="noreferrer"
          className="btn btn-outline h-8 px-3 text-xs"
        >
          Open Auth URL Config
        </a>
        <a
          href={withSupabasePath(supabaseAuthSmtpPath)}
          target="_blank"
          rel="noreferrer"
          className="btn btn-outline h-8 px-3 text-xs"
        >
          Open SMTP Settings
        </a>
        <button type="button" className="btn btn-outline h-8 px-3 text-xs" onClick={() => void handleCopy('Admin bootstrap command', adminBootstrapCommand)}>
          Copy Admin Bootstrap Command
        </button>
      </div>
    </div>
  );
}

type RoutingStepProps = {
  articleBasePath: string;
  setArticleBasePath: (value: string) => void;
  normalizeBasePath: (value: string) => string;
  articlePermalinkStyle: 'segment' | 'wordpress';
  setArticlePermalinkStyle: (value: 'segment' | 'wordpress') => void;
  defaultLocale: string;
  setDefaultLocale: (value: string) => void;
  activeLocales: string[];
  setActiveLocales: (value: string[]) => void;
  availableLocales: Array<{ code: string; label: string }>;
  applyingRouting: boolean;
  applyContentRouting: () => Promise<void>;
  handleCopy: (label: string, value: string) => Promise<void>;
  contentRoutingSql: string;
  routingSaveMessage: string | null;
};

export function RoutingStep({
  articleBasePath,
  setArticleBasePath,
  normalizeBasePath,
  articlePermalinkStyle,
  setArticlePermalinkStyle,
  defaultLocale,
  setDefaultLocale,
  activeLocales,
  setActiveLocales,
  availableLocales,
  applyingRouting,
  applyContentRouting,
  handleCopy,
  contentRoutingSql,
  routingSaveMessage
}: RoutingStepProps) {
  const basePathExample = normalizeBasePath(articleBasePath || 'articles');

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose your article URL model now so imported content and future posts follow the right structure.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-foreground">
          <span className="font-medium">Articles base path</span>
          <input
            value={articleBasePath}
            onChange={(event) => setArticleBasePath(normalizeBasePath(event.target.value))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="articles"
          />
        </label>
        <label className="space-y-2 text-sm text-foreground">
          <span className="font-medium">Permalink style</span>
          <select
            value={articlePermalinkStyle}
            onChange={(event) => setArticlePermalinkStyle(event.target.value === 'wordpress' ? 'wordpress' : 'segment')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="segment">{`Segment (/${basePathExample}/post-slug/)`}</option>
            <option value="wordpress">WordPress style (`/YYYY/MM/DD/post-slug/`)</option>
          </select>
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-foreground">
          <span className="font-medium">Default locale</span>
          <select
            value={defaultLocale}
            onChange={(event) => {
              const nextDefaultLocale = event.target.value;
              setDefaultLocale(nextDefaultLocale);
              setActiveLocales(Array.from(new Set([nextDefaultLocale, ...activeLocales])));
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {availableLocales.map((locale) => (
              <option key={locale.code} value={locale.code}>{locale.label}</option>
            ))}
          </select>
        </label>
        <div className="space-y-2 text-sm text-foreground">
          <span className="font-medium">Active public locales</span>
          <div className="rounded-md border border-input bg-background p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {availableLocales.map((locale) => {
                const checked = activeLocales.includes(locale.code);
                return (
                  <label key={locale.code} className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setActiveLocales(Array.from(new Set([...activeLocales, locale.code])));
                          return;
                        }
                        if (locale.code === defaultLocale) return;
                        setActiveLocales(activeLocales.filter((value) => value !== locale.code));
                      }}
                    />
                    <span>{locale.label}</span>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Activating a locale during setup also provisions editable system pages for that locale.
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-primary h-8 px-3 text-xs"
          onClick={() => void applyContentRouting()}
          disabled={applyingRouting}
        >
          {applyingRouting ? 'Saving...' : 'Save URL Settings'}
        </button>
        <button type="button" className="btn btn-outline h-8 px-3 text-xs" onClick={() => void handleCopy('content routing sql', contentRoutingSql)}>
          Copy SQL Fallback
        </button>
      </div>
      {routingSaveMessage && <p className="text-xs text-muted-foreground">{routingSaveMessage}</p>}
      <pre className="overflow-x-auto rounded-md border border-border/70 bg-background/80 p-3 text-xs text-foreground/90">
        <code>{contentRoutingSql}</code>
      </pre>
    </div>
  );
}

type SuccessStepProps = {
  logoSrc?: string;
};

export function SuccessStep({ logoSrc = '/logo.svg' }: SuccessStepProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
        <div className="relative mx-auto mb-4 flex h-40 w-40 items-center justify-center rounded-full border border-emerald-400/40 bg-background/80 sm:h-48 sm:w-48">
          <span className="absolute inset-3 rounded-full border border-cyan-300/30 animate-[spin_14s_linear_infinite]" />
          <span className="absolute inset-6 rounded-full border border-amber-300/25 animate-[spin_10s_linear_infinite_reverse]" />
          <img
            src={logoSrc}
            alt="AdAstro logo"
            className="relative h-24 w-24 animate-pulse sm:h-28 sm:w-28"
          />
        </div>
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-200">Setup Complete</p>
        <h3 className="mt-2 text-2xl font-semibold text-foreground">Warp Drive Online.</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          AdAstro is live and ready. Core pages are installed, admin access is configured, and you are clear for launch.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <a href="/" className="btn btn-outline h-10 px-4 text-sm">
          Go To Home
        </a>
        <a href="/admin" className="btn btn-primary h-10 px-4 text-sm">
          Go To Admin
        </a>
      </div>
    </div>
  );
}

type VerificationStepProps = {
  status: SetupStatusPayload;
  summary: { total: number; ok: number; blocking: number; warnings: number };
  completingSetup: boolean;
  completeSetupMessage: string | null;
  markSetupComplete: () => Promise<void>;
  nextActionCheck: SetupCheck | null;
  showAllVerificationChecks: boolean;
  setShowAllVerificationChecks: (updater: (current: boolean) => boolean) => void;
  verificationChecks: SetupCheck[];
  statusBadgeClasses: StatusClassMap;
  statusLabels: StatusLabelMap;
};

export function VerificationStep({
  status,
  summary,
  completingSetup,
  completeSetupMessage,
  markSetupComplete,
  nextActionCheck,
  showAllVerificationChecks,
  setShowAllVerificationChecks,
  verificationChecks,
  statusBadgeClasses,
  statusLabels
}: VerificationStepProps) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Final launch pass. Resolve blocking issues, then mark setup complete.
      </p>

      <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
        <p className="text-sm font-medium text-foreground">Setup gate status</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {status.setupCompleted
            ? 'Setup is marked complete. Setup redirect gate is disabled.'
            : 'Setup is not complete yet. Non-setup routes will continue redirecting to /setup.'}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-primary h-8 px-3 text-xs"
            onClick={() => void markSetupComplete()}
            disabled={status.setupCompleted || completingSetup || summary.blocking > 0}
          >
            {status.setupCompleted ? 'Setup Complete' : completingSetup ? 'Finalizing...' : 'Mark Setup Complete'}
          </button>
          {!status.setupCompleted && summary.blocking > 0 && (
            <span className="text-xs text-amber-200">Resolve blocking checks before finalizing.</span>
          )}
        </div>
        {completeSetupMessage && (
          <p className="mt-2 text-xs text-muted-foreground">{completeSetupMessage}</p>
        )}
      </div>

      {nextActionCheck && (
        <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
          <p className="text-sm font-medium text-foreground">Next recommended action</p>
          <p className="mt-2 text-sm text-muted-foreground"><span className="font-medium text-foreground">{nextActionCheck.label}:</span> {nextActionCheck.detail}</p>
          {nextActionCheck.action && <p className="mt-1 text-sm text-primary">{nextActionCheck.action}</p>}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">
            {showAllVerificationChecks ? 'All checks' : 'Checks needing attention'}
          </p>
          <button
            type="button"
            className="btn btn-outline h-8 px-3 text-xs"
            onClick={() => setShowAllVerificationChecks((current) => !current)}
          >
            {showAllVerificationChecks ? 'Show Only Issues' : 'Show All Checks'}
          </button>
        </div>
        {verificationChecks.map((check) => (
          <div key={check.id} className="rounded-lg border border-border/70 bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{check.label}</p>
              <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${statusBadgeClasses[check.status]}`}>
                {statusLabels[check.status]}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{check.detail}</p>
            {check.action && <p className="mt-1 text-xs text-primary/90">{check.action}</p>}
          </div>
        ))}
        {!showAllVerificationChecks && verificationChecks.length === 0 && (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
            No blocking issues or warnings remain.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
        <p className="text-sm font-medium text-foreground">Launch smoke test</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Open <code>/auth/login</code> and verify sign-in succeeds.</li>
          <li>Open <code>/admin/settings</code> and save one setting.</li>
          <li>Publish a test post and verify the article URL model.</li>
          <li>Enable each feature from <code>/admin/features</code> and test activation/deactivation.</li>
        </ul>
      </div>
    </div>
  );
}
