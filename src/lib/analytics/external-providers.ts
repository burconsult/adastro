const PRIVATE_ANALYTICS_PREFIXES = ['/admin', '/auth', '/api', '/setup', '/profile', '/mcp'];

export const EXTERNAL_ANALYTICS_SETTING_KEY = 'analytics.externalProviders';

export type GoogleTagAnalyticsSettings = {
  enabled: boolean;
  tagId: string;
};

export type PlausibleAnalyticsSettings = {
  enabled: boolean;
  snippetHtml: string;
};

export type UmamiAnalyticsSettings = {
  enabled: boolean;
  scriptUrl: string;
  websiteId: string;
  hostUrl: string;
  domains: string;
  doNotTrack: boolean;
  trackWebVitals: boolean;
};

export type FathomAnalyticsSettings = {
  enabled: boolean;
  siteId: string;
  honorDnt: boolean;
};

export type ExternalAnalyticsSettingsState = {
  googleTag: GoogleTagAnalyticsSettings;
  plausible: PlausibleAnalyticsSettings;
  umami: UmamiAnalyticsSettings;
  fathom: FathomAnalyticsSettings;
};

export const EXTERNAL_ANALYTICS_DOCS = {
  googleTag: 'https://developers.google.com/tag-platform/gtagjs',
  plausible: 'https://plausible.io/docs/script-update-guide',
  umami: 'https://docs.umami.is/docs/collect-data',
  fathom: 'https://usefathom.com/docs/script/embed'
} as const;

export const DEFAULT_EXTERNAL_ANALYTICS_SETTINGS_STATE: ExternalAnalyticsSettingsState = {
  googleTag: {
    enabled: false,
    tagId: ''
  },
  plausible: {
    enabled: false,
    snippetHtml: ''
  },
  umami: {
    enabled: false,
    scriptUrl: 'https://cloud.umami.is/script.js',
    websiteId: '',
    hostUrl: '',
    domains: '',
    doNotTrack: true,
    trackWebVitals: false
  },
  fathom: {
    enabled: false,
    siteId: '',
    honorDnt: true
  }
};

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
);

const asString = (value: unknown, maxLength = 2000): string => (
  typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
);

const asBoolean = (value: unknown, fallback = false): boolean => (
  typeof value === 'boolean' ? value : fallback
);

const normalizeUrl = (value: unknown, fallback = ''): string => {
  const raw = asString(value, 500);
  if (!raw) return fallback;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return fallback;
    }
    return parsed.toString();
  } catch {
    return fallback;
  }
};

const escapeHtmlAttribute = (value: string) => (
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
);

const buildGoogleTagSnippet = (settings: GoogleTagAnalyticsSettings): string => {
  const tagId = asString(settings.tagId, 64);
  if (!settings.enabled || !tagId) return '';

  return [
    '<!-- Google tag (gtag.js) -->',
    `<script async src="https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tagId)}"></script>`,
    '<script>',
    '  window.dataLayer = window.dataLayer || [];',
    '  function gtag(){dataLayer.push(arguments);}',
    '  gtag(\'js\', new Date());',
    `  gtag('config', ${JSON.stringify(tagId)});`,
    '</script>'
  ].join('\n');
};

const buildUmamiSnippet = (settings: UmamiAnalyticsSettings): string => {
  const scriptUrl = normalizeUrl(settings.scriptUrl);
  const websiteId = asString(settings.websiteId, 120);
  if (!settings.enabled || !scriptUrl || !websiteId) return '';

  const attributes = [
    'defer',
    `src="${escapeHtmlAttribute(scriptUrl)}"`,
    `data-website-id="${escapeHtmlAttribute(websiteId)}"`
  ];

  const hostUrl = normalizeUrl(settings.hostUrl);
  if (hostUrl) {
    attributes.push(`data-host-url="${escapeHtmlAttribute(hostUrl)}"`);
  }

  const domains = asString(settings.domains, 500);
  if (domains) {
    attributes.push(`data-domains="${escapeHtmlAttribute(domains)}"`);
  }

  if (settings.doNotTrack) {
    attributes.push('data-do-not-track="true"');
  }

  if (settings.trackWebVitals) {
    attributes.push('data-performance="true"');
  }

  return `<!-- Umami -->\n<script ${attributes.join(' ')}></script>`;
};

