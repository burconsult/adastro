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
  accent?: string;
  fonts?: {
    body: string;
    heading: string;
  };
  fontImports?: string[];
  installed: boolean;
  bundled: boolean;
  active: boolean;
};

type ThemeMode = 'light' | 'dark' | 'system';

const PREVIEW_PRESET_KEY = 'theme-preview';
const PREVIEW_MODE_KEY = 'theme-preview-mode';

const getFileLabel = (file: File | null) => file?.name || 'Choose a theme package (.zip)';

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

const ensureFontImports = (imports: string[] = []) => {
  if (typeof document === 'undefined') return;
  const head = document.head;
  imports.forEach((href) => {
    if (document.querySelector(`link[data-theme-font="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.themeFont = href;
    head.appendChild(link);
  });
};

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
      const activeTheme = typeof payload?.activeTheme === 'string' ? payload.activeTheme : 'adastro';
      const mode = (payload?.activeMode as ThemeMode) || 'system';
      setActiveThemeId(activeTheme);
      setActiveMode(mode);
      const active = (Array.isArray(payload?.themes) ? payload.themes : [])
        .find((theme: ThemeSummary) => theme.id === activeTheme);
      if (active?.fontImports) {
        ensureFontImports(active.fontImports);
      }
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
    if (storedPreview) {
      const theme = themes.find((item) => item.id === storedPreview);
      if (!theme) {
        localStorage.removeItem(PREVIEW_PRESET_KEY);
        localStorage.removeItem(PREVIEW_MODE_KEY);
        setPreviewThemeId(null);
        setPreviewMode(activeMode);
        applyThemeToDocument(activeThemeId, activeMode, false);
        return;
      }
      if (theme.fontImports) {
        ensureFontImports(theme.fontImports);
      }
      setPreviewThemeId(storedPreview);
      setPreviewMode(storedMode);
      applyThemeToDocument(storedPreview, storedMode, true);
    }
  }, [activeMode, activeThemeId, themes]);

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

  const startPreview = useCallback((themeId: string) => {
    if (typeof window === 'undefined') return;
    const theme = themes.find((item) => item.id === themeId);
    if (theme?.fontImports) {
      ensureFontImports(theme.fontImports);
    }
    const mode = activeMode;
    localStorage.setItem(PREVIEW_PRESET_KEY, themeId);
    localStorage.setItem(PREVIEW_MODE_KEY, mode);
    setPreviewThemeId(themeId);
    setPreviewMode(mode);
    applyThemeToDocument(themeId, mode, true);
  }, [activeMode, themes]);

  const handleActivate = useCallback(async (themeId: string) => {
    try {
      setBusyThemeId(themeId);
      setMessage(null);
      const response = await fetch('/api/admin/themes/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: themeId, mode: activeMode })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to activate theme');
      }
      setActiveThemeId(themeId);
      applyThemeToDocument(themeId, activeMode);
      clearPreview(themeId, activeMode);
      await loadThemes();
      setMessage({ type: 'success', text: 'Theme activated.' });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to activate theme';
      setMessage({ type: 'error', text });
    } finally {
      setBusyThemeId(null);
    }
  }, [activeMode, clearPreview, loadThemes]);

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
  const previewTheme = useMemo(
    () => (previewThemeId ? themes.find((theme) => theme.id === previewThemeId) ?? null : null),
    [previewThemeId, themes]
  );
  const isPreviewing = Boolean(previewTheme);

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
              <a href="/" target="_blank" rel="noreferrer" className="btn btn-outline">
                Open site preview
              </a>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="card p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Installed Themes</h2>
              <p className="text-sm text-muted-foreground">
                Preview and switch themes without touching the core styles.
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
                      className="rounded-lg border border-border/60 bg-background p-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
                      {...motionProps}
                    >
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold">{theme.label}</h3>
                          <span className="badge badge-secondary text-xs">
                            {theme.bundled ? 'Bundled' : 'Installed'}
                          </span>
                          {isActive && <span className="badge badge-gradient text-xs">Active</span>}
                        </div>
                        {theme.description && (
                          <p className="text-xs text-muted-foreground">{theme.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {theme.version && <span>v{theme.version}</span>}
                          {theme.author && <span>{theme.author}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Accent</span>
                          <span
                            className="h-4 w-4 rounded-full border border-border/60"
                            style={{ background: theme.accent || 'hsl(var(--primary))' }}
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                      <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap md:w-52 md:flex-none md:flex-col">
                        <button
                          type="button"
                          className="btn btn-outline w-full justify-center"
                          onClick={() => startPreview(theme.id)}
                        >
                          {isPreview ? 'Previewing' : 'Preview'}
                        </button>
                        <button
                          type="button"
                          className="btn w-full justify-center"
                          onClick={() => handleActivate(theme.id)}
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
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="card p-6 space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Install Theme</h2>
                <p className="text-sm text-muted-foreground">
                  Upload a theme package (.zip) exported from another build.
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
