import React from 'react';
import { AdminLoadingState } from '@/lib/components/admin/ListingPrimitives';
import {
  ANALYTICS_RETENTION_SETTING_KEY,
  DEFAULT_ANALYTICS_RETENTION_SETTINGS_STATE,
  parseAnalyticsRetentionSettings,
  serializeAnalyticsRetentionSettings,
  type AnalyticsRetentionSettingsState
} from '@/lib/analytics/retention';
import {
  DEFAULT_EXTERNAL_ANALYTICS_SETTINGS_STATE,
  EXTERNAL_ANALYTICS_DOCS,
  EXTERNAL_ANALYTICS_SETTING_KEY,
  parseExternalAnalyticsSettings,
  serializeExternalAnalyticsSettings,
  type ExternalAnalyticsSettingsState
} from '@/lib/analytics/external-providers';

const PANEL_SETTING_KEYS = [EXTERNAL_ANALYTICS_SETTING_KEY, ANALYTICS_RETENTION_SETTING_KEY] as const;

const textInputClassName =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60';
const textAreaClassName =
  'w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60';
const checkboxClassName =
  'h-4 w-4 rounded border-input text-primary focus:ring-primary disabled:cursor-not-allowed';

const numberFmt = new Intl.NumberFormat();
const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
});

type RetentionSummary = {
  settings: AnalyticsRetentionSettingsState;
  totalRows: number;
  prunableRows: number;
  oldestEventAt: string | null;
  newestEventAt: string | null;
  pruneBefore: string;
  overWarnThreshold: boolean;
};

type PanelSettingsState = {
  providers: ExternalAnalyticsSettingsState;
  retention: AnalyticsRetentionSettingsState;
};

type RetentionAction = 'export' | 'prune' | null;

const DEFAULT_PANEL_SETTINGS_STATE: PanelSettingsState = {
  providers: DEFAULT_EXTERNAL_ANALYTICS_SETTINGS_STATE,
  retention: DEFAULT_ANALYTICS_RETENTION_SETTINGS_STATE
};

const requestJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as { error?: string }).error || `Request failed: ${response.status}`);
  }
  return payload as T;
};

const validateProviderSettings = (settings: ExternalAnalyticsSettingsState): string | null => {
  if (settings.googleTag.enabled && settings.googleTag.tagId.trim().length === 0) {
    return 'Google tag needs a tag ID before it can be enabled.';
  }

  if (settings.plausible.enabled && settings.plausible.snippetHtml.trim().length === 0) {
    return 'Plausible needs the official snippet HTML pasted into the settings form.';
  }

  if (settings.umami.enabled) {
    if (settings.umami.scriptUrl.trim().length === 0) {
      return 'Umami needs a script URL before it can be enabled.';
    }
    if (settings.umami.websiteId.trim().length === 0) {
      return 'Umami needs a website ID before it can be enabled.';
    }
  }

  if (settings.fathom.enabled && settings.fathom.siteId.trim().length === 0) {
    return 'Fathom needs a site ID before it can be enabled.';
  }

  return null;
};

const parsePanelSettings = (payload: Record<string, unknown>): PanelSettingsState => ({
  providers: parseExternalAnalyticsSettings(payload[EXTERNAL_ANALYTICS_SETTING_KEY]),
  retention: parseAnalyticsRetentionSettings(payload[ANALYTICS_RETENTION_SETTING_KEY])
});

const serializePanelSettings = (settings: PanelSettingsState) => ({
  ...serializeExternalAnalyticsSettings(settings.providers),
  ...serializeAnalyticsRetentionSettings(settings.retention)
});

const deepEqual = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const formatTimestamp = (value: string | null) => {
  if (!value) return 'No data yet';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateTimeFmt.format(parsed);
};

const parseFilename = (contentDisposition: string | null, fallback: string) => {
  if (!contentDisposition) return fallback;
  const match = contentDisposition.match(/filename="([^"]+)"/i);
  return match?.[1] || fallback;
};

const triggerFileDownload = (blob: Blob, filename: string) => {
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(objectUrl);
};

