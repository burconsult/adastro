import type { DeviceType } from '@/lib/analytics/user-agent';
import type { SiteLocaleConfig } from '@/lib/site-config';
import { normalizeLocaleCode } from '@/lib/i18n/locales';

export type AnalyticsRow = {
  created_at?: string | null;
  data?: Record<string, unknown> | null;
};

export type AnalyticsTrafficFilter = 'all' | 'human' | 'bot';
export type AnalyticsSourceType = 'direct' | 'internal' | 'external';
export type AnalyticsDeviceType = DeviceType | 'unknown';

export type AnalyticsBreakdownBase = {
  count: number;
  share: number;
};

export type AnalyticsLocaleBreakdown = AnalyticsBreakdownBase & {
  locale: string;
};

export type AnalyticsCountryBreakdown = AnalyticsBreakdownBase & {
  countryCode: string;
};

export type AnalyticsDeviceBreakdown = AnalyticsBreakdownBase & {
  deviceType: AnalyticsDeviceType;
};

export type AnalyticsBrowserBreakdown = AnalyticsBreakdownBase & {
  browser: string;
};

export type AnalyticsOsBreakdown = AnalyticsBreakdownBase & {
  os: string;
};

export type AnalyticsLanguageBreakdown = AnalyticsBreakdownBase & {
  language: string;
};

export type AnalyticsSourceBreakdown = AnalyticsBreakdownBase & {
  sourceType: AnalyticsSourceType;
};

export type AnalyticsDailyPoint = {
  date: string;
  count: number;
  previousCount: number;
  humanCount: number;
  botCount: number;
};

export type AnalyticsWeekdayPoint = {
  label: string;
  count: number;
};

export type AnalyticsHourlyPoint = {
  hour: number;
  count: number;
};

export type AnalyticsHeatmapRow = {
  label: string;
  weekday: number;
  hours: number[];
};

export type AnalyticsTopPath = {
  path: string;
  title: string;
  count: number;
  previousCount: number;
  share: number;
  averageDailyViews: number;
  uniqueCountries: number;
  uniqueReferrers: number;
};

export type AnalyticsTopReferrer = {
  referrerHost: string;
  count: number;
  previousCount: number;
  share: number;
  uniquePaths: number;
};

export type AnalyticsReport = {
  windowDays: number;
  filters: {
    selectedLocale: string;
    selectedCountryCode: string;
    selectedDeviceType: string;
    selectedBrowser: string;
    selectedTrafficType: AnalyticsTrafficFilter;
    availableLocales: string[];
    availableCountries: string[];
    availableDeviceTypes: string[];
    availableBrowsers: string[];
  };
  totals: {
    totalPageViews: number;
    previousWindowPageViews: number;
    todayPageViews: number;
    uniquePaths: number;
    uniqueCountries: number;
    uniqueReferrers: number;
    averageDailyViews: number;
    humanViews: number;
    botViews: number;
    directViews: number;
    internalViews: number;
    externalViews: number;
  };
  highlights: {
    bestDay: { date: string; count: number } | null;
    topPage: { path: string; title: string; count: number } | null;
    topReferrer: { referrerHost: string; count: number } | null;
    topCountry: { countryCode: string; count: number } | null;
    peakHour: { hour: number; count: number } | null;
  };
  series: {
    daily: AnalyticsDailyPoint[];
    weekdays: AnalyticsWeekdayPoint[];
    hourly: AnalyticsHourlyPoint[];
    heatmap: AnalyticsHeatmapRow[];
  };
  breakdowns: {
    locales: AnalyticsLocaleBreakdown[];
    countries: AnalyticsCountryBreakdown[];
    devices: AnalyticsDeviceBreakdown[];
    browsers: AnalyticsBrowserBreakdown[];
    operatingSystems: AnalyticsOsBreakdown[];
    languages: AnalyticsLanguageBreakdown[];
    sources: AnalyticsSourceBreakdown[];
  };
  reports: {
    topPages: AnalyticsTopPath[];
    topReferrers: AnalyticsTopReferrer[];
  };
};

