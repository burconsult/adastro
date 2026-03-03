import React, { useEffect, useState } from 'react';
import { ModeToggle } from '@/components/ModeToggle.tsx';
import { applyThemeMode, getStoredThemeMode, resolveThemeMode } from '@/lib/themes/runtime.ts';

interface ThemeCustomizerProps {
  className?: string;
}

export const ThemeCustomizer: React.FC<ThemeCustomizerProps> = ({ className = '' }) => {
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentMode = resolveThemeMode(getStoredThemeMode());
    setMode(currentMode);
  }, []);

  const handleModeSelect = (nextMode: 'light' | 'dark') => {
    setMode(nextMode);
    applyThemeMode(nextMode);
  };

  return (
    <section className={`rounded-xl border border-border bg-card p-6 shadow-sm ${className}`.trim()}>
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xl space-y-2">
          <h2 className="text-lg font-semibold">Theme & Appearance</h2>
          <p className="text-sm text-muted-foreground">
            Switch light or dark mode here. Theme palettes are managed from the Themes screen so everything stays in one place.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleModeSelect('light')}
            className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
              mode === 'light'
                ? 'border-transparent bg-muted text-foreground shadow-sm'
                : 'border-border text-muted-foreground hover:bg-muted/60'
            }`}
          >
            <span>Light</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeSelect('dark')}
            className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
              mode === 'dark'
                ? 'border-transparent bg-muted text-foreground shadow-sm'
                : 'border-border text-muted-foreground hover:bg-muted/60'
            }`}
          >
            <span>Dark</span>
          </button>
          <ModeToggle label="Toggle theme" />
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-background/60 p-4 text-sm text-muted-foreground">
        <p>Need to switch theme colors or typography?</p>
        <a href="/admin/themes" className="mt-2 inline-flex items-center font-medium text-primary hover:underline">
          Open Theme Manager
        </a>
      </div>
    </section>
  );
};

export default ThemeCustomizer;
