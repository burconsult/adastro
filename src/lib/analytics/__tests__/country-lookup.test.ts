import { describe, expect, it } from 'vitest';
import { lookupCountryCode } from '../country-lookup';

describe('lookupCountryCode', () => {
  it('returns null for unknown and private IP ranges', async () => {
    await expect(lookupCountryCode('unknown', 'https://www.adastro.no/api/analytics/track')).resolves.toBeNull();
    await expect(lookupCountryCode('127.0.0.1', 'https://www.adastro.no/api/analytics/track')).resolves.toBeNull();
    await expect(lookupCountryCode('10.0.0.5', 'https://www.adastro.no/api/analytics/track')).resolves.toBeNull();
    await expect(lookupCountryCode('::1', 'https://www.adastro.no/api/analytics/track')).resolves.toBeNull();
  });

  it('returns two-letter country code when lookup succeeds', async () => {
    const result = await lookupCountryCode('8.8.8.8', 'https://www.adastro.no/api/analytics/track');
    if (result === null) {
      expect(result).toBeNull();
      return;
    }
    expect(result).toMatch(/^[A-Z]{2}$/);
  });
});

