import { afterEach, describe, expect, it } from 'vitest';
import { getClientIp, isSameOriginRequest, isUnsafeMethod } from '../request-guards.js';

describe('request guards', () => {
  afterEach(() => {
    delete process.env.TRUSTED_PROXY_IP_HEADERS;
    delete process.env.ASTRO_ADAPTER;
    delete process.env.NETLIFY;
    delete process.env.NETLIFY_IMAGES_CDN_DOMAIN;
    delete process.env.NETLIFY_LOCAL;
    delete process.env.SITE_ID;
    delete process.env.DEPLOY_ID;
    delete process.env.CONTEXT;
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_PROJECT_ID;
  });

  it('detects unsafe methods', () => {
    expect(isUnsafeMethod('POST')).toBe(true);
    expect(isUnsafeMethod('delete')).toBe(true);
    expect(isUnsafeMethod('GET')).toBe(false);
  });

  it('validates same-origin from origin header', () => {
    const request = new Request('https://example.com/api/test', {
      method: 'POST',
      headers: {
        origin: 'https://example.com'
      }
    });

    expect(isSameOriginRequest(request, 'https://example.com')).toBe(true);
    expect(isSameOriginRequest(request, 'https://evil.example')).toBe(false);
  });

  it('falls back to referer when origin is missing', () => {
    const request = new Request('https://example.com/api/test', {
      method: 'POST',
      headers: {
        referer: 'https://example.com/admin/settings'
      }
    });

    expect(isSameOriginRequest(request, 'https://example.com')).toBe(true);
  });

  it('does not trust forwarded headers on custom deployments by default', () => {
    const request = new Request('https://example.com/api/test', {
      headers: {
        'x-forwarded-for': '203.0.113.10, 70.41.3.18',
        'x-real-ip': '198.51.100.2'
      }
    });

    expect(getClientIp(request)).toBe('unknown');
  });

  it('trusts the Vercel forwarded IP header when Vercel markers are present', () => {
    const request = new Request('https://example.com/api/test', {
      headers: {
        'x-vercel-id': 'arn1::abc123',
        'x-forwarded-for': '203.0.113.10, 70.41.3.18'
      }
    });

    expect(getClientIp(request)).toBe('203.0.113.10');
  });

  it('trusts the Netlify client connection header when Netlify markers are present', () => {
    const request = new Request('https://example.com/api/test', {
      headers: {
        'x-nf-request-id': 'request-123',
        'x-nf-client-connection-ip': '198.51.100.12'
      }
    });

    expect(getClientIp(request)).toBe('198.51.100.12');
  });

  it('allows custom proxies only through an explicit trusted header allowlist', () => {
    process.env.TRUSTED_PROXY_IP_HEADERS = 'cf-connecting-ip, x-real-ip';

    const request = new Request('https://example.com/api/test', {
      headers: {
        'cf-connecting-ip': '198.51.100.23',
        'x-forwarded-for': '203.0.113.10'
      }
    });

    expect(getClientIp(request)).toBe('198.51.100.23');
  });
});
