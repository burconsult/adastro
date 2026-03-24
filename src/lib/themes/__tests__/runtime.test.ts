import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyThemeMode,
  getStoredThemeMode,
  LEGACY_THEME_MODE_KEY,
  resolveThemeMode,
  THEME_MODE_EVENT,
  THEME_MODE_STORAGE_KEY
} from '../runtime';

const createStorage = () => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
};

const createMatchMedia = (matches: boolean) =>
  vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));

describe('theme runtime', () => {
  beforeEach(() => {
    const storage = createStorage();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: storage
    });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: storage
    });
    storage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme-mode');
    document.documentElement.style.colorScheme = '';
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMatchMedia(false)
    });
  });

  it('defaults to system mode when no stored preference exists', () => {
    expect(getStoredThemeMode()).toBe('system');
  });

  it('reads the legacy stored mode before migration completes', () => {
    localStorage.setItem(LEGACY_THEME_MODE_KEY, 'dark');

    expect(getStoredThemeMode()).toBe('dark');
  });

  it('resolves system mode from the current media query and persists the semantic mode', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMatchMedia(true)
    });

    let emittedEvent: CustomEvent | null = null;
    window.addEventListener(
      THEME_MODE_EVENT,
      (event) => {
        emittedEvent = event as CustomEvent;
      },
      { once: true }
    );

    expect(resolveThemeMode('system')).toBe('dark');

    applyThemeMode('system');

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.dataset.themeMode).toBe('system');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('system');
    expect(emittedEvent?.detail).toEqual({
      mode: 'system',
      resolvedMode: 'dark'
    });
  });
});
