import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/url/site-url.js', () => ({
  resolveSiteUrl: () => 'https://www.adastro.no'
}));

import { GET } from '../robots.txt.ts';

describe('robots route', () => {
  it('disallows locale-prefixed auth and profile routes', async () => {
    const response = await GET({
      request: new Request('https://www.adastro.no/robots.txt')
    } as any);

    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('Disallow: /auth');
    expect(body).toContain('Disallow: /profile');
    expect(body).toContain('Disallow: /*/auth');
    expect(body).toContain('Disallow: /*/profile');
  });
});