type AnalyticsNormalizedEvent = {
  createdAt: string;
  dateKey: string;
  weekday: number;
  hour: number;
  path: string;
  title: string;
  locale: string;
  countryCode: string;
  deviceType: AnalyticsDeviceType;
  browser: string;
  os: string;
  language: string;
  referrerHost: string;
  sourceType: AnalyticsSourceType;
  isBot: boolean;
};

type AnalyticsFilters = {
  locale?: string;
  countryCode?: string;
  deviceType?: AnalyticsDeviceType;
  browser?: string;
  trafficType?: AnalyticsTrafficFilter;
};

type BuildAnalyticsReportInput = {
  currentRows: AnalyticsRow[];
  previousRows: AnalyticsRow[];
  days: number;
  localeConfig: SiteLocaleConfig;
  siteHost?: string;
  selectedLocale?: string;
  selectedCountryCode?: string;
  selectedDeviceType?: AnalyticsDeviceType;
  selectedBrowser?: string;
  selectedTrafficType?: AnalyticsTrafficFilter;
  now?: Date;
};

const DEVICE_TYPES = new Set<AnalyticsDeviceType>(['desktop', 'mobile', 'tablet', 'bot', 'other', 'unknown']);
const WEEKDAY_ORDER = [
  { label: 'Mon', day: 1 },
  { label: 'Tue', day: 2 },
  { label: 'Wed', day: 3 },
  { label: 'Thu', day: 4 },
  { label: 'Fri', day: 5 },
  { label: 'Sat', day: 6 },
  { label: 'Sun', day: 0 }
] as const;

const normalizeCountryCode = (value: unknown): string => {
  if (typeof value !== 'string') return 'ZZ';
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : 'ZZ';
};

const normalizeDeviceType = (value: unknown): AnalyticsDeviceType => {
  if (typeof value !== 'string') return 'unknown';
  const normalized = value.trim().toLowerCase() as AnalyticsDeviceType;
  return DEVICE_TYPES.has(normalized) ? normalized : 'unknown';
};

const normalizeNamedDimension = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().slice(0, 80);
  return normalized.length > 0 ? normalized : fallback;
};

const normalizeLanguage = (value: unknown): string => {
  if (typeof value !== 'string') return 'Unknown';
  const normalized = value.trim().slice(0, 32);
  return normalized.length > 0 ? normalized : 'Unknown';
};

const normalizePath = (value: unknown): string => {
  if (typeof value !== 'string') return '/';
  const normalized = value.trim().slice(0, 255);
  return normalized.startsWith('/') ? normalized : '/';
};

const normalizeHost = (value?: string): string => (
  (value || '').trim().toLowerCase().replace(/^www\./, '')
);

const categorizeSource = (referrerHost: string, siteHost: string): AnalyticsSourceType => {
  if (!referrerHost) return 'direct';
  return normalizeHost(referrerHost) === normalizeHost(siteHost) ? 'internal' : 'external';
};

const extractLocaleFromPath = (pathname: string, locales: string[], defaultLocale: string): string => {
  const match = /^\/([a-z]{2}(?:-[a-z]{2})?)(?:\/|$)/i.exec(pathname || '');
  if (!match) return defaultLocale;
  const localeCandidate = normalizeLocaleCode(match[1], defaultLocale);
  return locales.includes(localeCandidate) ? localeCandidate : defaultLocale;
};

const startOfUtcDay = (value: Date): Date => (
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
);

const addUtcDays = (value: Date, days: number): Date => {
  const copy = new Date(value);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
};

const toDateKey = (value: Date): string => value.toISOString().slice(0, 10);

const buildWindowDateKeys = (days: number, now: Date) => {
  const end = startOfUtcDay(now);
  const start = addUtcDays(end, -(days - 1));
  return Array.from({ length: days }, (_, index) => toDateKey(addUtcDays(start, index)));
};

