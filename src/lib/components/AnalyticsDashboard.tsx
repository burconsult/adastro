import React from 'react';
import { AdminLoadingState } from '@/lib/components/admin/ListingPrimitives';
import AnalyticsProviderSettings from '@/lib/components/AnalyticsProviderSettings';
import type {
  AnalyticsDailyPoint,
  AnalyticsHeatmapRow,
  AnalyticsReport,
  AnalyticsSourceType,
  AnalyticsTopPath,
  AnalyticsTopReferrer
} from '@/lib/analytics/reporting';

const numberFmt = new Intl.NumberFormat();
const decimalFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const percentFmt = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 });
const shortDateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

const TRAFFIC_OPTIONS = [
  { value: 'all', label: 'All traffic' },
  { value: 'human', label: 'Human only' },
  { value: 'bot', label: 'Bots only' }
] as const;

type AnalyticsTab = 'reporting' | 'settings';

const sourceLabels: Record<AnalyticsSourceType, string> = {
  direct: 'Direct',
  internal: 'Internal',
  external: 'External'
};

const countryDisplay = new Intl.DisplayNames(['en'], { type: 'region' });

const formatDateLabel = (date: string) => shortDateFmt.format(new Date(`${date}T00:00:00Z`));

const formatPercent = (value: number) => percentFmt.format(Number.isFinite(value) ? value : 0);

const deltaText = (current: number, previous: number) => {
  if (previous <= 0) return current > 0 ? 'New' : '0%';
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(pct);
  return `${rounded >= 0 ? '+' : ''}${rounded}%`;
};

const deltaToneClass = (current: number, previous: number) => {
  if (previous <= 0) return current > 0 ? 'text-emerald-600' : 'text-muted-foreground';
  if (current > previous) return 'text-emerald-600';
  if (current < previous) return 'text-destructive';
  return 'text-muted-foreground';
};

const countryName = (countryCode: string) => {
  if (countryCode === 'ZZ') return 'Unknown';
  try {
    return countryDisplay.of(countryCode) || countryCode;
  } catch {
    return countryCode;
  }
};

const localeName = (locale: string) => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(locale) || locale.toUpperCase();
  } catch {
    return locale.toUpperCase();
  }
};

