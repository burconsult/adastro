import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  detectRequestSiteUrl: vi.fn(),
  getRuntimeEnv: vi.fn(),
  sanitizeBaseUrl: vi.fn()
}));

vi.mock('@/lib/setup/runtime', () => ({
  detectRequestSiteUrl: mocks.detectRequestSiteUrl,
  getRuntimeEnv: mocks.getRuntimeEnv,
  sanitizeBaseUrl: mocks.sanitizeBaseUrl
}));

import { FALLBACK_SITE_URL, resolveSiteUrl } from '../site-url.ts';

describe('resolveSiteUrl', () => {
  const compileTimeSiteUrl = (import.meta.env.SITE_URL as string | undefined) || '';
  const hasCompileTimeSiteUrl = compileTimeSiteUrl.trim().length > 0;

  it('prefers SITE_URL from runtime env when no compile-time SITE_URL is set', () => {
    if (hasCompileTimeSiteUrl) {
      expect(compileTimeSiteUrl).toBeTruthy();
      return;
    }

    mocks.getRuntimeEnv.mockReturnValue('https://env.example.com');
    mocks.sanitizeBaseUrl.mockImplementation((value?: string) => value || null);
    mocks.detectRequestSiteUrl.mockReturnValue('https://request.example.com');

    const url = resolveSiteUrl(new Request('https://request.example.com/sitemap.xml'), 'https://build.example.com');

    expect(url).toBe('https://env.example.com');
  });

  it('prefers compile-time SITE_URL when defined', () => {
    if (!hasCompileTimeSiteUrl) {
      expect(compileTimeSiteUrl).toBe('');
      return;
    }

    mocks.getRuntimeEnv.mockReturnValue('https://env.example.com');
    mocks.sanitizeBaseUrl.mockImplementation((value?: string) => value || null);
    mocks.detectRequestSiteUrl.mockReturnValue('https://request.example.com');

    const url = resolveSiteUrl(new Request('https://request.example.com/sitemap.xml'), 'https://build.example.com');

    expect(url).toBe(compileTimeSiteUrl);
  });

  it('falls back to request URL when SITE_URL is absent', () => {
    if (hasCompileTimeSiteUrl) {
      expect(compileTimeSiteUrl).toBeTruthy();
      return;
    }

    mocks.getRuntimeEnv.mockReturnValue('');
    mocks.sanitizeBaseUrl.mockImplementation((value?: string) => value || null);
    mocks.detectRequestSiteUrl.mockReturnValue('https://request.example.com');

    const url = resolveSiteUrl(new Request('https://request.example.com/rss.xml'), 'https://build.example.com');

    expect(url).toBe('https://request.example.com');
  });

  it('falls back to build-time site URL when env and request resolution fail', () => {
    if (hasCompileTimeSiteUrl) {
      expect(compileTimeSiteUrl).toBeTruthy();
      return;
    }

    mocks.getRuntimeEnv.mockReturnValue('');
    mocks.sanitizeBaseUrl.mockImplementation((value?: string) => value || null);
    mocks.detectRequestSiteUrl.mockReturnValue(null);

    const url = resolveSiteUrl(new Request('https://invalid.local/rss.xml'), 'https://build.example.com');

    expect(url).toBe('https://build.example.com');
  });

  it('returns fallback URL when nothing else is available', () => {
    if (hasCompileTimeSiteUrl) {
      expect(compileTimeSiteUrl).toBeTruthy();
      return;
    }

    mocks.getRuntimeEnv.mockReturnValue('');
    mocks.sanitizeBaseUrl.mockReturnValue(null);
    mocks.detectRequestSiteUrl.mockReturnValue(null);

    const url = resolveSiteUrl(new Request('https://invalid.local/rss.xml'), '');

    expect(url).toBe(FALLBACK_SITE_URL);
  });
});
