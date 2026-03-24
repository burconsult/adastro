import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ThemeManager from '../ThemeManager';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>
  },
  useReducedMotion: () => true
}));

vi.mock('@/lib/components/admin/ListingPrimitives', () => ({
  AdminLoadingState: ({ label }: { label?: string }) => <div>{label ?? 'Loading…'}</div>
}));

vi.mock('@/lib/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>
}));

const themePayload = {
  activeTheme: 'loan-box',
  activeMode: 'system',
  themes: [
    {
      id: 'loan-box',
      label: 'Loan Box',
      description: 'Service-oriented theme',
      previewDescription: 'Public-service purple actions and slate surfaces.',
      previewFeatures: ['Slate admin chrome', 'Utility-first status colors'],
      fonts: {
        body: '"Segoe UI", Arial, sans-serif',
        heading: '"Trebuchet MS", sans-serif'
      },
      installed: true,
      bundled: false,
      active: true
    }
  ]
};

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

describe('ThemeManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-mode');
    document.documentElement.removeAttribute('data-theme-preview');
    document.documentElement.style.colorScheme = '';
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMatchMedia(false)
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => themePayload
    }) as any;
  });

  it('renders the specimen and keeps preview changes local until activation', async () => {
    render(<ThemeManager />);

    const loanBoxHeading = await screen.findByRole('heading', { name: 'Loan Box' });
    expect(screen.getByText('Live Theme Specimen')).toBeInTheDocument();
    expect(screen.getByText('Semantic theme preview')).toBeInTheDocument();

    const themeCard = loanBoxHeading.closest('.rounded-lg');
    expect(themeCard).not.toBeNull();

    fireEvent.click(within(themeCard as HTMLElement).getByRole('button', { name: 'Preview' }));

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('loan-box');
      expect(document.documentElement.dataset.themePreview).toBe('true');
      expect(localStorage.getItem('theme-preview')).toBe('loan-box');
      expect(localStorage.getItem('theme-preview-mode')).toBe('system');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));

    await waitFor(() => {
      expect(document.documentElement.dataset.themeMode).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(localStorage.getItem('theme-preview-mode')).toBe('dark');
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/themes');
  });
});
