export const ANALYTICS_RETENTION_SETTING_KEY = 'analytics.retention';

export type AnalyticsRetentionSettingsState = {
  retentionDays: number;
  warnAtRowCount: number;
  archiveBeforePrune: boolean;
};

export const DEFAULT_ANALYTICS_RETENTION_SETTINGS_STATE: AnalyticsRetentionSettingsState = {
  retentionDays: 180,
  warnAtRowCount: 250_000,
  archiveBeforePrune: true
};

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
);

const asInteger = (value: unknown, fallback: number, min: number, max: number) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
};

const asBoolean = (value: unknown, fallback: boolean) => (
  typeof value === 'boolean' ? value : fallback
);

export const parseAnalyticsRetentionSettings = (value: unknown): AnalyticsRetentionSettingsState => {
  const root = asRecord(value);

  return {
    retentionDays: asInteger(
      root.retentionDays,
      DEFAULT_ANALYTICS_RETENTION_SETTINGS_STATE.retentionDays,
      7,
      3650
    ),
    warnAtRowCount: asInteger(
      root.warnAtRowCount,
      DEFAULT_ANALYTICS_RETENTION_SETTINGS_STATE.warnAtRowCount,
      1_000,
      10_000_000
    ),
    archiveBeforePrune: asBoolean(
      root.archiveBeforePrune,
      DEFAULT_ANALYTICS_RETENTION_SETTINGS_STATE.archiveBeforePrune
    )
  };
};

export const serializeAnalyticsRetentionSettings = (settings: AnalyticsRetentionSettingsState) => ({
  [ANALYTICS_RETENTION_SETTING_KEY]: {
    retentionDays: asInteger(settings.retentionDays, DEFAULT_ANALYTICS_RETENTION_SETTINGS_STATE.retentionDays, 7, 3650),
    warnAtRowCount: asInteger(settings.warnAtRowCount, DEFAULT_ANALYTICS_RETENTION_SETTINGS_STATE.warnAtRowCount, 1_000, 10_000_000),
    archiveBeforePrune: settings.archiveBeforePrune
  }
});

export const getAnalyticsRetentionCutoff = (retentionDays: number, now = new Date()) => {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - asInteger(retentionDays, DEFAULT_ANALYTICS_RETENTION_SETTINGS_STATE.retentionDays, 7, 3650));
  return cutoff;
};
