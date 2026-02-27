import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { loadFeatureModules } from '@/lib/features/loader';
import type { FeatureModule, FeatureSettingRenderer } from '@/lib/features/types';
import type { SettingDefinition, SiteSetting } from '@/lib/settings/types';
import { AdminLoadingState } from './ListingPrimitives';

interface FeatureSettingsPanelHostProps {
  featureId: string;
}

const FEATURE_MODULES = loadFeatureModules();

const buildSettingState = (
  definitions: SettingDefinition[],
  values: Record<string, unknown>
): SiteSetting[] => (
  definitions.map((definition) => ({
    id: '',
    key: definition.key,
    value: Object.prototype.hasOwnProperty.call(values, definition.key)
      ? values[definition.key]
      : definition.defaultValue,
    category: definition.category,
    description: definition.description,
    createdAt: new Date(),
    updatedAt: new Date()
  }))
);

const formatLabel = (value: string) => (
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
);

export default function FeatureSettingsPanelHost({ featureId }: FeatureSettingsPanelHostProps) {
  const featureModule = useMemo<FeatureModule | undefined>(
    () => FEATURE_MODULES.find((module) => module.id === featureId),
    [featureId]
  );
  const panel = featureModule?.admin?.settingsPanel;
  const definitions = featureModule?.definition.settings ?? [];

  const [settings, setSettings] = useState<SiteSetting[]>([]);
  const [pendingChanges, setPendingChanges] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const settingsByKey = useMemo(() => {
    const map = new Map<string, SiteSetting>();
    settings.forEach((setting) => {
      map.set(setting.key, setting);
    });
    return map;
  }, [settings]);

  const getSetting = useCallback((key: string): SiteSetting | undefined => (
    settingsByKey.get(key)
  ), [settingsByKey]);

  const getValue = useCallback((key: string): unknown => {
    if (Object.prototype.hasOwnProperty.call(pendingChanges, key)) {
      return pendingChanges[key];
    }
    return settingsByKey.get(key)?.value;
  }, [pendingChanges, settingsByKey]);

  const loadSettings = useCallback(async () => {
    if (!featureModule) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const keys = definitions.map((definition) => definition.key);
      const response = await fetch(`/api/admin/settings?keys=${encodeURIComponent(keys.join(','))}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to load feature settings');
      }

      const values = await response.json();
      setSettings(buildSettingState(definitions, values));
      setPendingChanges({});
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load feature settings');
    } finally {
      setLoading(false);
    }
  }, [definitions, featureModule]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSettingChange = useCallback((key: string, value: unknown) => {
    setPendingChanges((previous) => ({
      ...previous,
      [key]: value
    }));
  }, []);

  const renderSetting: FeatureSettingRenderer = useCallback((setting, options) => {
    const definition = definitions.find((item) => item.key === setting.key);
    const currentValue = getValue(setting.key);
    const label = options?.label ?? definition?.displayName ?? formatLabel(setting.key);
    const description = options?.description ?? definition?.description ?? setting.description;
    const allowedOptions = options?.options ?? definition?.validation?.options;
    const disabled = options?.disabled ?? false;

    switch (definition?.type) {
      case 'boolean':
        return (
          <div className={`space-y-2 ${disabled ? 'opacity-60' : ''}`}>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={Boolean(currentValue)}
                onChange={(event) => handleSettingChange(setting.key, event.target.checked)}
                className="rounded border-input text-primary focus:ring-primary disabled:cursor-not-allowed"
                disabled={disabled}
              />
              <span className="text-sm font-medium text-foreground">{label}</span>
            </label>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
        );
      case 'number':
        return (
          <div className={disabled ? 'opacity-60' : ''}>
            <label className="mb-1 block text-sm font-medium text-foreground">{label}</label>
            <input
              type="number"
              value={currentValue ?? ''}
              onChange={(event) => {
                const raw = event.target.value;
                const parsed = Number(raw);
                handleSettingChange(setting.key, Number.isFinite(parsed) ? parsed : 0);
              }}
              min={definition.validation?.min}
              max={definition.validation?.max}
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed"
              disabled={disabled}
            />
            {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
          </div>
        );
      case 'array':
        return (
          <div className={disabled ? 'opacity-60' : ''}>
            <label className="mb-1 block text-sm font-medium text-foreground">{label}</label>
            <textarea
              value={Array.isArray(currentValue) ? currentValue.join(', ') : ''}
              onChange={(event) => {
                const values = event.target.value
                  .split(',')
                  .map((entry) => entry.trim())
                  .filter(Boolean);
                handleSettingChange(setting.key, values);
              }}
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed"
              rows={3}
              disabled={disabled}
            />
            {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
          </div>
        );
      case 'json': {
        const value = typeof currentValue === 'string'
          ? currentValue
          : JSON.stringify(currentValue ?? null, null, 2);
        return (
          <div className={disabled ? 'opacity-60' : ''}>
            <label className="mb-1 block text-sm font-medium text-foreground">{label}</label>
            <textarea
              value={value}
              onChange={(event) => handleSettingChange(setting.key, event.target.value)}
              className="w-full rounded-md border border-input px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed"
              rows={6}
              disabled={disabled}
            />
            {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
          </div>
        );
      }
      default:
        if (allowedOptions && allowedOptions.length > 0) {
          return (
            <div className={disabled ? 'opacity-60' : ''}>
              <label className="mb-1 block text-sm font-medium text-foreground">{label}</label>
              <select
                value={String(currentValue ?? '')}
                onChange={(event) => handleSettingChange(setting.key, event.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed"
                disabled={disabled}
              >
                {allowedOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
            </div>
          );
        }

        return (
          <div className={disabled ? 'opacity-60' : ''}>
            <label className="mb-1 block text-sm font-medium text-foreground">{label}</label>
            <input
              type="text"
              value={String(currentValue ?? '')}
              onChange={(event) => handleSettingChange(setting.key, event.target.value)}
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed"
              disabled={disabled}
            />
            {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
          </div>
        );
    }
  }, [definitions, getValue, handleSettingChange]);

  const saveSettings = useCallback(async () => {
    if (Object.keys(pendingChanges).length === 0) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: pendingChanges })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to save settings');
      }

      setSuccess('Feature settings saved.');
      await loadSettings();
      window.setTimeout(() => setSuccess(null), 2500);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [loadSettings, pendingChanges]);

  const t = (_key: string, fallback: string) => fallback;

  if (!featureModule || !panel) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
        Feature settings panel is unavailable.
      </div>
    );
  }

  const Panel = panel;
  const hasChanges = Object.keys(pendingChanges).length > 0;

  return (
    <div className="space-y-4">
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

      {loading ? (
        <div className="card p-2">
          <AdminLoadingState label="Loading feature settings..." />
        </div>
      ) : (
        <Panel
          getSetting={getSetting}
          getValue={getValue}
          renderSetting={renderSetting}
          t={t}
        />
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => void loadSettings()}
          disabled={loading || saving}
        >
          Reload
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void saveSettings()}
          disabled={saving || loading || !hasChanges}
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </div>
  );
}