export default function AnalyticsProviderSettings() {
  const [settings, setSettings] = React.useState<PanelSettingsState>(DEFAULT_PANEL_SETTINGS_STATE);
  const [loadedSettings, setLoadedSettings] = React.useState<PanelSettingsState | null>(null);
  const [retentionSummary, setRetentionSummary] = React.useState<RetentionSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [retentionAction, setRetentionAction] = React.useState<RetentionAction>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [archiveReadyForPrune, setArchiveReadyForPrune] = React.useState(false);
  const successTimeoutRef = React.useRef<number | null>(null);

  const hasLoadedSettings = loadedSettings !== null;
  const hasChanges = hasLoadedSettings && !deepEqual(settings, loadedSettings);
  const hasRetentionChanges = hasLoadedSettings && !deepEqual(settings.retention, loadedSettings.retention);
  const controlsDisabled = loading || saving || !hasLoadedSettings;
  const retentionActionsDisabled = controlsDisabled || retentionAction !== null || hasRetentionChanges;
  const requiresArchiveBeforePrune =
    settings.retention.archiveBeforePrune && (retentionSummary?.prunableRows ?? 0) > 0;
  const canPrune =
    !retentionActionsDisabled &&
    (retentionSummary?.prunableRows ?? 0) > 0 &&
    (!requiresArchiveBeforePrune || archiveReadyForPrune);

  const pushSuccess = React.useCallback((message: string) => {
    setSuccess(message);
    if (typeof window === 'undefined') return;
    if (successTimeoutRef.current !== null) {
      window.clearTimeout(successTimeoutRef.current);
    }
    successTimeoutRef.current = window.setTimeout(() => {
      setSuccess(null);
      successTimeoutRef.current = null;
    }, 2500);
  }, []);

  const loadPanel = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [settingsPayload, summaryPayload] = await Promise.all([
        requestJson<Record<string, unknown>>(
          `/api/admin/settings?keys=${encodeURIComponent(PANEL_SETTING_KEYS.join(','))}`
        ),
        requestJson<RetentionSummary>('/api/admin/analytics/retention')
      ]);

      const nextSettings = parsePanelSettings(settingsPayload);
      setSettings(nextSettings);
      setLoadedSettings(nextSettings);
      setRetentionSummary(summaryPayload);
      setArchiveReadyForPrune(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load analytics settings.');
      throw loadError;
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadPanel().catch(() => undefined);
  }, [loadPanel]);

  React.useEffect(() => () => {
    if (typeof window !== 'undefined' && successTimeoutRef.current !== null) {
      window.clearTimeout(successTimeoutRef.current);
    }
  }, []);

  const updateProvider = <K extends keyof ExternalAnalyticsSettingsState>(
    provider: K,
    patch: Partial<ExternalAnalyticsSettingsState[K]>
  ) => {
    setSettings((current) => ({
      ...current,
      providers: {
        ...current.providers,
        [provider]: {
          ...current.providers[provider],
          ...patch
        }
      }
    }));
  };

  const updateRetention = (patch: Partial<AnalyticsRetentionSettingsState>) => {
    setArchiveReadyForPrune(false);
    setSettings((current) => ({
      ...current,
      retention: {
        ...current.retention,
        ...patch
      }
    }));
  };

  const saveSettings = async () => {
    if (!hasLoadedSettings || !hasChanges) return;

    const validationError = validateProviderSettings(settings.providers);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await requestJson('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: serializePanelSettings(settings)
        })
      });

      await loadPanel();
      pushSuccess('Analytics settings saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save analytics settings.');
    } finally {
      setSaving(false);
    }
  };

  const downloadArchive = async () => {
    if (!retentionSummary || retentionActionsDisabled) return;

    try {
      setRetentionAction('export');
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/admin/analytics/retention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export' })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error((payload as { error?: string }).error || 'Failed to export analytics archive.');
      }

      const blob = await response.blob();
      const truncated = response.headers.get('X-Analytics-Archive-Truncated') === '1';
      const filename = parseFilename(
        response.headers.get('Content-Disposition'),
        `analytics-archive-before-${retentionSummary.pruneBefore.slice(0, 10)}.json`
      );

      triggerFileDownload(blob, filename);
      setArchiveReadyForPrune(true);
      pushSuccess(
        truncated
          ? 'Analytics archive downloaded. Export was capped at 100,000 rows; use the CLI archive job for larger datasets.'
          : 'Analytics archive downloaded. Old analytics rows can now be pruned.'
      );
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Failed to export analytics archive.');
    } finally {
      setRetentionAction(null);
    }
  };

  const pruneAnalytics = async () => {
    if (!retentionSummary || !canPrune) {
      if (requiresArchiveBeforePrune && !archiveReadyForPrune) {
        setError('Download an archive before pruning analytics data.');
      }
      return;
    }

    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(
          `Delete ${numberFmt.format(retentionSummary.prunableRows)} analytics rows created before ${formatTimestamp(
            retentionSummary.pruneBefore
          )}?`
        );

    if (!confirmed) {
      return;
    }

    try {
      setRetentionAction('prune');
      setError(null);
      setSuccess(null);

      const payload = await requestJson<{ prunedRows: number }>('/api/admin/analytics/retention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'prune',
          archiveAcknowledged: archiveReadyForPrune
        })
      });

      await loadPanel();
      pushSuccess(`Pruned ${numberFmt.format(payload.prunedRows)} archived analytics rows.`);
    } catch (pruneError) {
      setError(pruneError instanceof Error ? pruneError.message : 'Failed to prune analytics data.');
    } finally {
      setRetentionAction(null);
    }
  };

  if (!hasLoadedSettings && loading) {
    return <AdminLoadingState label="Loading analytics settings..." className="p-8" />;
  }

  if (!hasLoadedSettings) {
    return (
      <div className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => void loadPanel().catch(() => undefined)}
            disabled={loading}
          >
            {loading ? 'Reloading…' : 'Reload'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          {success}
        </div>
      )}

      <section className="card p-4 space-y-2">
        <h3 className="text-base font-semibold">External Analytics Providers</h3>
        <p className="text-sm text-muted-foreground">
          These scripts are injected into the public site head only. Admin, auth, setup, profile, MCP, and API routes stay excluded.
        </p>
        <p className="text-xs text-muted-foreground">
          Use the official install instructions for each provider. Plausible now issues site-specific snippets, so its latest setup is pasted verbatim instead of rebuilt here.
        </p>
      </section>

      <ProviderCard
        title="Google tag / GA4"
        enabled={settings.providers.googleTag.enabled}
        onToggle={(enabled) => updateProvider('googleTag', { enabled })}
        description="Uses the current gtag.js installation method with your Google tag ID."
        docsHref={EXTERNAL_ANALYTICS_DOCS.googleTag}
        disabled={controlsDisabled}
      >
        <TextField
          label="Google tag ID"
          value={settings.providers.googleTag.tagId}
          placeholder="G-XXXXXXXXXX"
          onChange={(value) => updateProvider('googleTag', { tagId: value })}
          helpText="Use the Google tag ID from your property or tag setup. The script is generated automatically."
          disabled={controlsDisabled}
        />
      </ProviderCard>

      <ProviderCard
        title="Plausible"
        enabled={settings.providers.plausible.enabled}
        onToggle={(enabled) => updateProvider('plausible', { enabled })}
        description="Paste the official snippet exactly as Plausible gives it to you."
        docsHref={EXTERNAL_ANALYTICS_DOCS.plausible}
        disabled={controlsDisabled}
      >
        <TextAreaField
          label="Official snippet HTML"
          value={settings.providers.plausible.snippetHtml}
          placeholder={'<script defer data-domain="example.com" src="https://plausible.io/js/pa-XXXXX.js"></script>'}
          onChange={(value) => updateProvider('plausible', { snippetHtml: value })}
          helpText="Plausible moved to unique per-site snippets. Paste the snippet from Site installation or Review installation in your Plausible dashboard."
          disabled={controlsDisabled}
        />
      </ProviderCard>

      <ProviderCard
        title="Umami"
        enabled={settings.providers.umami.enabled}
        onToggle={(enabled) => updateProvider('umami', { enabled })}
        description="Supports Umami Cloud or self-hosted tracker installs."
        docsHref={EXTERNAL_ANALYTICS_DOCS.umami}
        disabled={controlsDisabled}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <TextField
            label="Script URL"
            value={settings.providers.umami.scriptUrl}
            placeholder="https://cloud.umami.is/script.js"
            onChange={(value) => updateProvider('umami', { scriptUrl: value })}
            helpText="Use your cloud or proxied script URL."
            disabled={controlsDisabled}
          />
          <TextField
            label="Website ID"
            value={settings.providers.umami.websiteId}
            placeholder="94db1cb1-74f4-4a40-ad6c-962362670409"
            onChange={(value) => updateProvider('umami', { websiteId: value })}
            helpText="The website ID from your Umami tracking code."
            disabled={controlsDisabled}
          />
          <TextField
            label="Host URL"
            value={settings.providers.umami.hostUrl}
            placeholder="https://cloud.umami.is"
            onChange={(value) => updateProvider('umami', { hostUrl: value })}
            helpText="Optional. Set when your script uses a custom collection host."
            disabled={controlsDisabled}
          />
          <TextField
            label="Allowed domains"
            value={settings.providers.umami.domains}
            placeholder="example.com,www.example.com"
            onChange={(value) => updateProvider('umami', { domains: value })}
            helpText="Optional comma-separated domain list for multi-domain or proxied installs."
            disabled={controlsDisabled}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleField
            label="Respect Do Not Track"
            checked={settings.providers.umami.doNotTrack}
            onChange={(checked) => updateProvider('umami', { doNotTrack: checked })}
            disabled={controlsDisabled}
          />
          <ToggleField
            label="Track web vitals"
            checked={settings.providers.umami.trackWebVitals}
            onChange={(checked) => updateProvider('umami', { trackWebVitals: checked })}
            disabled={controlsDisabled}
          />
        </div>
      </ProviderCard>

      <ProviderCard
        title="Fathom"
        enabled={settings.providers.fathom.enabled}
        onToggle={(enabled) => updateProvider('fathom', { enabled })}
        description="Uses Fathom’s current embedded script pattern with your site ID."
        docsHref={EXTERNAL_ANALYTICS_DOCS.fathom}
        disabled={controlsDisabled}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <TextField
            label="Site ID"
            value={settings.providers.fathom.siteId}
            placeholder="ABCDE"
            onChange={(value) => updateProvider('fathom', { siteId: value })}
            helpText="The site ID from your Fathom installation snippet."
            disabled={controlsDisabled}
          />
          <ToggleField
            label="Respect Do Not Track"
            checked={settings.providers.fathom.honorDnt}
            onChange={(checked) => updateProvider('fathom', { honorDnt: checked })}
            disabled={controlsDisabled}
          />
        </div>
      </ProviderCard>

      <section className="card p-4 space-y-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Analytics Retention</h3>
          <p className="text-sm text-muted-foreground">
            Manage how long raw analytics events stay in the database, when the dashboard warns on volume, and whether archive download is mandatory before pruning.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <NumberField
            label="Retention days"
            value={settings.retention.retentionDays}
            min={7}
            max={3650}
            onChange={(value) => updateRetention({ retentionDays: value })}
            helpText="Rows older than this cutoff become eligible for export and prune."
            disabled={controlsDisabled}
          />
          <NumberField
            label="Warning threshold"
            value={settings.retention.warnAtRowCount}
            min={1000}
            max={10000000}
            step={1000}
            onChange={(value) => updateRetention({ warnAtRowCount: value })}
            helpText="Show an admin warning once the analytics event table passes this row count."
            disabled={controlsDisabled}
          />
        </div>

        <ToggleField
          label="Require archive before prune"
          checked={settings.retention.archiveBeforePrune}
          onChange={(checked) => updateRetention({ archiveBeforePrune: checked })}
          helpText="Keep this enabled if the admin should always download an archive before deleting old analytics rows."
          disabled={controlsDisabled}
        />

        {retentionSummary && (
          <>
            {retentionSummary.overWarnThreshold && (
              <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
                Analytics row count is above the configured warning threshold. Export and prune old rows before the table grows further.
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryMetric label="Stored rows" value={numberFmt.format(retentionSummary.totalRows)} />
              <SummaryMetric label="Prunable rows" value={numberFmt.format(retentionSummary.prunableRows)} />
              <SummaryMetric label="Oldest event" value={formatTimestamp(retentionSummary.oldestEventAt)} />
              <SummaryMetric label="Newest event" value={formatTimestamp(retentionSummary.newestEventAt)} />
            </div>

            <div className="rounded-md border border-border/70 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
              <strong className="text-foreground">Prune cutoff:</strong> rows created before {formatTimestamp(retentionSummary.pruneBefore)}.
              {hasRetentionChanges && (
                <span className="block mt-1">
                  Save settings to refresh the retention summary before exporting or pruning data.
                </span>
              )}
              {!hasRetentionChanges && requiresArchiveBeforePrune && !archiveReadyForPrune && retentionSummary.prunableRows > 0 && (
                <span className="block mt-1">
                  Download the archive once before prune is enabled for this cutoff.
                </span>
              )}
              {!hasRetentionChanges && archiveReadyForPrune && retentionSummary.prunableRows > 0 && (
                <span className="block mt-1 text-primary">
                  Archive downloaded. Prune is now unlocked for the current cutoff.
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-card/40 px-4 py-3">
              <div className="text-sm text-muted-foreground">
                Download a JSON archive before pruning, or use the CLI job for larger or scheduled archive runs.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => void downloadArchive()}
                  disabled={retentionActionsDisabled || retentionSummary.prunableRows === 0}
                >
                  {retentionAction === 'export' ? 'Downloading…' : 'Download archive'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => void pruneAnalytics()}
                  disabled={!canPrune}
                >
                  {retentionAction === 'prune' ? 'Pruning…' : 'Prune old rows'}
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Larger exports can be archived to a local file with <code>npm run analytics:archive -- --prune</code> when
              <code> SUPABASE_URL</code> and <code> SUPABASE_SECRET_KEY</code> are available to the job environment.
            </p>
          </>
        )}
      </section>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => void loadPanel().catch(() => undefined)}
          disabled={loading || saving || retentionAction !== null}
        >
          {loading ? 'Reloading…' : 'Reload'}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void saveSettings()}
          disabled={saving || loading || retentionAction !== null || !hasChanges}
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </div>
  );
}

