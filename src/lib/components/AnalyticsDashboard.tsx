import React from 'react';
import { AdminLoadingState } from '@/lib/components/admin/ListingPrimitives';

type TopPath = { path: string; count: number };
type TopReferrer = { referrerHost: string; count: number };
type DailyPoint = { date: string; count: number };
type LocalePoint = { locale: string; count: number };
type CountryPoint = { countryCode: string; count: number };
type DevicePoint = { deviceType: string; count: number };
type BrowserPoint = { browser: string; count: number };
type OsPoint = { os: string; count: number };
type Payload = {
  windowDays: number;
  selectedLocale: string;
  selectedCountryCode: string;
  selectedDeviceType: string;
  selectedBrowser: string;
  availableLocales: string[];
  availableCountries: string[];
  availableDeviceTypes: string[];
  availableBrowsers: string[];
  localeBreakdown: LocalePoint[];
  countryBreakdown: CountryPoint[];
  deviceBreakdown: DevicePoint[];
  browserBreakdown: BrowserPoint[];
  osBreakdown: OsPoint[];
  botViews: number;
  humanViews: number;
  totalPageViews: number;
  previousWindowPageViews: number;
  uniquePaths: number;
  todayPageViews: number;
  topPaths: TopPath[];
  topReferrers: TopReferrer[];
  dailyViews: DailyPoint[];
};

const numberFmt = new Intl.NumberFormat();

