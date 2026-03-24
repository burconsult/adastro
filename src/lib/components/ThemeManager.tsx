import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AdminLoadingState } from '@/lib/components/admin/ListingPrimitives';
import { THEME_MODE_EVENT, THEME_MODE_STORAGE_KEY } from '@/lib/themes/runtime';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/lib/components/ui/dialog';

type ThemeSummary = {
  id: string;
  label: string;
  description?: string;
  version?: string;
  author?: string;
  previewImage?: string;
  previewDescription?: string;
  previewFeatures?: string[];
  fonts?: {
    body: string;
    heading: string;
  };
  installed: boolean;
  bundled: boolean;
  active: boolean;
};

type ThemeMode = 'light' | 'dark' | 'system';

const PREVIEW_PRESET_KEY = 'theme-preview';
const PREVIEW_MODE_KEY = 'theme-preview-mode';
const PREVIEW_MODES: ThemeMode[] = ['light', 'dark', 'system'];

const getFileLabel = (file: File | null) => file?.name || 'Choose a theme package (.zip)';

const summarizeFontStack = (stack?: string) => {
  if (!stack) return 'System';
  const [firstEntry] = stack.split(',');
  return firstEntry?.trim().replace(/^['"]|['"]$/g, '') || 'System';
};

const resolveMode = (mode: ThemeMode) => {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
};

const applyThemeToDocument = (themeId: string, mode: ThemeMode, preview = false) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const resolvedMode = resolveMode(mode);
  root.dataset.theme = themeId;
  root.dataset.themeMode = mode;
  root.classList.toggle('dark', resolvedMode === 'dark');
  root.style.colorScheme = resolvedMode;
  if (preview) {
    root.dataset.themePreview = 'true';
  } else {
    delete root.dataset.themePreview;
    localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
    window.dispatchEvent(new CustomEvent(THEME_MODE_EVENT, {
      detail: {
        mode,
        resolvedMode
      }
    }));
  }
};

const persistPreview = (themeId: string, mode: ThemeMode) => {
  localStorage.setItem(PREVIEW_PRESET_KEY, themeId);
  localStorage.setItem(PREVIEW_MODE_KEY, mode);
};

const chartSwatches = [
  { key: 'chart1', label: 'Chart 1' },
  { key: 'chart2', label: 'Chart 2' },
  { key: 'chart3', label: 'Chart 3' },
  { key: 'chart4', label: 'Chart 4' },
  { key: 'chart5', label: 'Chart 5' }
] as const;

export const ThemeManager: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const [themes, setThemes] = useState<ThemeSummary[]>([]);
  const [activeThemeId, setActiveThemeId] = useState('adastro');
  const [activeMode, setActiveMode] = useState<ThemeMode>('system');
  const [previewThemeId, setPreviewThemeId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<ThemeMode>('system');
  const [loading, setLoading] = useState(true);
  const [installFile, setInstallFile] = useState<File | null>(null);
  const [installing, setInstalling] = useState(false);
  const [busyThemeId, setBusyThemeId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmUninstall, setConfirmUninstall] = useState<{ open: boolean; theme: ThemeSummary | null }>({
    open: false,
    theme: null
  });

  const loadThemes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/themes');
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to load themes');
      }
      const payload = await response.json();
      setThemes(Array.isArray(payload?.themes) ? payload.themes : []);
      setActiveThemeId(typeof payload?.activeTheme === 'string' ? payload.activeTheme : 'adastro');
      setActiveMode((payload?.activeMode as ThemeMode) || 'system');
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load themes';
      setMessage({ type: 'error', text });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThemes();
  }, [loadThemes]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedPreview = localStorage.getItem(PREVIEW_PRESET_KEY);
    const storedMode = (localStorage.getItem(PREVIEW_MODE_KEY) as ThemeMode | null) || 'system';
    if (!storedPreview) return;

    const theme = themes.find((item) => item.id === storedPreview);
    if (!theme) {
      localStorage.removeItem(PREVIEW_PRESET_KEY);
      localStorage.removeItem(PREVIEW_MODE_KEY);
      setPreviewThemeId(null);
      setPreviewMode(activeMode);
      applyThemeToDocument(activeThemeId, activeMode, false);
      return;
    }

    setPreviewThemeId(storedPreview);
    setPreviewMode(storedMode);
    applyThemeToDocument(storedPreview, storedMode, true);
  }, [activeMode, activeThemeId, themes]);

  const activeTheme = useMemo(
    () => themes.find((theme) => theme.id === activeThemeId) ?? null,
    [themes, activeThemeId]
  );
  const previewTheme = useMemo(
    () => (previewThemeId ? themes.find((theme) => theme.id === previewThemeId) ?? null : null),
    [themes, previewThemeId]
  );
  const isPreviewing = Boolean(previewTheme);
  const specimenTheme = previewTheme ?? activeTheme ?? themes[0] ?? null;
  const specimenMode = isPreviewing ? previewMode : activeMode;

  const clearPreview = useCallback((nextThemeId?: string, nextMode?: ThemeMode) => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(PREVIEW_PRESET_KEY);
    localStorage.removeItem(PREVIEW_MODE_KEY);
    setPreviewThemeId(null);
    const resolvedTheme = nextThemeId || activeThemeId;
    const resolvedMode = nextMode || activeMode;
    setPreviewMode(resolvedMode);
    applyThemeToDocument(resolvedTheme, resolvedMode, false);
  }, [activeMode, activeThemeId]);

  const startPreview = useCallback((themeId: string, mode: ThemeMode = activeMode) => {
    if (typeof window === 'undefined') return;
    persistPreview(themeId, mode);
    setPreviewThemeId(themeId);
    setPreviewMode(mode);
    applyThemeToDocument(themeId, mode, true);
  }, [activeMode]);

  const handlePreviewModeChange = useCallback((mode: ThemeMode) => {
    const targetThemeId = previewThemeId || activeThemeId;
    if (!targetThemeId) return;
    startPreview(targetThemeId, mode);
  }, [activeThemeId, previewThemeId, startPreview]);

  const handleInstall = useCallback(async () => {
    if (!installFile) {
      setMessage({ type: 'error', text: 'Select a theme package to install.' });
      return;
    }

    try {
      setInstalling(true);
      setMessage(null);
      const formData = new FormData();
      formData.append('file', installFile);
      const response = await fetch('/api/admin/themes/install', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to install theme');
      }
      setMessage({
        type: 'success',
        text: 'Theme installed. Restart the server to load the new theme.'
      });
      setInstallFile(null);
      await loadThemes();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to install theme';
      setMessage({ type: 'error', text });
    } finally {
      setInstalling(false);
    }
  }, [installFile, loadThemes]);

  const handleActivate = useCallback(async (themeId: string) => {
    const modeToPersist = previewThemeId === themeId ? previewMode : activeMode;

    try {
      setBusyThemeId(themeId);
      setMessage(null);
      const response = await fetch('/api/admin/themes/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: themeId, mode: modeToPersist })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to activate theme');
      }
      setActiveThemeId(themeId);
      setActiveMode(modeToPersist);
      applyThemeToDocument(themeId, modeToPersist);
      clearPreview(themeId, modeToPersist);
      await loadThemes();
      setMessage({ type: 'success', text: 'Theme activated.' });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to activate theme';
      setMessage({ type: 'error', text });
    } finally {
      setBusyThemeId(null);
    }
  }, [activeMode, clearPreview, loadThemes, previewMode, previewThemeId]);

  const confirmUninstallTheme = useCallback((theme: ThemeSummary) => {
    setConfirmUninstall({ open: true, theme });
  }, []);

  const handleUninstall = useCallback(async () => {
    const theme = confirmUninstall.theme;
    if (!theme) return;

    try {
      setBusyThemeId(theme.id);
      setMessage(null);
      const response = await fetch('/api/admin/themes/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: theme.id })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to uninstall theme');
      }
      setMessage({
        type: 'success',
        text: 'Theme uninstalled. Restart the server to apply changes.'
      });
      setConfirmUninstall({ open: false, theme: null });
      await loadThemes();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to uninstall theme';
      setMessage({ type: 'error', text });
    } finally {
      setBusyThemeId(null);
    }
  }, [confirmUninstall.theme, loadThemes]);

  const installedThemes = useMemo(
    () => themes.filter((theme) => theme.installed || theme.bundled),
    [themes]
  );

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-6">
        {message && (
          <div
            className={`rounded-md border px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-destructive/20 bg-destructive/10 text-destructive'
            }`}
          >
            {message.text}
          </div>
        )}

        {isPreviewing && (
          <div className="rounded-md border border-info/30 bg-info/10 p-4 text-sm text-info">
            Previewing <strong>{previewTheme?.label || previewThemeId}</strong> in <strong>{previewMode}</strong> mode.
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="btn btn-outline" onClick={clearPreview}>
                Clear preview
              </button>
              {previewThemeId && (
                <button type="button" className="btn btn-primary" onClick={() => void handleActivate(previewThemeId)}>
                  Activate Previewed Theme
                </button>
              )}
              <a href="/" target="_blank" rel="noreferrer" className="btn btn-outline">
                Open Site Preview
              </a>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="card p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Installed Themes</h2>
              <p className="text-sm text-muted-foreground">
                Preview a full semantic specimen before activation. Preview mode changes stay local until you activate.
              </p>
            </div>
            {loading ? (
              <AdminLoadingState label="Loading themes..." className="p-6" />
            ) : installedThemes.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No themes available yet.
              </div>
            ) : (
              <div className="space-y-3">
                {installedThemes.map((theme, index) => {
                  const isActive = theme.id === activeThemeId;
                  const isPreview = theme.id === previewThemeId;
                  const motionProps = reduceMotion
                    ? {}
                    : {
                        initial: { opacity: 0, y: 12 },
                        animate: { opacity: 1, y: 0 },
                        transition: { duration: 0.35, delay: index * 0.04 }
                      };
                  return (
                    <motion.div
                      key={theme.id}
                      className="rounded-lg border border-border/60 bg-surface-1 p-4"
                      {...motionProps}
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold">{theme.label}</h3>
                            <span className="badge badge-secondary text-xs">
                              {theme.bundled ? 'Bundled' : 'Installed'}
                            </span>
                            {isActive && <span className="badge badge-gradient text-xs">Active</span>}
                            {isPreview && <span className="badge text-xs">Previewing</span>}
                          </div>
                          {(theme.previewDescription || theme.description) && (
                            <p className="text-sm text-muted-foreground">
                              {theme.previewDescription || theme.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {theme.version && <span>v{theme.version}</span>}
                            {theme.author && <span>{theme.author}</span>}
                            {theme.fonts?.body && <span>Body: {summarizeFontStack(theme.fonts.body)}</span>}
                            {theme.fonts?.heading && <span>Heading: {summarizeFontStack(theme.fonts.heading)}</span>}
                          </div>
                          {Array.isArray(theme.previewFeatures) && theme.previewFeatures.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {theme.previewFeatures.map((feature) => (
                                <span key={feature} className="badge text-xs">
                                  {feature}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap md:w-52 md:flex-none md:flex-col">
                          <button
                            type="button"
                            className="btn btn-outline w-full justify-center"
                            onClick={() => startPreview(theme.id, previewMode)}
                          >
                            {isPreview ? 'Previewing' : 'Preview'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary w-full justify-center"
                            onClick={() => void handleActivate(theme.id)}
                            disabled={busyThemeId === theme.id}
                          >
                            {isActive ? 'Active' : 'Activate'}
                          </button>
                          {!theme.bundled && (
                            <button
                              type="button"
                              className="btn btn-destructive w-full justify-center"
                              onClick={() => confirmUninstallTheme(theme)}
                              disabled={busyThemeId === theme.id}
                            >
                              {busyThemeId === theme.id ? 'Removing...' : 'Uninstall'}
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="card p-6 space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Live Theme Specimen</h2>
                <p className="text-sm text-muted-foreground">
                  Use the preview controls to inspect site, form, chart, and admin chrome states before activation.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {PREVIEW_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`btn ${specimenMode === mode ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => handlePreviewModeChange(mode)}
                  >
                    {mode[0].toUpperCase()}{mode.slice(1)}
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-border/70 bg-surface-1 p-4 shadow-sm">
                <div className="grid gap-4 xl:grid-cols-[1fr_14rem]">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {specimenTheme?.label || 'Theme'} · {specimenMode}
                      </p>
                      <h3 className="font-heading text-2xl text-foreground">
                        Semantic theme preview
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {specimenTheme?.previewDescription || specimenTheme?.description || 'Inspect buttons, surfaces, forms, and chart colors before activation.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn btn-primary">Primary</button>
                      <button type="button" className="btn btn-secondary">Secondary</button>
                      <button type="button" className="btn btn-outline">Outline</button>
                      <button type="button" className="btn btn-destructive">Destructive</button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border bg-surface-2 p-4">
                        <label className="mb-2 block text-sm font-medium text-foreground">Field Chrome</label>
                        <input
                          readOnly
                          value="Theme-aware input"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none"
                        />
                        <p className="mt-2 text-xs text-muted-foreground">Border, focus ring, and placeholder surfaces inherit from the theme contract.</p>
                      </div>
                      <div className="rounded-xl border border-border bg-surface-2 p-4">
                        <p className="mb-3 text-sm font-medium text-foreground">Badges & Status</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="badge">Default</span>
                          <span className="badge badge-secondary">Secondary</span>
                          <span className="badge badge-gradient">Active</span>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">Typography uses {summarizeFontStack(specimenTheme?.fonts?.body)} and {summarizeFontStack(specimenTheme?.fonts?.heading)}.</p>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-5">
                      {chartSwatches.map((swatch) => (
                        <div key={swatch.key} className="space-y-2">
                          <div
                            className="h-14 rounded-lg border border-border shadow-sm"
                            style={{ backgroundColor: `hsl(var(--${swatch.key}))` }}
                          />
                          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{swatch.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <aside className="rounded-2xl border border-sidebar-border bg-sidebar p-4 text-sidebar-foreground shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/70">Admin Chrome</p>
                    <div className="mt-3 space-y-2">
                      <div className="rounded-lg bg-sidebar-primary px-3 py-2 text-sm font-medium text-sidebar-primary-foreground shadow-sm">
                        Dashboard
                      </div>
                      <div className="rounded-lg border border-sidebar-border px-3 py-2 text-sm text-sidebar-foreground/80">
                        Posts
                      </div>
                      <div className="rounded-lg bg-sidebar-accent px-3 py-2 text-sm font-medium text-sidebar-accent-foreground">
                        Theme Preview
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            </div>

            <div className="card p-6 space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Install Theme</h2>
                <p className="text-sm text-muted-foreground">
                  Upload a theme package (.zip) that matches the semantic contract and local-asset requirements.
                </p>
              </div>
              <div className="space-y-3 text-sm">
                <label htmlFor="theme-install-file" className="text-sm font-medium text-foreground">
                  Theme package
                </label>
                <input
                  id="theme-install-file"
                  type="file"
                  accept=".zip,application/zip"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  onChange={(event) => setInstallFile(event.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">{getFileLabel(installFile)}</p>
              </div>
              <button
                type="button"
                className="btn btn-primary w-full"
                onClick={() => void handleInstall()}
                disabled={installing}
              >
                {installing ? 'Installing...' : 'Install Theme'}
              </button>
              <p className="text-xs text-muted-foreground">
                Installation updates the theme manifest. Restart the server to load the new theme.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={confirmUninstall.open}
        onOpenChange={(open) => {
          if (!open && !busyThemeId) {
            setConfirmUninstall({ open: false, theme: null });
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Uninstall theme</DialogTitle>
            <DialogDescription>
              {confirmUninstall.theme
                ? `This will remove ${confirmUninstall.theme.label} from this project.`
                : 'This will remove the selected theme.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setConfirmUninstall({ open: false, theme: null })}
              disabled={Boolean(busyThemeId)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-destructive"
              onClick={() => void handleUninstall()}
              disabled={Boolean(busyThemeId)}
            >
              {busyThemeId ? 'Uninstalling...' : 'Uninstall'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ThemeManager;
