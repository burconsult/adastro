import React from 'react';
import { AdminLoadingState } from '@/lib/components/admin/ListingPrimitives';

type TopPath = { path: string; count: number };
type DailyPoint = { date: string; count: number };
type Payload = {
  windowDays: number;
  totalPageViews: number;
  previousWindowPageViews: number;
  uniquePaths: number;
  todayPageViews: number;
  topPaths: TopPath[];
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
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<Payload | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/admin/analytics?days=${days}`);
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
  }, [days]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Lightweight first-party pageview analytics (no cookies, JavaScript-based tracking).
        </p>
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
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Page Views (${data.windowDays}d)`} value={numberFmt.format(data.totalPageViews)} hint={`vs previous ${data.windowDays}d: ${deltaText(data.totalPageViews, data.previousWindowPageViews)}`} />
        <StatCard label="Today" value={numberFmt.format(data.todayPageViews)} />
        <StatCard label="Unique Pages" value={numberFmt.format(data.uniquePaths)} />
        <StatCard label="Previous Window" value={numberFmt.format(data.previousWindowPageViews)} />
      </div>

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