const increment = <T extends string | number>(source: Map<T, number>, key: T, amount = 1) => {
  source.set(key, (source.get(key) || 0) + amount);
};

const mapBreakdown = <K extends string, KeyName extends string>(
  source: Map<K, number>,
  total: number,
  keyName: KeyName
): Array<Record<KeyName, K> & AnalyticsBreakdownBase> => (
  [...source.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .map(([key, count]) => ({
      [keyName]: key,
      count,
      share: total > 0 ? count / total : 0
    })) as Array<Record<KeyName, K> & AnalyticsBreakdownBase>
);

const normalizeTrafficType = (value?: string | null): AnalyticsTrafficFilter => {
  if (value === 'human' || value === 'bot') return value;
  return 'all';
};

const matchesFilters = (event: AnalyticsNormalizedEvent, filters: AnalyticsFilters): boolean => {
  if (filters.locale && event.locale !== filters.locale) return false;
  if (filters.countryCode && event.countryCode !== filters.countryCode) return false;
  if (filters.deviceType && event.deviceType !== filters.deviceType) return false;
  if (filters.browser && event.browser !== filters.browser) return false;
  if (filters.trafficType === 'human' && event.isBot) return false;
  if (filters.trafficType === 'bot' && !event.isBot) return false;
  return true;
};

const withoutFilter = (filters: AnalyticsFilters, key: keyof AnalyticsFilters): AnalyticsFilters => {
  const next = { ...filters };
  delete next[key];
  return next;
};

const normalizeRows = ({
  rows,
  localeConfig,
  siteHost
}: {
  rows: AnalyticsRow[];
  localeConfig: SiteLocaleConfig;
  siteHost: string;
}): AnalyticsNormalizedEvent[] => (
  rows.flatMap((row) => {
    const createdAt = typeof row.created_at === 'string' ? row.created_at : '';
    if (!createdAt) return [];

    const parsedDate = new Date(createdAt);
    if (Number.isNaN(parsedDate.getTime())) return [];

    const path = normalizePath(row.data?.path);
    return [{
      createdAt,
      dateKey: createdAt.slice(0, 10),
      weekday: parsedDate.getUTCDay(),
      hour: parsedDate.getUTCHours(),
      path,
      title: normalizeNamedDimension(row.data?.title, path),
      locale: extractLocaleFromPath(path, localeConfig.locales, localeConfig.defaultLocale),
      countryCode: normalizeCountryCode(row.data?.countryCode),
      deviceType: normalizeDeviceType(row.data?.deviceType),
      browser: normalizeNamedDimension(row.data?.browser, 'Unknown'),
      os: normalizeNamedDimension(row.data?.os, 'Unknown'),
      language: normalizeLanguage(row.data?.language),
      referrerHost: normalizeNamedDimension(row.data?.referrerHost, ''),
      sourceType: categorizeSource(normalizeNamedDimension(row.data?.referrerHost, ''), siteHost),
      isBot: row.data?.isBot === true
    }];
  })
);

export const buildAnalyticsReport = ({
  currentRows,
  previousRows,
  days,
  localeConfig,
  siteHost = '',
  selectedLocale,
  selectedCountryCode,
  selectedDeviceType,
  selectedBrowser,
  selectedTrafficType = 'all',
  now = new Date()
}: BuildAnalyticsReportInput): AnalyticsReport => {
  const currentEvents = normalizeRows({ rows: currentRows, localeConfig, siteHost });
  const previousEvents = normalizeRows({ rows: previousRows, localeConfig, siteHost });

  const filters: AnalyticsFilters = {
    locale: selectedLocale,
    countryCode: selectedCountryCode,
    deviceType: selectedDeviceType,
    browser: selectedBrowser,
    trafficType: normalizeTrafficType(selectedTrafficType)
  };

  const availableLocales = mapBreakdown(
    currentEvents
      .filter((event) => matchesFilters(event, withoutFilter(filters, 'locale')))
      .reduce((map, event) => {
        increment(map, event.locale);
        return map;
      }, new Map<string, number>()),
    currentEvents.filter((event) => matchesFilters(event, withoutFilter(filters, 'locale'))).length,
    'locale'
  ).map((item) => item.locale);

  const availableCountries = mapBreakdown(
    currentEvents
      .filter((event) => matchesFilters(event, withoutFilter(filters, 'countryCode')))
      .reduce((map, event) => {
        increment(map, event.countryCode);
        return map;
      }, new Map<string, number>()),
    currentEvents.filter((event) => matchesFilters(event, withoutFilter(filters, 'countryCode'))).length,
    'countryCode'
  ).map((item) => item.countryCode);

  const availableDeviceTypes = mapBreakdown(
    currentEvents
      .filter((event) => matchesFilters(event, withoutFilter(filters, 'deviceType')))
      .reduce((map, event) => {
        increment(map, event.deviceType);
        return map;
      }, new Map<AnalyticsDeviceType, number>()),
    currentEvents.filter((event) => matchesFilters(event, withoutFilter(filters, 'deviceType'))).length,
    'deviceType'
  ).map((item) => item.deviceType);

  const availableBrowsers = mapBreakdown(
    currentEvents
      .filter((event) => matchesFilters(event, withoutFilter(filters, 'browser')))
      .reduce((map, event) => {
        increment(map, event.browser);
        return map;
      }, new Map<string, number>()),
    currentEvents.filter((event) => matchesFilters(event, withoutFilter(filters, 'browser'))).length,
    'browser'
  ).map((item) => item.browser);

  const filteredEvents = currentEvents.filter((event) => matchesFilters(event, filters));
  const previousFilteredEvents = previousEvents.filter((event) => matchesFilters(event, filters));
  const totalPageViews = filteredEvents.length;

  const dateKeys = buildWindowDateKeys(days, now);
  const previousDateKeys = buildWindowDateKeys(days, addUtcDays(now, -days));
  const dailyMap = new Map<string, number>();
  const dailyHumanMap = new Map<string, number>();
  const dailyBotMap = new Map<string, number>();
  const previousDailyMap = new Map<string, number>();
  const weekdayMap = new Map<number, number>();
  const hourlyMap = new Map<number, number>();
  const heatmap = new Map<number, number[]>();
  const localeMap = new Map<string, number>();
  const countryMap = new Map<string, number>();
  const deviceMap = new Map<AnalyticsDeviceType, number>();
  const browserMap = new Map<string, number>();
  const osMap = new Map<string, number>();
  const languageMap = new Map<string, number>();
  const sourceMap = new Map<AnalyticsSourceType, number>();
  const uniquePaths = new Set<string>();
  const uniqueCountries = new Set<string>();
  const uniqueReferrers = new Set<string>();
  const topPageMap = new Map<string, {
    path: string;
    title: string;
    count: number;
    previousCount: number;
    countries: Set<string>;
    referrers: Set<string>;
  }>();
  const topReferrerMap = new Map<string, {
    referrerHost: string;
    count: number;
    previousCount: number;
    paths: Set<string>;
  }>();

  for (const weekday of WEEKDAY_ORDER) {
    heatmap.set(weekday.day, Array.from({ length: 24 }, () => 0));
  }

  for (const event of filteredEvents) {
    increment(dailyMap, event.dateKey);
    increment(event.isBot ? dailyBotMap : dailyHumanMap, event.dateKey);
    increment(weekdayMap, event.weekday);
    increment(hourlyMap, event.hour);
    increment(localeMap, event.locale);
    increment(countryMap, event.countryCode);
    increment(deviceMap, event.deviceType);
    increment(browserMap, event.browser);
    increment(osMap, event.os);
    increment(languageMap, event.language);
    increment(sourceMap, event.sourceType);

    const heatmapRow = heatmap.get(event.weekday);
    if (heatmapRow) {
      heatmapRow[event.hour] = (heatmapRow[event.hour] || 0) + 1;
    }

    uniquePaths.add(event.path);
    if (event.countryCode !== 'ZZ') {
      uniqueCountries.add(event.countryCode);
    }
    if (event.sourceType === 'external' && event.referrerHost) {
      uniqueReferrers.add(event.referrerHost);
    }

    const pageEntry = topPageMap.get(event.path) || {
      path: event.path,
      title: event.title,
      count: 0,
      previousCount: 0,
      countries: new Set<string>(),
      referrers: new Set<string>()
    };
    pageEntry.count += 1;
    if (!pageEntry.title && event.title) {
      pageEntry.title = event.title;
    }
    if (event.countryCode !== 'ZZ') {
      pageEntry.countries.add(event.countryCode);
    }
    if (event.sourceType === 'external' && event.referrerHost) {
      pageEntry.referrers.add(event.referrerHost);
    }
    topPageMap.set(event.path, pageEntry);

    if (event.sourceType === 'external' && event.referrerHost) {
      const referrerEntry = topReferrerMap.get(event.referrerHost) || {
        referrerHost: event.referrerHost,
        count: 0,
        previousCount: 0,
        paths: new Set<string>()
      };
      referrerEntry.count += 1;
      referrerEntry.paths.add(event.path);
      topReferrerMap.set(event.referrerHost, referrerEntry);
    }
  }

  for (const event of previousFilteredEvents) {
    increment(previousDailyMap, event.dateKey);

    const pageEntry = topPageMap.get(event.path);
    if (pageEntry) {
      pageEntry.previousCount += 1;
    }

    if (event.sourceType === 'external' && event.referrerHost) {
      const referrerEntry = topReferrerMap.get(event.referrerHost);
      if (referrerEntry) {
        referrerEntry.previousCount += 1;
      }
    }
  }

  const todayKey = toDateKey(startOfUtcDay(now));
  const daily = dateKeys.map((date, index) => ({
    date,
    count: dailyMap.get(date) || 0,
    previousCount: previousDailyMap.get(previousDateKeys[index] || '') || 0,
    humanCount: dailyHumanMap.get(date) || 0,
    botCount: dailyBotMap.get(date) || 0
  }));

  const weekdays = WEEKDAY_ORDER.map(({ label, day }) => ({
    label,
    count: weekdayMap.get(day) || 0
  }));

  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: hourlyMap.get(hour) || 0
  }));

  const heatmapRows = WEEKDAY_ORDER.map(({ label, day }) => ({
    label,
    weekday: day,
    hours: heatmap.get(day) || Array.from({ length: 24 }, () => 0)
  }));

  const localeBreakdown = mapBreakdown(localeMap, totalPageViews, 'locale') as AnalyticsLocaleBreakdown[];
  const countryBreakdown = mapBreakdown(countryMap, totalPageViews, 'countryCode') as AnalyticsCountryBreakdown[];
  const deviceBreakdown = mapBreakdown(deviceMap, totalPageViews, 'deviceType') as AnalyticsDeviceBreakdown[];
  const browserBreakdown = mapBreakdown(browserMap, totalPageViews, 'browser') as AnalyticsBrowserBreakdown[];
  const osBreakdown = mapBreakdown(osMap, totalPageViews, 'os') as AnalyticsOsBreakdown[];
  const languageBreakdown = mapBreakdown(languageMap, totalPageViews, 'language') as AnalyticsLanguageBreakdown[];
  const sourceBreakdown = mapBreakdown(sourceMap, totalPageViews, 'sourceType') as AnalyticsSourceBreakdown[];

  const topPages = [...topPageMap.values()]
    .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path))
    .slice(0, 12)
    .map((item) => ({
      path: item.path,
      title: item.title || item.path,
      count: item.count,
      previousCount: item.previousCount,
      share: totalPageViews > 0 ? item.count / totalPageViews : 0,
      averageDailyViews: item.count / Math.max(days, 1),
      uniqueCountries: item.countries.size,
      uniqueReferrers: item.referrers.size
    }));

  const topReferrers = [...topReferrerMap.values()]
    .sort((a, b) => b.count - a.count || a.referrerHost.localeCompare(b.referrerHost))
    .slice(0, 12)
    .map((item) => ({
      referrerHost: item.referrerHost,
      count: item.count,
      previousCount: item.previousCount,
      share: totalPageViews > 0 ? item.count / totalPageViews : 0,
      uniquePaths: item.paths.size
    }));

  const bestDayCandidate = daily.reduce<{ date: string; count: number } | null>((best, point) => {
    if (!best || point.count > best.count) {
      return { date: point.date, count: point.count };
    }
    return best;
  }, null);

  const peakHourCandidate = hourly.reduce<{ hour: number; count: number } | null>((best, point) => {
    if (!best || point.count > best.count) {
      return { hour: point.hour, count: point.count };
    }
    return best;
  }, null);

  const totalHumanViews = filteredEvents.filter((event) => !event.isBot).length;
  const totalBotViews = filteredEvents.filter((event) => event.isBot).length;
  const directViews = filteredEvents.filter((event) => event.sourceType === 'direct').length;
  const internalViews = filteredEvents.filter((event) => event.sourceType === 'internal').length;
  const externalViews = filteredEvents.filter((event) => event.sourceType === 'external').length;

  return {
    windowDays: days,
    filters: {
      selectedLocale: selectedLocale || 'all',
      selectedCountryCode: selectedCountryCode || 'all',
      selectedDeviceType: selectedDeviceType || 'all',
      selectedBrowser: selectedBrowser || 'all',
      selectedTrafficType: normalizeTrafficType(selectedTrafficType),
      availableLocales,
      availableCountries,
      availableDeviceTypes,
      availableBrowsers
    },
    totals: {
      totalPageViews,
      previousWindowPageViews: previousFilteredEvents.length,
      todayPageViews: dailyMap.get(todayKey) || 0,
      uniquePaths: uniquePaths.size,
      uniqueCountries: uniqueCountries.size,
      uniqueReferrers: uniqueReferrers.size,
      averageDailyViews: totalPageViews / Math.max(days, 1),
      humanViews: totalHumanViews,
      botViews: totalBotViews,
      directViews,
      internalViews,
      externalViews
    },
    highlights: {
      bestDay: totalPageViews > 0 ? bestDayCandidate : null,
      topPage: topPages[0] ? { path: topPages[0].path, title: topPages[0].title, count: topPages[0].count } : null,
      topReferrer: topReferrers[0] ? { referrerHost: topReferrers[0].referrerHost, count: topReferrers[0].count } : null,
      topCountry: countryBreakdown[0] ? { countryCode: countryBreakdown[0].countryCode, count: countryBreakdown[0].count } : null,
      peakHour: totalPageViews > 0 ? peakHourCandidate : null
    },
    series: {
      daily,
      weekdays,
      hourly,
      heatmap: heatmapRows
    },
    breakdowns: {
      locales: localeBreakdown,
      countries: countryBreakdown,
      devices: deviceBreakdown,
      browsers: browserBreakdown,
      operatingSystems: osBreakdown,
      languages: languageBreakdown,
      sources: sourceBreakdown
    },
    reports: {
      topPages,
      topReferrers
    }
  };
};

export const getAnalyticsWindowRange = (days: number, now = new Date()) => {
  const currentEndExclusive = addUtcDays(startOfUtcDay(now), 1);
  const currentStartInclusive = addUtcDays(currentEndExclusive, -days);
  const previousStartInclusive = addUtcDays(currentStartInclusive, -days);

  return {
    currentStartInclusive,
    currentEndExclusive,
    previousStartInclusive,
    previousEndExclusive: currentStartInclusive
  };
};
