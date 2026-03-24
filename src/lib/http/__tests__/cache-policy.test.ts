import { describe, expect, it } from 'vitest';
import {
  HTML_BROWSER_CACHE_CONTROL,
  HTML_NETLIFY_CDN_CACHE_CONTROL,
  NO_STORE_CACHE_CONTROL,
  shouldApplyHtmlCdnCache,
  shouldForceNoStore
} from '../cache-policy.ts';

describe('cache policy', () => {
  it('allows CDN caching for anonymous public HTML requests', () => {
    const request = new Request('https://www.adastro.no/en/articles', {
      headers: { accept: 'text/html' }
    });

    expect(shouldApplyHtmlCdnCache({
      request,
      pathname: '/en/articles',
      requestPolicyPath: '/articles',
      responseStatus: 200,
      contentType: 'text/html; charset=utf-8'
    })).toBe(true);
  });

  it('blocks CDN caching for personalized public HTML requests', () => {
    const request = new Request('https://www.adastro.no/en/articles', {
      headers: {
        accept: 'text/html',
        cookie: 'sb-access-token=token-1'
      }
    });

    expect(shouldApplyHtmlCdnCache({
      request,
      pathname: '/en/articles',
      requestPolicyPath: '/articles',
      responseStatus: 200,
      contentType: 'text/html; charset=utf-8'
    })).toBe(false);

    expect(shouldForceNoStore({
      request,
      pathname: '/en/articles',
      requestPolicyPath: '/articles',
      contentType: 'text/html; charset=utf-8'
    })).toBe(true);
  });

  it('forces no-store for private HTML routes', () => {
    const request = new Request('https://www.adastro.no/en/auth/login');

    expect(shouldForceNoStore({
      request,
      pathname: '/en/auth/login',
      requestPolicyPath: '/auth/login',
      contentType: 'text/html; charset=utf-8'
    })).toBe(true);
  });

  it('keeps api responses uncached', () => {
    const request = new Request('https://www.adastro.no/api/analytics/track', {
      method: 'POST'
    });

    expect(shouldForceNoStore({
      request,
      pathname: '/api/analytics/track',
      requestPolicyPath: '/api/analytics/track',
      contentType: 'application/json'
    })).toBe(true);
    expect(NO_STORE_CACHE_CONTROL).toBe('no-store');
    expect(HTML_BROWSER_CACHE_CONTROL).toContain('must-revalidate');
  });

  it('uses the same CDN TTL for Netlify and shared cache headers', () => {
    expect(HTML_NETLIFY_CDN_CACHE_CONTROL).toContain('s-maxage=300');
    expect(HTML_NETLIFY_CDN_CACHE_CONTROL).toContain('durable');
  });
});
