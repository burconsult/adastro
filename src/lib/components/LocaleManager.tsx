import React, { startTransition, useEffect, useState } from 'react';
import { ToastProvider, useToast } from '@/lib/components/ui/toast';
import { AdminLoadingState } from '@/lib/components/admin/ListingPrimitives';

type FeatureStatus = {
  featureId: string;
  status: 'ok' | 'fallback' | 'version-mismatch' | 'missing-en';
  hasLocalePack: boolean;
  usesEnglishFallback: boolean;
  messageCount: number;
  missingKeys: string[];
};

type LocaleStatus = {
  locale: string;
  displayName: string;
  isActive: boolean;
  isDefault: boolean;
  hasCorePack: boolean;
  canActivate: boolean;
  coreStatus: 'ok' | 'version-mismatch' | 'missing';
  coreMessageCount: number;
  missingCoreKeys: string[];
  features: FeatureStatus[];
};

type Payload = {
  catalogVersion: string;
  schemaVersion: string;
  defaultLocale: string;
  activeLocales: string[];
  availableLocales: string[];
  activatableLocales: string[];
  siteIdentityByLocale: {
    title: Record<string, string>;
    description: Record<string, string>;
    tagline: Record<string, string>;
  };
  locales: LocaleStatus[];
};

function LocaleManagerInner() {
  const { toast } = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeLocales, setActiveLocales] = useState<string[]>([]);
  const [defaultLocale, setDefaultLocale] = useState('en');
  const [siteIdentityByLocale, setSiteIdentityByLocale] = useState<Payload['siteIdentityByLocale']>({
    title: {},
    description: {},
    tagline: {}
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/admin/locales');
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load locale inventory');
        }
        if (cancelled) return;
        setData(payload as Payload);
        setActiveLocales((payload?.activeLocales || []) as string[]);
        setDefaultLocale(String(payload?.defaultLocale || 'en'));
        setSiteIdentityByLocale((payload?.siteIdentityByLocale || {
          title: {},
          description: {},
          tagline: {}
        }) as Payload['siteIdentityByLocale']);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load locale inventory');
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
  }, []);

  const syncFromPayload = (payload: Payload) => {
    setData(payload);
    setActiveLocales(payload.activeLocales);
    setDefaultLocale(payload.defaultLocale);
    setSiteIdentityByLocale(payload.siteIdentityByLocale);
  };

  const toggleLocale = (locale: string, enabled: boolean) => {
    startTransition(() => {
      setActiveLocales((current) => {
        const next = enabled
          ? Array.from(new Set([...current, locale]))
          : current.filter((entry) => entry !== locale);
        if (!next.includes(defaultLocale)) {
          const fallbackDefault = next[0] || locale;
          setDefaultLocale(fallbackDefault);
        }
        return next;
      });
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const response = await fetch('/api/admin/locales', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeLocales, defaultLocale, siteIdentityByLocale })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save locale configuration');
      }
      syncFromPayload(payload as Payload);
      toast({
        variant: 'success',
        title: 'Locales updated',
        description: 'Locale activation and default locale settings were saved.'
      });
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to save locale configuration';
      setError(message);
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: message
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AdminLoadingState label="Loading locales..." className="p-8" />;
  }

  if (error && !data) {
    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const localesByCode = new Map(data.locales.map((entry) => [entry.locale, entry] as const));
  const activeLocaleEntries = activeLocales
    .map((locale) => localesByCode.get(locale))
    .filter((entry): entry is LocaleStatus => Boolean(entry));

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Locale Configuration</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Admin stays English-only. This page controls public locale activation and shows translation pack health.
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Catalog v{data.catalogVersion} • Schema v{data.schemaVersion}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-xl border border-border/60 bg-background p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active locales</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {activeLocaleEntries.length > 0 ? activeLocaleEntries.map((locale) => (
                <span
                  key={locale.locale}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                    locale.locale === defaultLocale
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {locale.locale.toUpperCase()} • {locale.displayName}
                </span>
              )) : (
                <span className="text-sm text-muted-foreground">No locales selected.</span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background p-4">
            <label htmlFor="default-locale" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Default public locale
            </label>
            <select
              id="default-locale"
              value={defaultLocale}
              onChange={(event) => setDefaultLocale(event.target.value)}
              className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {activeLocaleEntries.map((locale) => (
                <option key={locale.locale} value={locale.locale}>
                  {locale.locale.toUpperCase()} • {locale.displayName}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-muted-foreground">
              Unprefixed public URLs redirect to this locale.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-background p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-foreground">Localized site identity</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Optional per-locale overrides for the public title, description, and tagline.
            </p>
          </div>
          <div className="space-y-4">
            {activeLocaleEntries.map((locale) => (
              <div key={locale.locale} className="rounded-lg border border-border/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {locale.displayName} ({locale.locale.toUpperCase()})
                </p>
                <div className="mt-3 grid gap-3">
                  <input
                    type="text"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Localized title"
                    value={siteIdentityByLocale.title[locale.locale] || ''}
                    onChange={(event) => setSiteIdentityByLocale((current) => ({
                      ...current,
                      title: { ...current.title, [locale.locale]: event.target.value }
                    }))}
                  />
                  <textarea
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Localized description"
                    value={siteIdentityByLocale.description[locale.locale] || ''}
                    onChange={(event) => setSiteIdentityByLocale((current) => ({
                      ...current,
                      description: { ...current.description, [locale.locale]: event.target.value }
                    }))}
                  />
                  <input
                    type="text"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Localized tagline"
                    value={siteIdentityByLocale.tagline[locale.locale] || ''}
                    onChange={(event) => setSiteIdentityByLocale((current) => ({
                      ...current,
                      tagline: { ...current.tagline, [locale.locale]: event.target.value }
                    }))}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            A locale can only be activated when a core language pack exists. Feature packs may fall back to English and will be flagged below.
          </p>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || activeLocales.length === 0}>
            {saving ? 'Saving...' : 'Save locale settings'}
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {data.locales.map((locale) => {
          const fallbackCount = locale.features.filter((feature) => feature.status === 'fallback').length;
          const mismatchCount = locale.features.filter((feature) => feature.status === 'version-mismatch').length;
          return (
            <article key={locale.locale} className="card p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">{locale.displayName}</h3>
                    <span className="rounded-md border border-border/70 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                      {locale.locale.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {locale.isActive ? 'Active on the public site.' : locale.canActivate ? 'Available but inactive.' : 'Cannot be activated until a core pack exists.'}
                  </p>
                </div>
                <label className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                  locale.isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                }`}>
                  <input
                    type="checkbox"
                    className="rounded border-input"
                    checked={activeLocales.includes(locale.locale)}
                    disabled={!locale.canActivate}
                    onChange={(event) => toggleLocale(locale.locale, event.target.checked)}
                  />
                  {activeLocales.includes(locale.locale) ? 'Active' : 'Inactive'}
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <StatusPill
                  label="Core pack"
                  tone={locale.coreStatus === 'ok' ? 'success' : locale.coreStatus === 'version-mismatch' ? 'warning' : 'danger'}
                  body={locale.coreStatus === 'ok'
                    ? `${locale.coreMessageCount} strings`
                    : locale.coreStatus === 'version-mismatch'
                      ? 'Version mismatch'
                      : 'Missing core pack'}
                />
                <StatusPill
                  label="Feature fallbacks"
                  tone={fallbackCount === 0 ? 'success' : 'warning'}
                  body={fallbackCount === 0 ? 'No English fallback in use' : `${fallbackCount} fallback scope${fallbackCount === 1 ? '' : 's'}`}
                />
                <StatusPill
                  label="Version sync"
                  tone={mismatchCount === 0 ? 'success' : 'warning'}
                  body={mismatchCount === 0 ? 'In sync' : `${mismatchCount} feature mismatch${mismatchCount === 1 ? '' : 'es'}`}
                />
              </div>

              {locale.missingCoreKeys.length > 0 && (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-foreground">
                  Core pack is missing {locale.missingCoreKeys.length} key{locale.missingCoreKeys.length === 1 ? '' : 's'} compared with English.
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Feature locale packs</p>
                <div className="space-y-2">
                  {locale.features.map((feature) => (
                    <div key={`${locale.locale}-${feature.featureId}`} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium text-foreground">{feature.featureId}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {feature.messageCount} strings
                        </span>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        feature.status === 'ok'
                          ? 'bg-success/10 text-success'
                          : feature.status === 'fallback'
                            ? 'bg-warning/10 text-warning'
                            : 'bg-destructive/10 text-destructive'
                      }`}>
                        {feature.status === 'fallback'
                          ? 'English fallback'
                          : feature.status === 'version-mismatch'
                            ? 'Version mismatch'
                            : feature.status === 'missing-en'
                              ? 'Missing English pack'
                              : 'Ready'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function StatusPill(props: { label: string; body: string; tone: 'success' | 'warning' | 'danger' }) {
  const toneClass = props.tone === 'success'
    ? 'border-success/30 bg-success/10 text-success'
    : props.tone === 'warning'
      ? 'border-warning/30 bg-warning/10 text-warning'
      : 'border-destructive/30 bg-destructive/10 text-destructive';

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide">{props.label}</p>
      <p className="mt-1 text-sm font-medium">{props.body}</p>
    </div>
  );
}

export default function LocaleManager() {
  return (
    <ToastProvider>
      <LocaleManagerInner />
    </ToastProvider>
  );
}
