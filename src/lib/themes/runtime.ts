export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_MODE_STORAGE_KEY = 'theme-mode';
export const LEGACY_THEME_MODE_KEY = 'theme';
export const THEME_MODE_EVENT = 'adastro:theme-mode-changed';

const resolveSystemMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const resolveThemeMode = (mode: ThemeMode): 'light' | 'dark' => {
  if (mode === 'light' || mode === 'dark') {
    return mode;
  }
  return resolveSystemMode();
};

export const getStoredThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY) || localStorage.getItem(LEGACY_THEME_MODE_KEY);
  if (stored === 'dark' || stored === 'light' || stored === 'system') {
    return stored;
  }
  return resolveThemeMode('system');
};

export const applyThemeMode = (mode: ThemeMode) => {
  if (typeof window === 'undefined') return;
  const resolvedMode = resolveThemeMode(mode);
  const root = document.documentElement;
  root.classList.toggle('dark', resolvedMode === 'dark');
  root.dataset.themeMode = mode;
  root.style.colorScheme = resolvedMode;
  localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent(THEME_MODE_EVENT, {
    detail: {
      mode,
      resolvedMode
    }
  }));
};