function ProviderCard({
  title,
  enabled,
  onToggle,
  description,
  docsHref,
  disabled,
  children
}: {
  title: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  description: string;
  docsHref: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`card p-4 space-y-4 ${disabled ? 'opacity-90' : ''}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold">{title}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                enabled ? 'bg-emerald-500/10 text-emerald-700' : 'bg-muted text-muted-foreground'
              }`}
            >
              {enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
          <a
            href={docsHref}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-primary underline underline-offset-2"
          >
            Official docs
          </a>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onToggle(event.target.checked)}
            className={checkboxClassName}
            disabled={disabled}
          />
          Enable
        </label>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
  helpText,
  disabled
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  helpText?: string;
  disabled?: boolean;
}) {
  const id = React.useId();

  return (
    <div className={disabled ? 'opacity-60' : ''}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={textInputClassName}
        disabled={disabled}
      />
      {helpText && <p className="mt-1 text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  helpText,
  disabled
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  helpText?: string;
  disabled?: boolean;
}) {
  const id = React.useId();

  return (
    <div className={disabled ? 'opacity-60' : ''}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          onChange(Number.isFinite(parsed) ? parsed : min);
        }}
        className={textInputClassName}
        disabled={disabled}
      />
      {helpText && <p className="mt-1 text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

function TextAreaField({
  label,
  value,
  placeholder,
  onChange,
  helpText,
  disabled
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  helpText?: string;
  disabled?: boolean;
}) {
  const id = React.useId();

  return (
    <div className={disabled ? 'opacity-60' : ''}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        rows={6}
        spellCheck={false}
        className={textAreaClassName}
        disabled={disabled}
      />
      {helpText && <p className="mt-1 text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
  helpText,
  disabled
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  helpText?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`rounded-md border border-border/70 bg-muted/20 px-3 py-2 ${disabled ? 'opacity-60' : ''}`}>
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className={checkboxClassName}
          disabled={disabled}
        />
      </label>
      {helpText && <p className="mt-1 text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

function SummaryMetric({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-card/40 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
