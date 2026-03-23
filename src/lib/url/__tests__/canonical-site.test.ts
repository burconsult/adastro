import { describe, expect, it } from 'vitest';
import { normalizeCanonicalSiteUrl } from '../site-url.ts';

describe('normalizeCanonicalSiteUrl', () => {
  it('normalizes the apex production host to the canonical www host', () => {
    expect(normalizeCanonicalSiteUrl('http://adastro.no/en/articles?ref=1')).toBe('https://www.adastro.no');
  });

  it('preserves non-production hosts while trimming path details', () => {
    expect(normalizeCanonicalSiteUrl('https://preview.adastrocms.vercel.app/en')).toBe('https://preview.adastrocms.vercel.app');
  });
});
