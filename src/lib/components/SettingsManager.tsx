import React, { useMemo, useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import ThemeCustomizer from '@/lib/components/ThemeCustomizer.tsx';
import { getSettingDefinition } from '@/lib/settings/registry';
import type { SettingDefinition, SettingsCategory, SiteSetting } from '@/lib/settings/types';
import { getFeatureSettingsPanels } from '@/lib/features/admin';
import { AdminLoadingState } from '@/lib/components/admin/ListingPrimitives';

interface SettingsManagerProps {
  onSettingsChange?: (settings: Record<string, any>) => void;
  includeCategories?: string[];
  excludeCategories?: string[];
  hideNavigation?: boolean;
  hideActions?: boolean;
  hideThemeCustomizer?: boolean;
}

type NavLink = {
  label: string;
  href: string;
};

const NAV_LINK_KEYS = [
  'navigation.topLinks',
  'navigation.bottomLinks'
];

const SOCIAL_LINK_KEYS = ['social.links'];
const MULTILINE_STRING_KEYS = new Set([
  'site.customHeadScripts',
  'site.customFooterScripts'
]);

export const SettingsManager: React.FC<SettingsManagerProps> = ({
  onSettingsChange,
  includeCategories,
  excludeCategories,
  hideNavigation = false,
  hideActions = false,
  hideThemeCustomizer = false
}) => {
  const [categories, setCategories] = useState<SettingsCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({});
  const [resetDialog, setResetDialog] = useState<{ open: boolean; category: string | null }>({ open: false, category: null });
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [importDialog, setImportDialog] = useState<{ open: boolean; mode: 'import' | 'restore' }>({ open: false, mode: 'import' });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const featurePanels = useMemo(() => getFeatureSettingsPanels(), []);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (categories.length === 0) return;
    if (!categories.some((category) => category.name === activeCategory)) {
      setActiveCategory(categories[0].name);
    }
  }, [categories, activeCategory]);


  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/settings');
      if (!response.ok) throw new Error('Failed to load settings');
      
      const data = await response.json();
      let filtered = data as SettingsCategory[];
      if (Array.isArray(includeCategories) && includeCategories.length > 0) {
        filtered = filtered.filter((category) => includeCategories.includes(category.name));
      }
      if (Array.isArray(excludeCategories) && excludeCategories.length > 0) {
        filtered = filtered.filter((category) => !excludeCategories.includes(category.name));
      }
      setCategories(filtered);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key: string, value: any) => {
    setPendingChanges(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const saveSettings = async () => {
    if (Object.keys(pendingChanges).length === 0) return;

    try {
      setSaving(true);
      setError(null);

      const normalizedChanges = { ...pendingChanges };
      NAV_LINK_KEYS.forEach((key) => {
        if (Array.isArray(normalizedChanges[key])) {
          normalizedChanges[key] = sanitizeNavLinks(normalizedChanges[key]);
        }
      });
      SOCIAL_LINK_KEYS.forEach((key) => {
        if (Array.isArray(normalizedChanges[key])) {
          normalizedChanges[key] = sanitizeNavLinks(normalizedChanges[key]);
        }
      });

      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: normalizedChanges })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      setPendingChanges({});
      setSuccess('Settings saved successfully');
      setTimeout(() => setSuccess(null), 3000);
      
      // Reload settings to get updated values
      await loadSettings();
      
      // Notify parent component
      onSettingsChange?.(normalizedChanges);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const performResetCategory = async (category: string) => {
    try {
      setSaving(true);
      setConfirmBusy(true);
      setError(null);

      const response = await fetch('/api/admin/settings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category })
      });

      if (!response.ok) throw new Error('Failed to reset settings');

      setSuccess(`${category} settings reset to defaults`);
      setTimeout(() => setSuccess(null), 3000);

      const newPendingChanges = { ...pendingChanges };
      Object.keys(newPendingChanges).forEach(key => {
        if (key.startsWith(`${category}.`)) {
          delete newPendingChanges[key];
        }
      });
      setPendingChanges(newPendingChanges);

      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset settings');
    } finally {
      setSaving(false);
      setConfirmBusy(false);
      setResetDialog({ open: false, category: null });
    }
  };

  const requestResetCategory = (category: string) => {
    setResetDialog({ open: true, category });
  };

  const openImportDialog = (mode: 'import' | 'restore') => {
    setImportDialog({ open: true, mode });
    setImportFile(null);
    setImportError(null);
  };

  const handleImportSubmit = async () => {
    if (!importFile) {
      setImportError('Please select a JSON file to continue.');
      return;
    }

    try {
      setImportBusy(true);
      setImportError(null);
      const text = await importFile.text();
      const parsed = JSON.parse(text);
      const body = importDialog.mode === 'restore'
        ? { backup: parsed }
        : { settings: parsed };

      const response = await fetch('/api/admin/settings/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to import settings');
      }

      setSuccess(importDialog.mode === 'restore'
        ? 'Settings restored from backup'
        : 'Settings imported successfully'
      );
      setTimeout(() => setSuccess(null), 3000);
      setImportDialog({ open: false, mode: importDialog.mode });
      setImportFile(null);
      await loadSettings();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import settings');
    } finally {
      setImportBusy(false);
    }
  };

  const exportSettings = async (category?: string) => {
    try {
      const url = category 
        ? `/api/admin/settings/backup?category=${category}&format=export`
        : '/api/admin/settings/backup?format=export';
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to export settings');
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `settings-${category || 'all'}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      
      setSuccess('Settings exported successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export settings');
    }
  };

  const createBackup = async () => {
    try {
      const response = await fetch('/api/admin/settings/backup?format=backup');
      if (!response.ok) throw new Error('Failed to create backup');
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `settings-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      
      setSuccess('Backup created successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create backup');
    }
  };

  const formatLabel = (value: string) => {
    return value
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const normalizeNavLinks = (value: unknown): NavLink[] => {
    if (Array.isArray(value)) {
      return value.map((entry) => ({
        label: typeof entry?.label === 'string' ? entry.label : '',
        href: typeof entry?.href === 'string' ? entry.href : ''
      }));
    }
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.map((entry) => ({
            label: typeof entry?.label === 'string' ? entry.label : '',
            href: typeof entry?.href === 'string' ? entry.href : ''
          }));
        }
      } catch {
        return [];
      }
    }
    return [];
  };

  const sanitizeNavLinks = (links: NavLink[]): NavLink[] => (
    links
      .map((link) => ({
        label: link.label.trim(),
        href: link.href.trim()
      }))
      .filter((link) => link.label.length > 0 && link.href.length > 0)
  );

  const renderSettingInput = (
    setting: SiteSetting,
    overrides?: {
      disabled?: boolean;
      options?: string[];
      label?: string;
      description?: string;
    }
  ) => {
    const currentValue = pendingChanges[setting.key] !== undefined 
      ? pendingChanges[setting.key] 
      : setting.value;

    // Determine input type based on setting type and validation
    const settingDef = resolveSettingDefinition(setting.key);
    const displayName = overrides?.label
      ?? settingDef?.displayName
      ?? formatLabel(setting.key.split('.').slice(1).join(' ') || setting.key);
    const description = overrides?.description ?? settingDef?.description ?? setting.description;
    const options = overrides?.options ?? settingDef?.validation?.options;
    const disabled = overrides?.disabled ?? false;
    
    switch (settingDef?.type) {
      case 'boolean':
        return (
          <div className={`space-y-2 ${disabled ? 'opacity-60' : ''}`}>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={currentValue || false}
                onChange={(e) => handleSettingChange(setting.key, e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary disabled:cursor-not-allowed"
                disabled={disabled}
              />
              <span className="text-sm font-medium text-foreground">{displayName}</span>
            </label>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        );

      case 'number':
        return (
          <div className={disabled ? 'opacity-60' : ''}>
            <label className="mb-1 block text-sm font-medium text-foreground">
              {displayName}
            </label>
            <input
              type="number"
              value={currentValue ?? ''}
              onChange={(e) => handleSettingChange(setting.key, parseInt(e.target.value) || 0)}
              min={settingDef.validation?.min}
              max={settingDef.validation?.max}
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed"
              disabled={disabled}
            />
            {description && (
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        );

      case 'array':
        return (
          <div className={disabled ? 'opacity-60' : ''}>
            <label className="mb-1 block text-sm font-medium text-foreground">
              {displayName}
            </label>
            <textarea
              value={Array.isArray(currentValue) ? currentValue.join(', ') : ''}
              onChange={(e) => {
                const values = e.target.value.split(',').map(v => v.trim()).filter(v => v);
                handleSettingChange(setting.key, values);
              }}
              placeholder="Enter values separated by commas"
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed"
              rows={2}
              disabled={disabled}
            />
            {description && (
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        );

      case 'json': {
        const jsonValue = typeof currentValue === 'string'
          ? currentValue
          : JSON.stringify(currentValue ?? null, null, 2);
        return (
          <div className={disabled ? 'opacity-60' : ''}>
            <label className="mb-1 block text-sm font-medium text-foreground">
              {displayName}
            </label>
            <textarea
              value={jsonValue}
              onChange={(e) => handleSettingChange(setting.key, e.target.value)}
              placeholder='[{"label":"Home","href":"/"}]'
              className="w-full rounded-md border border-input px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed"
              rows={6}
              disabled={disabled}
            />
            {description && (
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        );
      }

      default:
        if (options) {
          return (
            <div className={disabled ? 'opacity-60' : ''}>
              <label className="mb-1 block text-sm font-medium text-foreground">
                {displayName}
              </label>
              <select
                value={currentValue ?? ''}
                onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed"
                disabled={disabled}
              >
                {options.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              {description && (
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              )}
            </div>
          );
        }

        if (MULTILINE_STRING_KEYS.has(setting.key)) {
          return (
            <div className={disabled ? 'opacity-60' : ''}>
              <label className="mb-1 block text-sm font-medium text-foreground">
                {displayName}
              </label>
              <textarea
                value={typeof currentValue === 'string' ? currentValue : ''}
                onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed"
                rows={6}
                placeholder={setting.key === 'site.customHeadScripts'
                  ? '<script>/* inline snippet */</script>'
                  : '<script defer src=\"/scripts/custom.js\"></script>'}
                disabled={disabled}
              />
              {description && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
          );
        }

        return (
          <div className={disabled ? 'opacity-60' : ''}>
            <label className="mb-1 block text-sm font-medium text-foreground">
              {displayName}
            </label>
            <input
              type="text"
              value={currentValue ?? ''}
              onChange={(e) => handleSettingChange(setting.key, e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed"
              disabled={disabled}
            />
            {description && (
              <p className="mt-1 text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        );
    }
  };

  const resolveSettingDefinition = (key: string): SettingDefinition | undefined => (
    getSettingDefinition(key)
  );

  const activeSettings = categories.find(cat => cat.name === activeCategory);
  const t = (_key: string, fallback: string) => fallback;
  const activeCategoryLabel = activeSettings?.displayName || formatLabel(activeSettings?.name || activeCategory);
  const activeCategoryDescription = activeSettings?.description || `Configure ${activeCategoryLabel.toLowerCase()} settings.`;
  const hasChanges = Object.keys(pendingChanges).length > 0;
  const isExtrasCategory = activeCategory === 'extras';

  const getSettingByKey = (key: string): SiteSetting | undefined =>
    activeSettings?.settings.find((setting) => setting.key === key);

  const getSettingValue = (key: string): any => {
    if (Object.prototype.hasOwnProperty.call(pendingChanges, key)) {
      return pendingChanges[key];
    }
    return getSettingByKey(key)?.value;
  };

  const renderLinkEditor = (options: {
    title: string;
    description: string;
    settingKey: string;
    addLabel?: string;
    placeholderLabel?: string;
    placeholderHref?: string;
  }) => {
    const { title, description, settingKey, addLabel, placeholderLabel, placeholderHref } = options;
    const links = normalizeNavLinks(getSettingValue(settingKey));

    return (
      <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => handleSettingChange(settingKey, [...links, { label: '', href: '' }])}
          >
            {addLabel || 'Add link'}
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {links.length === 0 && (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 p-4 text-xs text-muted-foreground">
              Add links to show in this menu.
            </div>
          )}
          {links.map((link, index) => (
            <div
              key={`${settingKey}-${index}`}
              className="grid gap-3 rounded-lg border border-border/60 bg-card/80 p-3 sm:grid-cols-[1fr_1.2fr_auto]"
            >
              <input
                type="text"
                className="w-full rounded-md border border-input px-3 py-2 text-sm"
                placeholder={placeholderLabel || 'Label'}
                value={link.label}
                onChange={(event) => {
                  const next = [...links];
                  next[index] = { ...next[index], label: event.target.value };
                  handleSettingChange(settingKey, next);
                }}
              />
              <input
                type="text"
                className="w-full rounded-md border border-input px-3 py-2 text-sm"
                placeholder={placeholderHref || '/path or https://'}
                value={link.href}
                onChange={(event) => {
                  const next = [...links];
                  next[index] = { ...next[index], href: event.target.value };
                  handleSettingChange(settingKey, next);
                }}
              />
              <button
                type="button"
                className="btn btn-outline btn-sm text-destructive sm:self-center"
                onClick={() => {
                  const next = links.filter((_, linkIndex) => linkIndex !== index);
                  handleSettingChange(settingKey, next);
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSocialSettings = () => {
    const staticSocialKeys = new Set(['social.twitter', 'social.facebook', 'social.linkedin', 'social.github']);
    const staticSocialSettings = (activeSettings?.settings ?? []).filter((setting) => staticSocialKeys.has(setting.key));

    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          {staticSocialSettings.map((setting) => (
            <div key={setting.key} className="rounded-xl border border-border bg-background p-5 shadow-sm">
              {renderSettingInput(setting)}
            </div>
          ))}
        </div>
        {renderLinkEditor({
          title: 'Additional social networks',
          description: 'Add any extra profiles (for example YouTube, Mastodon, Instagram, Threads, Discord).',
          settingKey: 'social.links',
          addLabel: 'Add network',
          placeholderLabel: 'YouTube',
          placeholderHref: 'https://'
        })}
      </div>
    );
  };

  const renderNavigationSettings = () => {
    const attributionSetting = getSettingByKey('navigation.footerAttribution');
    const attributionUrlSetting = getSettingByKey('navigation.footerAttributionUrl');
    const configuredArticleBasePath = String(getSettingValue('content.articleBasePath') || '').trim();
    const articlePathPlaceholder = configuredArticleBasePath
      ? `/${configuredArticleBasePath.replace(/^\/+|\/+$/g, '')}`
      : '/articles';

    return (
      <div className="space-y-6">
        {renderLinkEditor({
          title: 'Header navigation',
          description: 'Primary links shown next to the logo in the top bar.',
          settingKey: 'navigation.topLinks',
          placeholderLabel: 'Home',
          placeholderHref: '/'
        })}
        {renderLinkEditor({
          title: 'Footer navigation',
          description: 'Primary links shown at the top of the footer.',
          settingKey: 'navigation.bottomLinks',
          placeholderLabel: 'Articles',
          placeholderHref: articlePathPlaceholder
        })}
        <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">Footer Powered-By Link</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Controls the single credit line shown at the bottom of the footer (for example “Powered by AdAstro”).
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {attributionSetting && renderSettingInput(attributionSetting, {
              label: 'Powered-by text',
              description: 'Example: Powered by AdAstro'
            })}
            {attributionUrlSetting && renderSettingInput(attributionUrlSetting, {
              label: 'Powered-by URL',
              description: 'Example: https://github.com/burconsult/adastro'
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderExtrasSettings = () => {
    if (!activeSettings) return null;

    return (
      <div className="space-y-8">
        {featurePanels.map(({ id, Panel }) => (
          <Panel
            key={id}
            getSetting={getSettingByKey}
            getValue={getSettingValue}
            renderSetting={renderSettingInput}
            t={t}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <AdminLoadingState label="Loading settings..." className="p-8" />
    );
  }

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-6">

      {!hideThemeCustomizer && <ThemeCustomizer />}

      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="rounded-md border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
          <p>{success}</p>
        </div>
      )}

      <div className={`grid gap-6 ${hideNavigation ? 'lg:grid-cols-1' : 'lg:grid-cols-[240px_1fr]'}`}>
        {/* Category Navigation */}
        {!hideNavigation && (
          <div className="w-full">
            <div className="bg-card rounded-lg shadow-sm border border-border p-4">
              <h3 className="font-medium text-foreground mb-3">Categories</h3>
              <nav className="space-y-1">
                {categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No settings categories available.
                  </p>
                ) : (
                  categories.map(category => (
                    <button
                      key={category.name}
                      onClick={() => setActiveCategory(category.name)}
                      className={`w-full rounded-md border text-left text-sm transition-colors px-3 py-2 ${
                        activeCategory === category.name
                          ? 'border-primary/40 bg-primary/10 text-primary shadow-sm'
                          : 'border-transparent text-muted-foreground hover:bg-muted/60'
                      }`}
                    >
                      {category.displayName || formatLabel(category.name)}
                    </button>
                  ))
                )}
              </nav>

              {!hideActions && (
                <div className="mt-6 pt-4 border-t border-border">
                  <h4 className="font-medium text-foreground mb-2">Actions</h4>
                  <div className="space-y-2">
                    <button
                      onClick={createBackup}
                      className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 rounded-md"
                    >
                      Create Backup
                    </button>
                    <button
                      onClick={() => exportSettings(activeCategory)}
                      className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 rounded-md disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!activeSettings}
                    >
                      Export Category
                    </button>
                    <button
                      onClick={() => exportSettings()}
                      className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 rounded-md"
                    >
                      Export All
                    </button>
                    <button
                      onClick={() => openImportDialog('import')}
                      className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 rounded-md"
                    >
                      Import Settings
                    </button>
                    <button
                      onClick={() => openImportDialog('restore')}
                      className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 rounded-md"
                    >
                      Restore Backup
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Settings Content */}
        <div className="min-w-0">
          <div className="bg-card rounded-lg shadow-sm border border-border">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium text-foreground">
                    {activeCategoryLabel}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activeCategoryDescription}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => requestResetCategory(activeCategory)}
                    className="btn btn-outline"
                    disabled={!activeSettings}
                  >
                    Reset to Defaults
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6">
              {activeSettings ? (
                isExtrasCategory ? (
                  renderExtrasSettings()
                ) : (
                  <div className="space-y-6">
                    {activeCategory === 'navigation'
                      ? renderNavigationSettings()
                      : activeCategory === 'social'
                        ? renderSocialSettings()
                      : activeSettings.settings.map(setting => (
                        <div key={setting.key} className="border-b border-border/60 pb-4 last:border-b-0">
                          {renderSettingInput(setting)}
                        </div>
                        ))
                    }
                  </div>
                )
              ) : (
                <div className="rounded-md border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
                  Select a category to view settings.
                </div>
              )}
            </div>

            {hasChanges && (
              <div className="p-6 bg-muted/60 border-t border-border">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    You have unsaved changes
                  </p>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setPendingChanges({})}
                      className="btn btn-ghost"
                    >
                      Discard
                    </button>
                    <button
                      onClick={saveSettings}
                      disabled={saving}
                      className="btn"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      <Dialog
        open={resetDialog.open}
        onOpenChange={(open) => {
          if (!open && !confirmBusy) {
            setResetDialog({ open: false, category: null });
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset settings</DialogTitle>
            <DialogDescription>
              {resetDialog.category
                ? `This will reset all ${resetDialog.category} settings to their default values.`
                : 'This will reset the selected settings to their default values.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setResetDialog({ open: false, category: null })}
              disabled={confirmBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-destructive"
              onClick={() => {
                if (resetDialog.category) {
                  void performResetCategory(resetDialog.category);
                }
              }}
              disabled={confirmBusy}
              aria-busy={confirmBusy}
            >
              {confirmBusy ? 'Resetting...' : 'Reset settings'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importDialog.open}
        onOpenChange={(open) => {
          if (!open && !importBusy) {
            setImportDialog((prev) => ({ ...prev, open: false }));
            setImportFile(null);
            setImportError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{importDialog.mode === 'restore' ? 'Restore settings backup' : 'Import settings'}</DialogTitle>
            <DialogDescription>
              {importDialog.mode === 'restore'
                ? 'Restoring a backup overwrites every setting with the snapshot in the file.'
                : 'Import settings from a key/value JSON export. Existing keys will be updated.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground" htmlFor="settings-import">
              JSON file
            </label>
            <input
              id="settings-import"
              type="file"
              accept="application/json,.json"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setImportFile(file);
                setImportError(null);
              }}
            />
            {importError && (
              <p className="text-xs text-destructive">{importError}</p>
            )}
            {importDialog.mode === 'restore' && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                This action cannot be undone. Make sure you have a current backup before restoring.
              </div>
            )}
          </div>
          <DialogFooter>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setImportDialog((prev) => ({ ...prev, open: false }))}
              disabled={importBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => void handleImportSubmit()}
              disabled={importBusy}
              aria-busy={importBusy}
            >
              {importBusy ? 'Processing...' : importDialog.mode === 'restore' ? 'Restore Backup' : 'Import Settings'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
