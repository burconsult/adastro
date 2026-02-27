import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isOAuthProviderAvailable: vi.fn()
}));

vi.mock('@/lib/auth/oauth-providers', () => ({
  isOAuthProviderAvailable: mocks.isOAuthProviderAvailable
}));

vi.mock('@/lib/url/site-url', () => ({
  resolveSiteUrl: () => 'https://adastrocms.vercel.app'
}));

import { GET } from '../[provider].ts';

describe('oauth provider route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isOAuthProviderAvailable.mockResolvedValue(true);
  });

  it('returns bad request for unsupported providers', async () => {
    const response = await GET({
      params: { provider: 'twitter' },
      url: new URL('https://adastrocms.vercel.app/auth/oauth/twitter')
    } as any);

    expect(response.status).toBe(400);
  });

  it('redirects to login with error when provider is unavailable', async () => {
    mocks.isOAuthProviderAvailable.mockResolvedValue(false);

    const response = await GET({
      params: { provider: 'github' },
      url: new URL('https://adastrocms.vercel.app/auth/oauth/github?redirect=%2Fadmin')
    } as any);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://adastrocms.vercel.app/auth/login?redirect=%2Fadmin&error=oauth_provider_unavailable'
    );
  });

  it('redirects to supabase authorize endpoint for available providers', async () => {
    const response = await GET({
      params: { provider: 'google' },
      url: new URL('https://adastrocms.vercel.app/auth/oauth/google?redirect=%2Fprofile')
    } as any);

    expect(response.status).toBe(302);

    const location = response.headers.get('location');
    expect(location).toBeTruthy();
    const authorizeUrl = new URL(location as string);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(`${import.meta.env.SUPABASE_URL}/auth/v1/authorize`);
    expect(authorizeUrl.searchParams.get('provider')).toBe('google');
    expect(authorizeUrl.searchParams.get('redirect_to')).toBe(
      'https://adastrocms.vercel.app/auth/callback?redirect=%2Fprofile'
    );
  });
});
