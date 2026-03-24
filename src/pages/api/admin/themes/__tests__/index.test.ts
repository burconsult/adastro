import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  requireAdmin: vi.fn(),
  getThemeModules: vi.fn(),
  getSettings: vi.fn()
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: mocks.existsSync,
    readdirSync: mocks.readdirSync
  };
});

vi.mock('@/lib/auth/auth-helpers', () => ({
  requireAdmin: mocks.requireAdmin
}));

vi.mock('@/lib/themes/registry', () => ({
  getThemeModules: mocks.getThemeModules
}));

vi.mock('@/lib/services/settings-service', () => ({
  SettingsService: vi.fn().mockImplementation(() => ({
    getSettings: mocks.getSettings
  }))
}));

import { GET } from '../index';

describe('admin themes api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mocks.existsSync.mockReturnValue(true);
    mocks.readdirSync.mockReturnValue([
      { name: 'loan-box', isDirectory: () => true },
      { name: 'README.md', isDirectory: () => false }
    ]);
    mocks.getThemeModules.mockReturnValue([
      {
        id: 'adastro',
        label: 'AdAstro (Default)',
        description: 'Default theme',
        previewDescription: 'Default preview copy',
        previewFeatures: ['Cyan action palette'],
        fonts: {
          body: '"Avenir Next", Arial, sans-serif',
          heading: 'Georgia, serif'
        },
        source: 'core'
      },
      {
        id: 'loan-box',
        label: 'Loan Box',
        description: 'Service-oriented theme',
        version: '1.0.0',
        author: 'Codex',
        previewDescription: 'Purple actions and slate admin chrome.',
        previewFeatures: ['Slate admin chrome', 'Utility-first status colors'],
        fonts: {
          body: '"Segoe UI", Arial, sans-serif',
          heading: '"Trebuchet MS", sans-serif'
        },
        source: 'installed'
      }
    ]);
    mocks.getSettings.mockResolvedValue({
      'appearance.theme.active': 'missing-theme',
      'appearance.theme.mode': 'dark'
    });
  });

  it('falls back unknown active themes and serializes preview metadata', async () => {
    const request = new Request('https://www.adastro.no/api/admin/themes');
    const response = await GET({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.activeTheme).toBe('adastro');
    expect(payload.activeMode).toBe('dark');

    const defaultTheme = payload.themes.find((theme: { id: string }) => theme.id === 'adastro');
    const loanBox = payload.themes.find((theme: { id: string }) => theme.id === 'loan-box');

    expect(defaultTheme).toMatchObject({
      bundled: true,
      installed: false,
      active: true,
      previewDescription: 'Default preview copy',
      previewFeatures: ['Cyan action palette']
    });

    expect(loanBox).toMatchObject({
      bundled: false,
      installed: true,
      active: false,
      version: '1.0.0',
      author: 'Codex',
      previewDescription: 'Purple actions and slate admin chrome.',
      previewFeatures: ['Slate admin chrome', 'Utility-first status colors'],
      fonts: {
        body: '"Segoe UI", Arial, sans-serif',
        heading: '"Trebuchet MS", sans-serif'
      }
    });
  });
});
