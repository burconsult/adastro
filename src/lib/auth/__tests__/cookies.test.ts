import { describe, expect, it } from 'vitest';
import { buildAccessTokenCookie } from '../cookies.js';

describe('auth cookie builder', () => {
  it('includes Secure on https requests', () => {
    const cookie = buildAccessTokenCookie('abc123', 3600, 'https://example.com/api/auth/login');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Max-Age=3600');
  });

  it('omits Secure on http requests for local development', () => {
    const cookie = buildAccessTokenCookie('abc123', 3600, 'http://localhost:4321/api/auth/login');
    expect(cookie).not.toContain('Secure');
  });
});
