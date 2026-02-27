import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import {
  applyThemeMode,
  getStoredThemeMode,
  THEME_MODE_STORAGE_KEY,
  LEGACY_THEME_MODE_KEY
} from '@/lib/themes/runtime.ts';

type ThemeMode = 'light' | 'dark';

const resolveInitialMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light';
  return getStoredThemeMode();
};

interface ModeToggleProps {
  className?: string;
  label?: string;
  variant?: 'icon' | 'list';
}

const baseButtonClasses = 'relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-background text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const listButtonClasses = 'relative flex w-full items-center justify-start gap-3 rounded-md border border-input bg-background px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background min-h-[48px]';

export const ModeToggle: React.FC<ModeToggleProps> = ({ className = '', label = 'Toggle theme', variant = 'icon' }) => {
  const [mode, setMode] = useState<ThemeMode>('light');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = resolveInitialMode();
    setMode(initial);
    applyThemeMode(initial);
    setHydrated(true);

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY) || localStorage.getItem(LEGACY_THEME_MODE_KEY);
      if (stored !== 'light' && stored !== 'dark') {
        const next = event.matches ? 'dark' : 'light';
        setMode(next);
        applyThemeMode(next);
      }
    };

    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggleTheme = () => {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    applyThemeMode(next);
  };

  const classes = `${variant === 'icon' ? baseButtonClasses : listButtonClasses} ${className}`.trim();
  const showLabel = variant === 'list';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      className={classes}
    >
      {!showLabel && <span className="sr-only">{label}</span>}
      <span className="relative inline-flex h-4 w-4 items-center justify-center">
        <Sun
          aria-hidden={hydrated ? mode === 'dark' : false}
          className={`h-4 w-4 transition-all ${hydrated && mode === 'dark' ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
        />
        <Moon
          aria-hidden={hydrated ? mode !== 'dark' : true}
          className={`absolute h-4 w-4 transition-all ${hydrated && mode === 'dark' ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}
        />
      </span>
      {showLabel && <span>{label}</span>}
    </button>
  );
};

export default ModeToggle;
