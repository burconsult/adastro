import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn()
}));

vi.mock('@/lib/auth/auth-helpers', () => ({
  requireAdmin: mocks.requireAdmin
}));

vi.mock('@/lib/services/settings-service', () => ({
  SettingsService: vi.fn().mockImplementation(() => ({
    getSettings: mocks.getSettings,
    updateSettings: mocks.updateSettings
  }))
}));

import { GET, PUT } from '../locales';

describe('admin locales api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    let settingsState = {
      'content.defaultLocale': 'en',
      'content.locales': ['en', 'nb']
    };
    mocks.getSettings.mockImplementation(async () => settingsState);
    mocks.updateSettings.mockImplementation(async (updates: Record<string, unknown>) => {
      settingsState = {
        ...settingsState,
        ...updates
      };
    });
  });

  it('returns locale inventory and active configuration', async () => {
    const request = new Request('https://www.adastro.no/api/admin/locales');
    const response = await GET({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.defaultLocale).toBe('en');
    expect(payload.activeLocales).toEqual(['en', 'nb']);
    expect(payload.availableLocales).toEqual(expect.arrayContaining(['en', 'nb', 'es', 'zh']));
    expect(payload.locales.some((entry: { locale: string }) => entry.locale === 'en')).toBe(true);
  });

  it('persists normalized locale settings', async () => {
    const request = new Request('https://www.adastro.no/api/admin/locales', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        defaultLocale: 'NB',
        activeLocales: ['es', 'nb', 'nb']
      })
    });

    const response = await PUT({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.updateSettings).toHaveBeenCalledWith({
      'content.defaultLocale': 'nb',
      'content.locales': ['nb', 'es']
    }, 'admin-1');
    expect(payload.defaultLocale).toBe('nb');
    expect(payload.activeLocales).toEqual(['nb', 'es']);
  });

  it('rejects invalid default locales without a core pack', async () => {
    const request = new Request('https://www.adastro.no/api/admin/locales', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        defaultLocale: 'fr',
        activeLocales: ['fr']
      })
    });

    const response = await PUT({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/core language pack/i);
    expect(mocks.updateSettings).not.toHaveBeenCalled();
  });

  it('returns 403 for non-admin access', async () => {
    mocks.requireAdmin.mockRejectedValueOnce(new Error('Admin access required'));

    const request = new Request('https://www.adastro.no/api/admin/locales');
    const response = await GET({ request } as any);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toMatch(/admin access required/i);
  });
});