const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = React.useState<AnalyticsTab>('reporting');
  const [days, setDays] = React.useState<7 | 30 | 90>(30);
  const [locale, setLocale] = React.useState<string>('all');
  const [country, setCountry] = React.useState<string>('all');
  const [device, setDevice] = React.useState<string>('all');
  const [browser, setBrowser] = React.useState<string>('all');
  const [traffic, setTraffic] = React.useState<'all' | 'human' | 'bot'>('all');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<AnalyticsReport | null>(null);

  React.useEffect(() => {
    if (activeTab !== 'reporting') {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({ days: String(days) });
        if (locale !== 'all') params.set('locale', locale);
        if (country !== 'all') params.set('country', country);
        if (device !== 'all') params.set('device', device);
        if (browser !== 'all') params.set('browser', browser);
        if (traffic !== 'all') params.set('traffic', traffic);

        const res = await fetch(`/api/admin/analytics?${params.toString()}`);
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || 'Failed to load analytics');
        if (!cancelled) {
          setData(payload as AnalyticsReport);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Failed to load analytics');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeTab, browser, country, days, device, locale, traffic]);

  React.useEffect(() => {
    if (!data || locale === 'all') return;
    if (data.filters.availableLocales.includes(locale)) return;
    setLocale('all');
  }, [data, locale]);

  React.useEffect(() => {
    if (!data || country === 'all') return;
    if (data.filters.availableCountries.includes(country)) return;
    setCountry('all');
  }, [country, data]);

  React.useEffect(() => {
    if (!data || device === 'all') return;
    if (data.filters.availableDeviceTypes.includes(device)) return;
    setDevice('all');
  }, [data, device]);

  React.useEffect(() => {
    if (!data || browser === 'all') return;
    if (data.filters.availableBrowsers.includes(browser)) return;
    setBrowser('all');
  }, [browser, data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-card/40 p-2">
        <button
          type="button"
          className={`btn h-9 px-4 text-sm ${activeTab === 'reporting' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('reporting')}
        >
          Reporting
        </button>
        <button
          type="button"
          className={`btn h-9 px-4 text-sm ${activeTab === 'settings' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>

      {activeTab === 'settings' ? (
        <AnalyticsProviderSettings />
      ) : (
        <AnalyticsReportingPanel
          loading={loading}
          error={error}
          data={data}
          days={days}
          locale={locale}
          country={country}
          device={device}
          browser={browser}
          traffic={traffic}
          setDays={setDays}
          setLocale={setLocale}
          setCountry={setCountry}
          setDevice={setDevice}
          setBrowser={setBrowser}
          setTraffic={setTraffic}
        />
      )}
    </div>
  );
}

function AnalyticsReportingPanel({
  loading,
  error,
  data,
  days,
  locale,
  country,
  device,
  browser,
  traffic,
  setDays,
  setLocale,
  setCountry,
  setDevice,
  setBrowser,
  setTraffic
}: {
  loading: boolean;
  error: string | null;
  data: AnalyticsReport | null;
  days: 7 | 30 | 90;
  locale: string;
  country: string;
  device: string;
  browser: string;
  traffic: 'all' | 'human' | 'bot';
  setDays: React.Dispatch<React.SetStateAction<7 | 30 | 90>>;
  setLocale: React.Dispatch<React.SetStateAction<string>>;
  setCountry: React.Dispatch<React.SetStateAction<string>>;
  setDevice: React.Dispatch<React.SetStateAction<string>>;
  setBrowser: React.Dispatch<React.SetStateAction<string>>;
  setTraffic: React.Dispatch<React.SetStateAction<'all' | 'human' | 'bot'>>;
}) {
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

  const topCountry = data.highlights.topCountry ? countryName(data.highlights.topCountry.countryCode) : 'No country data';
  const topReferrer = data.highlights.topReferrer?.referrerHost || 'No external referrers';
  const topPage = data.highlights.topPage?.path || 'No tracked pages';
  const humanShare = data.totals.totalPageViews > 0 ? data.totals.humanViews / data.totals.totalPageViews : 0;

  return (
    <>
      <section className="card p-4 space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              First-party pageview reporting for public pages with trend comparison, traffic source analysis, and visit timing.
            </p>
            <p className="text-xs text-muted-foreground">
              Activity timing is shown in UTC because events are aggregated server-side by timestamp.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-border p-1">
              {[7, 30, 90].map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`rounded px-3 py-1.5 text-xs font-medium ${days === option ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setDays(option as 7 | 30 | 90)}
                >
                  {option}d
                </button>
              ))}
            </div>
            <AnalyticsSelect
              ariaLabel="Traffic filter"
              value={traffic}
              onChange={setTraffic}
              options={TRAFFIC_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            />
            <AnalyticsSelect
              ariaLabel="Locale filter"
              value={locale}
              onChange={setLocale}
              options={[
                { value: 'all', label: 'All locales' },
                ...data.filters.availableLocales.map((value) => ({ value, label: localeName(value) }))
              ]}
            />
            <AnalyticsSelect
              ariaLabel="Country filter"
              value={country}
              onChange={setCountry}
              options={[
                { value: 'all', label: 'All countries' },
                ...data.filters.availableCountries.map((value) => ({ value, label: countryName(value) }))
              ]}
            />
            <AnalyticsSelect
              ariaLabel="Device filter"
              value={device}
              onChange={setDevice}
              options={[
                { value: 'all', label: 'All devices' },
                ...data.filters.availableDeviceTypes.map((value) => ({ value, label: capitalize(value) }))
              ]}
            />
            <AnalyticsSelect
              ariaLabel="Browser filter"
              value={browser}
              onChange={setBrowser}
              options={[
                { value: 'all', label: 'All browsers' },
                ...data.filters.availableBrowsers.map((value) => ({ value, label: value }))
              ]}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label={`Page Views (${data.windowDays}d)`}
          value={numberFmt.format(data.totals.totalPageViews)}
          delta={deltaText(data.totals.totalPageViews, data.totals.previousWindowPageViews)}
          deltaTone={deltaToneClass(data.totals.totalPageViews, data.totals.previousWindowPageViews)}
          hint={`${numberFmt.format(data.totals.previousWindowPageViews)} previous window`}
        />
        <StatCard
          label="Average / Day"
          value={decimalFmt.format(data.totals.averageDailyViews)}
          hint={`${numberFmt.format(data.totals.todayPageViews)} today`}
        />
        <StatCard
          label="Unique Pages"
          value={numberFmt.format(data.totals.uniquePaths)}
          hint={`${numberFmt.format(data.totals.uniqueCountries)} countries reached`}
        />
        <StatCard
          label="Human Traffic"
          value={formatPercent(humanShare)}
          hint={`${numberFmt.format(data.totals.humanViews)} human • ${numberFmt.format(data.totals.botViews)} bot`}
        />
        <StatCard
          label="Direct Share"
          value={formatPercent(data.totals.directViews / Math.max(data.totals.totalPageViews, 1))}
          hint={`${numberFmt.format(data.totals.externalViews)} external • ${numberFmt.format(data.totals.internalViews)} internal`}
        />
        <StatCard
          label="External Referrers"
          value={numberFmt.format(data.totals.uniqueReferrers)}
          hint={topReferrer}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
        <HighlightCard
          label="Best Day"
          value={data.highlights.bestDay ? `${formatDateLabel(data.highlights.bestDay.date)}` : 'No data'}
          detail={data.highlights.bestDay ? `${numberFmt.format(data.highlights.bestDay.count)} views` : undefined}
        />
        <HighlightCard
          label="Peak Hour"
          value={data.highlights.peakHour ? hourLabel(data.highlights.peakHour.hour) : 'No data'}
          detail={data.highlights.peakHour ? `${numberFmt.format(data.highlights.peakHour.count)} views` : undefined}
        />
        <HighlightCard
          label="Top Page"
          value={topPage}
          detail={data.highlights.topPage ? `${numberFmt.format(data.highlights.topPage.count)} views` : undefined}
        />
        <HighlightCard
          label="Top Country"
          value={topCountry}
          detail={data.highlights.topCountry ? `${numberFmt.format(data.highlights.topCountry.count)} views` : undefined}
        />
        <HighlightCard
          label="Top Referrer"
          value={topReferrer}
          detail={data.highlights.topReferrer ? `${numberFmt.format(data.highlights.topReferrer.count)} views` : undefined}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="card p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Traffic Trend</h3>
              <p className="text-sm text-muted-foreground">Current window versus the preceding {data.windowDays}-day period.</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>Current: {numberFmt.format(data.totals.totalPageViews)}</div>
              <div>Previous: {numberFmt.format(data.totals.previousWindowPageViews)}</div>
            </div>
          </div>
          <TrafficTrendChart points={data.series.daily} />
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              Current window
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full border border-dashed border-foreground/50" />
              Previous window
            </span>
            <span>Human: {numberFmt.format(data.totals.humanViews)}</span>
            <span>Bot: {numberFmt.format(data.totals.botViews)}</span>
          </div>
        </section>

        <section className="card p-4 space-y-4">
          <div>
            <h3 className="text-base font-semibold">Visit Rhythm</h3>
            <p className="text-sm text-muted-foreground">Heatmap of viewing activity by weekday and hour (UTC).</p>
          </div>
          <ActivityHeatmap rows={data.series.heatmap} />
        </section>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <BreakdownCard
          title="Traffic Sources"
          items={data.breakdowns.sources.map((item) => ({
            label: sourceLabels[item.sourceType],
            count: item.count,
            share: item.share
          }))}
        />
        <BreakdownCard
          title="Devices"
          items={data.breakdowns.devices.map((item) => ({
            label: capitalize(item.deviceType),
            count: item.count,
            share: item.share
          }))}
        />
        <BreakdownCard
          title="Browsers"
          items={data.breakdowns.browsers.map((item) => ({
            label: item.browser,
            count: item.count,
            share: item.share
          }))}
        />
        <BreakdownCard
          title="Countries"
          items={data.breakdowns.countries.map((item) => ({
            label: countryName(item.countryCode),
            count: item.count,
            share: item.share
          }))}
        />
        <BreakdownCard
          title="Locales"
          items={data.breakdowns.locales.map((item) => ({
            label: localeName(item.locale),
            count: item.count,
            share: item.share
          }))}
        />
        <BreakdownCard
          title="Operating Systems"
          items={data.breakdowns.operatingSystems.map((item) => ({
            label: item.os,
            count: item.count,
            share: item.share
          }))}
        />
        <BreakdownCard
          title="Audience Languages"
          items={data.breakdowns.languages.map((item) => ({
            label: item.language,
            count: item.count,
            share: item.share
          }))}
          className="md:col-span-2 xl:col-span-3"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="card overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-base font-semibold">Top Pages</h3>
            <p className="text-sm text-muted-foreground">Pages ranked by view volume with reach and source breadth.</p>
          </div>
          <div className="overflow-x-auto">
            {data.reports.topPages.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No tracked pages yet.</div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Page</th>
                    <th className="px-4 py-3 font-medium">Views</th>
                    <th className="px-4 py-3 font-medium">Share</th>
                    <th className="px-4 py-3 font-medium">Change</th>
                    <th className="px-4 py-3 font-medium">Countries</th>
                    <th className="px-4 py-3 font-medium">Referrers</th>
                  </tr>
                </thead>
                <tbody>
                  {data.reports.topPages.map((item) => (
                    <TopPageRow key={item.path} item={item} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-base font-semibold">Top Referrers</h3>
            <p className="text-sm text-muted-foreground">External sites sending traffic during this window.</p>
          </div>
          <div className="overflow-x-auto">
            {data.reports.topReferrers.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No external referrer data yet.</div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Referrer</th>
                    <th className="px-4 py-3 font-medium">Views</th>
                    <th className="px-4 py-3 font-medium">Share</th>
                    <th className="px-4 py-3 font-medium">Change</th>
                    <th className="px-4 py-3 font-medium">Pages</th>
                  </tr>
                </thead>
                <tbody>
                  {data.reports.topReferrers.map((item) => (
                    <TopReferrerRow key={item.referrerHost} item={item} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      <p className="text-xs text-muted-foreground">
        Country lookup source: IPLocate IP address databases (
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
    </>
  );
}

function AnalyticsSelect({
  ariaLabel,
  value,
  onChange,
  options
}: {
  ariaLabel: string;
  value: string;
  onChange: (value: any) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function StatCard({
  label,
  value,
  delta,
  deltaTone,
  hint
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: string;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        {delta && <span className={`text-xs font-medium ${deltaTone || 'text-muted-foreground'}`}>{delta}</span>}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function HighlightCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-sm font-semibold text-foreground" title={value}>{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function TrafficTrendChart({ points }: { points: AnalyticsDailyPoint[] }) {
  const values = points.flatMap((point) => [point.count, point.previousCount]);
  const maxValue = Math.max(1, ...values);
  const width = 680;
  const height = 240;
  const paddingX = 24;
  const paddingY = 20;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;

  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">No pageview events recorded yet.</p>;
  }

  const buildLine = (counts: number[]) => counts.map((count, index) => {
    const x = paddingX + (counts.length === 1 ? innerWidth / 2 : (index / (counts.length - 1)) * innerWidth);
    const y = paddingY + innerHeight - (count / maxValue) * innerHeight;
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const currentLine = buildLine(points.map((point) => point.count));
  const previousLine = buildLine(points.map((point) => point.previousCount));
  const currentArea = `${currentLine} L ${paddingX + innerWidth} ${paddingY + innerHeight} L ${paddingX} ${paddingY + innerHeight} Z`;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/70 bg-muted/20 p-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" role="img" aria-label="Traffic trend chart">
          <defs>
            <linearGradient id="analyticsTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((step) => {
            const y = paddingY + innerHeight - innerHeight * step;
            return (
              <line
                key={step}
                x1={paddingX}
                x2={paddingX + innerWidth}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeOpacity="0.10"
              />
            );
          })}
          <path d={currentArea} fill="url(#analyticsTrendFill)" className="text-primary" />
          <path d={previousLine} fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity="0.45" strokeDasharray="6 6" />
          <path d={currentLine} fill="none" stroke="currentColor" strokeWidth="3" className="text-primary" />
        </svg>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
        <span>{formatDateLabel(points[0]?.date || '')}</span>
        <span className="text-center">{formatDateLabel(points[Math.floor(points.length / 2)]?.date || '')}</span>
        <span className="text-right">{formatDateLabel(points[points.length - 1]?.date || '')}</span>
      </div>
    </div>
  );
}

function ActivityHeatmap({ rows }: { rows: AnalyticsHeatmapRow[] }) {
  const maxValue = Math.max(0, ...rows.flatMap((row) => row.hours));

  if (rows.length === 0 || maxValue === 0) {
    return <p className="text-sm text-muted-foreground">No activity data recorded yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[48px_repeat(24,minmax(0,1fr))] gap-1 text-[10px] text-muted-foreground">
            <div />
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="text-center">
                {hour}
              </div>
            ))}
          </div>
          <div className="mt-2 space-y-1.5">
            {rows.map((row) => (
              <div key={row.label} className="grid grid-cols-[48px_repeat(24,minmax(0,1fr))] gap-1">
                <div className="flex items-center text-xs text-muted-foreground">{row.label}</div>
                {row.hours.map((count, hour) => (
                  <div
                    key={`${row.label}-${hour}`}
                    className={`h-6 rounded-sm border border-border/50 ${heatToneClass(count, maxValue)}`}
                    title={`${row.label} ${hourLabel(hour)} • ${numberFmt.format(count)} views`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Lower activity</span>
        <div className="flex items-center gap-1">
          {[0.15, 0.35, 0.55, 0.8].map((step) => (
            <span key={step} className={`h-3 w-6 rounded-sm border border-border/50 ${heatToneClass(step * maxValue, maxValue)}`} />
          ))}
        </div>
        <span>Higher activity</span>
      </div>
    </div>
  );
}

function BreakdownCard({
  title,
  items,
  className
}: {
  title: string;
  items: { label: string; count: number; share: number }[];
  className?: string;
}) {
  return (
    <section className={`card p-4 space-y-3 ${className || ''}`.trim()}>
      <h3 className="text-base font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data in this window.</p>
      ) : (
        <div className="space-y-2.5">
          {items.slice(0, 8).map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-foreground" title={item.label}>{item.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {numberFmt.format(item.count)} • {formatPercent(item.share)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(item.share * 100, item.count > 0 ? 4 : 0)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TopPageRow({ item }: { item: AnalyticsTopPath }) {
  return (
    <tr className="border-t border-border/70 align-top">
      <td className="px-4 py-3">
        <a href={item.path} target="_blank" rel="noreferrer" className="font-medium text-foreground underline-offset-2 hover:underline">
          {item.path}
        </a>
        <p className="mt-1 text-xs text-muted-foreground">{item.title}</p>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{numberFmt.format(item.count)}</td>
      <td className="px-4 py-3 text-muted-foreground">{formatPercent(item.share)}</td>
      <td className={`px-4 py-3 font-medium ${deltaToneClass(item.count, item.previousCount)}`}>{deltaText(item.count, item.previousCount)}</td>
      <td className="px-4 py-3 text-muted-foreground">{numberFmt.format(item.uniqueCountries)}</td>
      <td className="px-4 py-3 text-muted-foreground">{numberFmt.format(item.uniqueReferrers)}</td>
    </tr>
  );
}

function TopReferrerRow({ item }: { item: AnalyticsTopReferrer }) {
  return (
    <tr className="border-t border-border/70 align-top">
      <td className="px-4 py-3 font-medium text-foreground">{item.referrerHost}</td>
      <td className="px-4 py-3 text-muted-foreground">{numberFmt.format(item.count)}</td>
      <td className="px-4 py-3 text-muted-foreground">{formatPercent(item.share)}</td>
      <td className={`px-4 py-3 font-medium ${deltaToneClass(item.count, item.previousCount)}`}>{deltaText(item.count, item.previousCount)}</td>
      <td className="px-4 py-3 text-muted-foreground">{numberFmt.format(item.uniquePaths)}</td>
    </tr>
  );
}

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function heatToneClass(value: number, maxValue: number) {
  if (value <= 0 || maxValue <= 0) return 'bg-muted/35';
  const ratio = value / maxValue;
  if (ratio >= 0.8) return 'bg-primary';
  if (ratio >= 0.55) return 'bg-primary/75';
  if (ratio >= 0.35) return 'bg-primary/55';
  return 'bg-primary/30';
}
