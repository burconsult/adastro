import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  lookup: vi.fn()
}));

vi.mock('node:dns/promises', () => ({
  default: {
    lookup: mocks.lookup
  },
  lookup: mocks.lookup
}));

import { UnsafeOutboundUrlError, assertSafeOutboundHttpUrl } from '../outbound-urls';

describe('assertSafeOutboundHttpUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 }
    ]);
  });

  it('allows public http URLs that resolve to public IPs', async () => {
    const parsed = await assertSafeOutboundHttpUrl('https://example.com/article');

    expect(parsed.toString()).toBe('https://example.com/article');
    expect(mocks.lookup).toHaveBeenCalledWith('example.com', { all: true, verbatim: true });
  });

  it('rejects loopback and local hostnames immediately', async () => {
    await expect(assertSafeOutboundHttpUrl('http://localhost:3000/test')).rejects.toBeInstanceOf(UnsafeOutboundUrlError);
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it('rejects DNS names that resolve to private or reserved IPs', async () => {
    mocks.lookup.mockResolvedValueOnce([
      { address: '127.0.0.1', family: 4 }
    ]);

    await expect(assertSafeOutboundHttpUrl('https://preview.example.test')).rejects.toThrow('resolves to a private or reserved address');
  });

  it('rejects URLs with embedded credentials', async () => {
    await expect(assertSafeOutboundHttpUrl('https://user:pass@example.com/private')).rejects.toThrow('embedded credentials');
  });
});