const buildFathomSnippet = (settings: FathomAnalyticsSettings): string => {
  const siteId = asString(settings.siteId, 64);
  if (!settings.enabled || !siteId) return '';

  const attributes = [
    'src="https://cdn.usefathom.com/script.js"',
    `data-site="${escapeHtmlAttribute(siteId)}"`,
    'defer'
  ];

  if (settings.honorDnt) {
    attributes.push('data-honor-dnt="true"');
  }

  return `<!-- Fathom Analytics -->\n<script ${attributes.join(' ')}></script>`;
};

export const parseExternalAnalyticsSettings = (value: unknown): ExternalAnalyticsSettingsState => {
  const root = asRecord(value);
  const googleTag = asRecord(root.googleTag);
  const plausible = asRecord(root.plausible);
  const umami = asRecord(root.umami);
  const fathom = asRecord(root.fathom);

  return {
    googleTag: {
      enabled: asBoolean(googleTag.enabled, DEFAULT_EXTERNAL_ANALYTICS_SETTINGS_STATE.googleTag.enabled),
      tagId: asString(googleTag.tagId, 64)
    },
    plausible: {
      enabled: asBoolean(plausible.enabled, DEFAULT_EXTERNAL_ANALYTICS_SETTINGS_STATE.plausible.enabled),
      snippetHtml: asString(plausible.snippetHtml, 50_000)
    },
    umami: {
      enabled: asBoolean(umami.enabled, DEFAULT_EXTERNAL_ANALYTICS_SETTINGS_STATE.umami.enabled),
      scriptUrl: normalizeUrl(umami.scriptUrl, DEFAULT_EXTERNAL_ANALYTICS_SETTINGS_STATE.umami.scriptUrl),
      websiteId: asString(umami.websiteId, 120),
      hostUrl: normalizeUrl(umami.hostUrl),
      domains: asString(umami.domains, 500),
      doNotTrack: asBoolean(umami.doNotTrack, DEFAULT_EXTERNAL_ANALYTICS_SETTINGS_STATE.umami.doNotTrack),
      trackWebVitals: asBoolean(umami.trackWebVitals, DEFAULT_EXTERNAL_ANALYTICS_SETTINGS_STATE.umami.trackWebVitals)
    },
    fathom: {
      enabled: asBoolean(fathom.enabled, DEFAULT_EXTERNAL_ANALYTICS_SETTINGS_STATE.fathom.enabled),
      siteId: asString(fathom.siteId, 64),
      honorDnt: asBoolean(fathom.honorDnt, DEFAULT_EXTERNAL_ANALYTICS_SETTINGS_STATE.fathom.honorDnt)
    }
  };
};

export const serializeExternalAnalyticsSettings = (settings: ExternalAnalyticsSettingsState) => ({
  [EXTERNAL_ANALYTICS_SETTING_KEY]: {
    googleTag: {
      enabled: settings.googleTag.enabled,
      tagId: asString(settings.googleTag.tagId, 64)
    },
    plausible: {
      enabled: settings.plausible.enabled,
      snippetHtml: asString(settings.plausible.snippetHtml, 50_000)
    },
    umami: {
      enabled: settings.umami.enabled,
      scriptUrl: normalizeUrl(settings.umami.scriptUrl, DEFAULT_EXTERNAL_ANALYTICS_SETTINGS_STATE.umami.scriptUrl),
      websiteId: asString(settings.umami.websiteId, 120),
      hostUrl: normalizeUrl(settings.umami.hostUrl),
      domains: asString(settings.umami.domains, 500),
      doNotTrack: settings.umami.doNotTrack,
      trackWebVitals: settings.umami.trackWebVitals
    },
    fathom: {
      enabled: settings.fathom.enabled,
      siteId: asString(settings.fathom.siteId, 64),
      honorDnt: settings.fathom.honorDnt
    }
  }
});

export const buildExternalAnalyticsHeadHtml = (settings: ExternalAnalyticsSettingsState): string => {
  const snippets = [
    buildGoogleTagSnippet(settings.googleTag),
    settings.plausible.enabled ? asString(settings.plausible.snippetHtml, 50_000) : '',
    buildUmamiSnippet(settings.umami),
    buildFathomSnippet(settings.fathom)
  ].filter((entry) => entry.length > 0);

  return snippets.join('\n');
};

export const shouldRenderExternalAnalytics = (pathname: string): boolean => {
  const normalizedPathname = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return !PRIVATE_ANALYTICS_PREFIXES.some((prefix) => (
    normalizedPathname === prefix || normalizedPathname.startsWith(`${prefix}/`)
  ));
};
