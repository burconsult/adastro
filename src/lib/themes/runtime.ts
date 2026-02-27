export type ThemeMode = 'light' | 'dark';

export const THEME_MODE_STORAGE_KEY = 'theme-mode';
export const LEGACY_THEME_MODE_KEY = 'theme';

const resolveSystemMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const getStoredThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY) || localStorage.getItem(LEGACY_THEME_MODE_KEY);
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }
  return resolveSystemMode();
};

export const applyThemeMode = (mode: ThemeMode) => {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
};
