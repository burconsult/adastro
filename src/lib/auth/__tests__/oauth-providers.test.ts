import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn()
}));

vi.mock('@/lib/services/settings-service', () => ({
  SettingsService: class {
    getSettings = mocks.getSettings;
  }
}));

import { getOAuthProviderAvailability } from '../oauth-providers';

describe('oauth provider availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        external: {
          github: true,
          google: true
        }
      })
    }) as any;
  });

  it('marks provider available only when app toggle and supabase provider are enabled', async () => {
    mocks.getSettings.mockResolvedValue({
      'auth.oauth.github.enabled': true,
      'auth.oauth.google.enabled': false
    });

    const availability = await getOAuthProviderAvailability({ forceRefresh: true });
    const github = availability.find((entry) => entry.id === 'github');
    const google = availability.find((entry) => entry.id === 'google');

    expect(github?.available).toBe(true);
    expect(github?.enabledInApp).toBe(true);
    expect(github?.enabledInSupabase).toBe(true);

    expect(google?.available).toBe(false);
    expect(google?.enabledInApp).toBe(false);
    expect(google?.enabledInSupabase).toBe(true);
  });

  it('falls back to unavailable providers when supabase settings call fails', async () => {
    mocks.getSettings.mockResolvedValue({
      'auth.oauth.github.enabled': true,
      'auth.oauth.google.enabled': true
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({})
    }) as any;

    const availability = await getOAuthProviderAvailability({ forceRefresh: true });
    expect(availability.every((entry) => entry.available === false)).toBe(true);
  });
});