function deltaText(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? '+new' : '0%';
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

export default function AnalyticsDashboard() {
  const [days, setDays] = React.useState<7 | 30>(30);
  const [locale, setLocale] = React.useState<string>('all');
  const [country, setCountry] = React.useState<string>('all');
  const [device, setDevice] = React.useState<string>('all');
  const [browser, setBrowser] = React.useState<string>('all');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<Payload | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({ days: String(days) });
        if (locale !== 'all') {
          params.set('locale', locale);
        }
        if (country !== 'all') {
          params.set('country', country);
        }
        if (device !== 'all') {
          params.set('device', device);
        }
        if (browser !== 'all') {
          params.set('browser', browser);
        }
        const res = await fetch(`/api/admin/analytics?${params.toString()}`);
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || 'Failed to load analytics');
        if (!cancelled) setData(payload as Payload);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load analytics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [days, locale, country, device, browser]);

  React.useEffect(() => {
    if (!data) return;
    if (locale === 'all') return;
    if (data.availableLocales.includes(locale)) return;
    setLocale('all');
  }, [data, locale]);

  React.useEffect(() => {
    if (!data) return;
    if (country === 'all') return;
    if (data.availableCountries.includes(country)) return;
    setCountry('all');
  }, [country, data]);

  React.useEffect(() => {
    if (!data) return;
    if (device === 'all') return;
    if (data.availableDeviceTypes.includes(device)) return;
    setDevice('all');
  }, [data, device]);

  React.useEffect(() => {
    if (!data) return;
    if (browser === 'all') return;
    if (data.availableBrowsers.includes(browser)) return;
    setBrowser('all');
  }, [browser, data]);

  if (loading) {
    return <AdminLoadingState label="Loading analytics..." className="p-8" />;
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const maxDaily = Math.max(1, ...data.dailyViews.map((p) => p.count));
  const localeLabel = data.selectedLocale === 'all' ? 'All locales' : data.selectedLocale.toUpperCase();
  const countryLabel = data.selectedCountryCode === 'all' ? 'All countries' : data.selectedCountryCode.toUpperCase();
  const browserLabel = data.selectedBrowser === 'all' ? 'All browsers' : data.selectedBrowser;
  const deviceLabel = data.selectedDeviceType === 'all' ? 'All devices' : data.selectedDeviceType;
  const countryName = (countryCode: string) => {
    if (countryCode === 'ZZ') return 'Unknown';
    try {
      const display = new Intl.DisplayNames(['en'], { type: 'region' });
      return display.of(countryCode) || countryCode;
    } catch {
      return countryCode;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Lightweight first-party pageview analytics (no cookies, JavaScript-based tracking).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-border p-1">
            {[7, 30].map((option) => (
              <button
                key={option}
                type="button"
                className={`rounded px-3 py-1.5 text-xs font-medium ${days === option ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setDays(option as 7 | 30)}
              >
                {option}d
              </button>
            ))}
          </div>
          <select
            aria-label="Locale filter"
            value={locale}
            onChange={(event) => setLocale(event.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
          >
            <option value="all">All locales</option>
            {(data.availableLocales || []).map((option) => (
              <option key={option} value={option}>
                {option.toUpperCase()}
              </option>
            ))}
          </select>
          <select
            aria-label="Country filter"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
          >
            <option value="all">All countries</option>
            {(data.availableCountries || []).map((option) => (
              <option key={option} value={option}>
                {countryName(option)}
              </option>
            ))}
          </select>
          <select
            aria-label="Device filter"
            value={device}
            onChange={(event) => setDevice(event.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
          >
            <option value="all">All devices</option>
            {(data.availableDeviceTypes || []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            aria-label="Browser filter"
            value={browser}
            onChange={(event) => setBrowser(event.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
          >
            <option value="all">All browsers</option>
            {(data.availableBrowsers || []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Page Views (${data.windowDays}d)`} value={numberFmt.format(data.totalPageViews)} hint={`${localeLabel} • ${countryLabel} • ${deviceLabel} • ${browserLabel}`} />
        <StatCard label="Today" value={numberFmt.format(data.todayPageViews)} />
        <StatCard label="Unique Pages" value={numberFmt.format(data.uniquePaths)} />
        <StatCard label="Previous Window" value={numberFmt.format(data.previousWindowPageViews)} />
      </div>

      {data.localeBreakdown.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Locale split ({data.windowDays}d): {data.localeBreakdown.map((item) => `${item.locale.toUpperCase()} ${numberFmt.format(item.count)}`).join(' • ')}
        </p>
      )}
      {data.countryBreakdown.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Country split ({data.windowDays}d): {data.countryBreakdown.slice(0, 8).map((item) => `${countryName(item.countryCode)} ${numberFmt.format(item.count)}`).join(' • ')}
        </p>
      )}
      {data.deviceBreakdown.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Device split: {data.deviceBreakdown.map((item) => `${item.deviceType} ${numberFmt.format(item.count)}`).join(' • ')}
        </p>
      )}
      {data.browserBreakdown.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Browser split: {data.browserBreakdown.slice(0, 6).map((item) => `${item.browser} ${numberFmt.format(item.count)}`).join(' • ')}
        </p>
      )}
      {(data.botViews > 0 || data.humanViews > 0) && (
        <p className="text-xs text-muted-foreground">
          Traffic type: Human {numberFmt.format(data.humanViews)} • Bot {numberFmt.format(data.botViews)}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="card p-4 space-y-3">
          <h3 className="text-base font-semibold">Daily Page Views</h3>
          {data.dailyViews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pageview events recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {data.dailyViews.map((point) => (
                <div key={point.date} className="grid grid-cols-[84px_1fr_auto] items-center gap-3 text-xs">
                  <span className="text-muted-foreground">{point.date}</span>
                  <div className="h-2 rounded bg-muted overflow-hidden">
                    <div
                      className="h-full rounded bg-primary"
                      style={{ width: `${Math.max(4, Math.round((point.count / maxDaily) * 100))}%` }}
                    />
                  </div>
                  <span className="font-medium text-foreground">{numberFmt.format(point.count)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card p-4 space-y-3">
          <h3 className="text-base font-semibold">Top Pages</h3>
          {data.topPaths.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tracked pages yet.</p>
          ) : (
            <div className="space-y-2">
              {data.topPaths.map((item) => (
                <div key={item.path} className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-foreground" title={item.path}>{item.path}</span>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">{numberFmt.format(item.count)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-4 space-y-3">
          <h3 className="text-base font-semibold">Top Referrers</h3>
          {data.topReferrers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No referrer data yet.</p>
          ) : (
            <div className="space-y-2">
              {data.topReferrers.map((item) => (
                <div key={item.referrerHost} className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-foreground" title={item.referrerHost}>{item.referrerHost}</span>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">{numberFmt.format(item.count)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card p-4 space-y-3">
          <h3 className="text-base font-semibold">Top Operating Systems</h3>
          {data.osBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No operating system data yet.</p>
          ) : (
            <div className="space-y-2">
              {data.osBreakdown.slice(0, 8).map((item) => (
                <div key={item.os} className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-foreground">{item.os}</span>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">{numberFmt.format(item.count)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <p className="text-xs text-muted-foreground">
        Country data source: IPLocate IP address databases (
        <a
          href="https://github.com/iplocate/ip-address-databases"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          github.com/iplocate/ip-address-databases
        </a>
        ).
      </p>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
