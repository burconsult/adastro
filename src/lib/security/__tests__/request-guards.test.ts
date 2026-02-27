import { describe, expect, it } from 'vitest';
import { getClientIp, isSameOriginRequest, isUnsafeMethod } from '../request-guards.js';

describe('request guards', () => {
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

  it('extracts client ip from proxy headers', () => {
    const request = new Request('https://example.com/api/test', {
      headers: {
        'x-forwarded-for': '203.0.113.10, 70.41.3.18',
        'x-real-ip': '198.51.100.2'
      }
    });

    expect(getClientIp(request)).toBe('203.0.113.10');
  });
});
