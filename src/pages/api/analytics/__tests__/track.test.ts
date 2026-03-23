import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  insert: vi.fn(),
  parseUserAgent: vi.fn(),
  lookupCountryCode: vi.fn()
}));

vi.mock('@/lib/services/settings-service', () => ({
  SettingsService: vi.fn().mockImplementation(() => ({
    getSettings: mocks.getSettings
  }))
}));

vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit
}));

vi.mock('@/lib/security/request-guards', () => ({
  getClientIp: mocks.getClientIp
}));

vi.mock('@/lib/supabase', () => ({
  isSupabaseAdminConfigured: true,
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: mocks.insert
    }))
  }
}));

vi.mock('@/lib/analytics/user-agent', () => ({
  parseUserAgent: mocks.parseUserAgent
}));

vi.mock('@/lib/analytics/country-lookup', () => ({
  lookupCountryCode: mocks.lookupCountryCode
}));

import { POST } from '../track.ts';

describe('analytics track api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSettings.mockResolvedValue({
      'analytics.enabled': true,
      'content.defaultLocale': 'en',
      'content.locales': ['en', 'nb']
    });
    mocks.checkRateLimit.mockReturnValue({ allowed: true });
    mocks.getClientIp.mockReturnValue('127.0.0.1');
    mocks.insert.mockResolvedValue({ error: null });
    mocks.parseUserAgent.mockReturnValue({
      browser: 'Chrome',
      os: 'macOS',
      deviceType: 'desktop',
      isBot: false
    });
    mocks.lookupCountryCode.mockResolvedValue('NO');
  });

  it('ignores locale-prefixed private routes', async () => {
    const request = new Request('https://www.adastro.no/api/analytics/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        'Accept-Language': 'nb-NO,nb;q=0.9'
      },
      body: JSON.stringify({ path: '/nb/auth/login', title: 'Login' })
    });

    const response = await POST({ request } as any);

    expect(response.status).toBe(204);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('tracks localized public pages', async () => {
    const request = new Request('https://www.adastro.no/api/analytics/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        'Accept-Language': 'nb-NO,nb;q=0.9'
      },
      body: JSON.stringify({ path: '/nb/blog/test-post', title: 'Test Post' })
    });

    const response = await POST({ request } as any);

    expect(response.status).toBe(204);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        path: '/nb/blog/test-post',
        title: 'Test Post',
        countryCode: 'NO'
      })
    }));
  });
});
