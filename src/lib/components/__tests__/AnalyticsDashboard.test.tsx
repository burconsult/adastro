import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AnalyticsDashboard from '../AnalyticsDashboard';

vi.mock('@/lib/components/admin/ListingPrimitives', () => ({
  AdminLoadingState: ({ label }: { label?: string }) => <div>{label ?? 'Loading…'}</div>
}));

const payload = {
  windowDays: 30,
  filters: {
    selectedLocale: 'all',
    selectedCountryCode: 'all',
    selectedDeviceType: 'all',
    selectedBrowser: 'all',
    selectedTrafficType: 'all',
    availableLocales: ['en', 'nb'],
    availableCountries: ['NO', 'US'],
    availableDeviceTypes: ['desktop', 'mobile'],
    availableBrowsers: ['Chrome', 'Safari']
  },
  totals: {
    totalPageViews: 120,
    previousWindowPageViews: 80,
    todayPageViews: 6,
    uniquePaths: 12,
    uniqueCountries: 4,
    uniqueReferrers: 7,
    averageDailyViews: 4,
    humanViews: 110,
    botViews: 10,
    directViews: 40,
    internalViews: 15,
    externalViews: 65
  },
  highlights: {
    bestDay: { date: '2026-03-25', count: 12 },
    topPage: { path: '/blog/launch', title: 'Launch', count: 32 },
    topReferrer: { referrerHost: 'google.com', count: 20 },
    topCountry: { countryCode: 'NO', count: 30 },
    peakHour: { hour: 10, count: 9 }
  },
  series: {
    daily: Array.from({ length: 30 }, (_, index) => ({
      date: `2026-03-${String(index + 1).padStart(2, '0')}`,
      count: index + 1,
      previousCount: Math.max(0, index - 2),
      humanCount: index,
      botCount: 1
    })),
    weekdays: [
      { label: 'Mon', count: 10 },
      { label: 'Tue', count: 15 },
      { label: 'Wed', count: 18 },
      { label: 'Thu', count: 20 },
      { label: 'Fri', count: 25 },
      { label: 'Sat', count: 12 },
      { label: 'Sun', count: 20 }
    ],
    hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, count: hour % 6 })),
    heatmap: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, index) => ({
      label,
      weekday: index,
      hours: Array.from({ length: 24 }, (_, hour) => (hour === 10 ? 4 : hour % 3))
    }))
  },
  breakdowns: {
    locales: [
      { locale: 'en', count: 90, share: 0.75 },
      { locale: 'nb', count: 30, share: 0.25 }
    ],
    countries: [
      { countryCode: 'NO', count: 30, share: 0.25 },
      { countryCode: 'US', count: 20, share: 0.1667 }
    ],
    devices: [
      { deviceType: 'desktop', count: 70, share: 0.5833 },
      { deviceType: 'mobile', count: 50, share: 0.4167 }
    ],
    browsers: [
      { browser: 'Chrome', count: 80, share: 0.6667 },
      { browser: 'Safari', count: 30, share: 0.25 }
    ],
    operatingSystems: [
      { os: 'macOS', count: 50, share: 0.4167 },
      { os: 'Windows', count: 30, share: 0.25 }
    ],
    languages: [
      { language: 'en-US', count: 80, share: 0.6667 },
      { language: 'nb-NO', count: 20, share: 0.1667 }
    ],
    sources: [
      { sourceType: 'external', count: 65, share: 0.5417 },
      { sourceType: 'direct', count: 40, share: 0.3333 },
      { sourceType: 'internal', count: 15, share: 0.125 }
    ]
  },
  reports: {
    topPages: [
      {
        path: '/blog/launch',
        title: 'Launch',
        count: 32,
        previousCount: 18,
        share: 0.2667,
        averageDailyViews: 1.1,
        uniqueCountries: 3,
        uniqueReferrers: 4
      }
    ],
    topReferrers: [
      {
        referrerHost: 'google.com',
        count: 20,
        previousCount: 9,
        share: 0.1667,
        uniquePaths: 5
      }
    ]
  }
};

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload
    }) as any;
  });

  it('renders the richer analytics reporting dashboard', async () => {
    render(<AnalyticsDashboard />);

    expect(await screen.findByRole('heading', { name: 'Traffic Trend' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Visit Rhythm' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Top Pages' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Top Referrers' })).toBeInTheDocument();
    expect(screen.getAllByText('/blog/launch').length).toBeGreaterThan(0);
    expect(screen.getAllByText('google.com').length).toBeGreaterThan(0);
  });

  it('includes the traffic filter in requests', async () => {
    render(<AnalyticsDashboard />);

    await screen.findByRole('heading', { name: 'Traffic Trend' });

    fireEvent.change(screen.getByLabelText('Traffic filter'), {
      target: { value: 'human' }
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/analytics?days=30&traffic=human');
    });
  });
});
