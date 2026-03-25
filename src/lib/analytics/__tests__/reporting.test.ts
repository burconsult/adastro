import { describe, expect, it } from 'vitest';
import { buildAnalyticsReport } from '../reporting';

const localeConfig = {
  defaultLocale: 'en',
  locales: ['en', 'nb']
};

const row = (createdAt: string, data: Record<string, unknown>) => ({
  created_at: createdAt,
  data
});

describe('analytics reporting', () => {
  it('builds comparative reporting and traffic source summaries', () => {
    const report = buildAnalyticsReport({
      currentRows: [
        row('2026-03-25T08:00:00Z', {
          path: '/en/blog/launch',
          title: 'Launch',
          countryCode: 'NO',
          deviceType: 'desktop',
          browser: 'Chrome',
          os: 'macOS',
          language: 'en-US',
          referrerHost: '',
          isBot: false
        }),
        row('2026-03-25T10:00:00Z', {
          path: '/en/blog/launch',
          title: 'Launch',
          countryCode: 'US',
          deviceType: 'mobile',
          browser: 'Safari',
          os: 'iOS',
          language: 'en-US',
          referrerHost: 'google.com',
          isBot: false
        }),
        row('2026-03-24T11:00:00Z', {
          path: '/nb/blog/nytt',
          title: 'Nytt',
          countryCode: 'NO',
          deviceType: 'desktop',
          browser: 'Firefox',
          os: 'Windows',
          language: 'nb-NO',
          referrerHost: 'www.adastro.no',
          isBot: false
        }),
        row('2026-03-23T12:00:00Z', {
          path: '/en/docs',
          title: 'Docs',
          countryCode: 'GB',
          deviceType: 'bot',
          browser: 'Chrome',
          os: 'Linux',
          language: 'en-GB',
          referrerHost: 'news.ycombinator.com',
          isBot: true
        })
      ],
      previousRows: [
        row('2026-03-18T10:00:00Z', {
          path: '/en/blog/launch',
          title: 'Launch',
          countryCode: 'NO',
          deviceType: 'desktop',
          browser: 'Chrome',
          os: 'macOS',
          language: 'en-US',
          referrerHost: 'google.com',
          isBot: false
        }),
        row('2026-03-17T10:00:00Z', {
          path: '/en/docs',
          title: 'Docs',
          countryCode: 'GB',
          deviceType: 'bot',
          browser: 'Chrome',
          os: 'Linux',
          language: 'en-GB',
          referrerHost: 'news.ycombinator.com',
          isBot: true
        })
      ],
      days: 7,
      localeConfig,
      siteHost: 'www.adastro.no',
      now: new Date('2026-03-25T12:00:00Z')
    });

    expect(report.totals).toMatchObject({
      totalPageViews: 4,
      previousWindowPageViews: 2,
      uniquePaths: 3,
      uniqueCountries: 3,
      uniqueReferrers: 2,
      humanViews: 3,
      botViews: 1,
      directViews: 1,
      internalViews: 1,
      externalViews: 2
    });

    expect(report.highlights.bestDay).toEqual({ date: '2026-03-25', count: 2 });
    expect(report.highlights.topCountry).toEqual({ countryCode: 'NO', count: 2 });
    expect(report.reports.topPages[0]).toMatchObject({
      path: '/en/blog/launch',
      count: 2,
      previousCount: 1,
      uniqueCountries: 2,
      uniqueReferrers: 1
    });
    expect(report.reports.topReferrers[0]).toMatchObject({
      referrerHost: 'google.com',
      count: 1,
      previousCount: 1,
      uniquePaths: 1
    });

    expect(report.series.daily).toHaveLength(7);
    expect(report.series.daily.map((point) => point.count)).toEqual([0, 0, 0, 0, 1, 1, 2]);
    expect(report.breakdowns.sources).toEqual([
      { sourceType: 'external', count: 2, share: 0.5 },
      { sourceType: 'direct', count: 1, share: 0.25 },
      { sourceType: 'internal', count: 1, share: 0.25 }
    ]);
  });

  it('applies locale and traffic filters while keeping filter options contextual', () => {
    const report = buildAnalyticsReport({
      currentRows: [
        row('2026-03-25T08:00:00Z', {
          path: '/en/blog/launch',
          title: 'Launch',
          countryCode: 'NO',
          deviceType: 'desktop',
          browser: 'Chrome',
          os: 'macOS',
          language: 'en-US',
          referrerHost: '',
          isBot: false
        }),
        row('2026-03-25T10:00:00Z', {
          path: '/en/blog/launch',
          title: 'Launch',
          countryCode: 'US',
          deviceType: 'mobile',
          browser: 'Safari',
          os: 'iOS',
          language: 'en-US',
          referrerHost: 'google.com',
          isBot: false
        }),
        row('2026-03-24T11:00:00Z', {
          path: '/nb/blog/nytt',
          title: 'Nytt',
          countryCode: 'NO',
          deviceType: 'desktop',
          browser: 'Firefox',
          os: 'Windows',
          language: 'nb-NO',
          referrerHost: 'www.adastro.no',
          isBot: false
        }),
        row('2026-03-23T12:00:00Z', {
          path: '/en/docs',
          title: 'Docs',
          countryCode: 'GB',
          deviceType: 'bot',
          browser: 'Chrome',
          os: 'Linux',
          language: 'en-GB',
          referrerHost: 'news.ycombinator.com',
          isBot: true
        })
      ],
      previousRows: [
        row('2026-03-18T10:00:00Z', {
          path: '/en/blog/launch',
          title: 'Launch',
          countryCode: 'NO',
          deviceType: 'desktop',
          browser: 'Chrome',
          os: 'macOS',
          language: 'en-US',
          referrerHost: 'google.com',
          isBot: false
        }),
        row('2026-03-17T10:00:00Z', {
          path: '/en/docs',
          title: 'Docs',
          countryCode: 'GB',
          deviceType: 'bot',
          browser: 'Chrome',
          os: 'Linux',
          language: 'en-GB',
          referrerHost: 'news.ycombinator.com',
          isBot: true
        })
      ],
      days: 7,
      localeConfig,
      siteHost: 'www.adastro.no',
      selectedLocale: 'en',
      selectedTrafficType: 'human',
      now: new Date('2026-03-25T12:00:00Z')
    });

    expect(report.filters.selectedLocale).toBe('en');
    expect(report.filters.selectedTrafficType).toBe('human');
    expect(report.filters.availableLocales).toEqual(['en', 'nb']);
    expect(report.filters.availableCountries).toEqual(['NO', 'US']);
    expect(report.totals).toMatchObject({
      totalPageViews: 2,
      previousWindowPageViews: 1,
      humanViews: 2,
      botViews: 0,
      uniquePaths: 1
    });
    expect(report.reports.topPages).toHaveLength(1);
    expect(report.breakdowns.sources).toEqual([
      { sourceType: 'direct', count: 1, share: 0.5 },
      { sourceType: 'external', count: 1, share: 0.5 }
    ]);
  });
});
