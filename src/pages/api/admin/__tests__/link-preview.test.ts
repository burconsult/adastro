import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class MockUnsafeOutboundUrlError extends Error {
    reason: 'invalid_url' | 'url_not_allowed' | 'dns_lookup_failed';

    constructor(
      message: string,
      reason: 'invalid_url' | 'url_not_allowed' | 'dns_lookup_failed' = 'url_not_allowed'
    ) {
      super(message);
      this.name = 'UnsafeOutboundUrlError';
      this.reason = reason;
    }
  }

  return {
    requireAuthor: vi.fn(),
    assertSafeOutboundHttpUrl: vi.fn(),
    UnsafeOutboundUrlError: MockUnsafeOutboundUrlError
  };
});

vi.mock('@/lib/auth/auth-helpers', () => ({
  requireAuthor: mocks.requireAuthor
}));

vi.mock('@/lib/security/outbound-urls', () => ({
  UnsafeOutboundUrlError: mocks.UnsafeOutboundUrlError,
  assertSafeOutboundHttpUrl: mocks.assertSafeOutboundHttpUrl
}));

import { GET, POST } from '../link-preview.ts';

describe('link preview api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthor.mockResolvedValue({ id: 'author-1', role: 'author' });
    mocks.assertSafeOutboundHttpUrl.mockImplementation(async (value: string) => new URL(value));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (header: string) => header.toLowerCase() === 'content-type' ? 'text/html' : null
      },
      text: () => Promise.resolve('<title>Example</title><meta name="description" content="Preview body" />')
    } as any);
  });

  it('returns 401 when authentication is missing', async () => {
    mocks.requireAuthor.mockRejectedValueOnce(new Error('Authentication required'));

    const response = await GET({
      request: new Request('https://adastrocms.vercel.app/api/admin/link-preview?url=https%3A%2F%2Fexample.com')
    } as any);

    expect(response.status).toBe(401);
  });

  it('rejects outbound URLs blocked by the safety validator', async () => {
    mocks.assertSafeOutboundHttpUrl.mockRejectedValueOnce(
      new mocks.UnsafeOutboundUrlError('Blocked outbound host')
    );

    const response = await POST({
      request: new Request('https://adastrocms.vercel.app/api/admin/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://blocked.example.test' })
      })
    } as any);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'URL not allowed' });
  });
});
