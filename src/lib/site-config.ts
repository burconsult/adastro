import { SettingsService } from './services/settings-service.js';
import { getThemeModuleById } from './themes/registry.js';
import {
  applyArticleBasePathToHref,
  DEFAULT_ARTICLE_ROUTING,
  normalizeArticleBasePath,
  normalizeArticlePermalinkStyle,
  type ArticlePermalinkStyle
} from './routing/articles.js';

export interface SiteIdentity {
  title: string;
  description: string;
  tagline: string;
  logoUrl: string;
}

export interface NavLink {
  label: string;
  href: string;
}

export interface SiteNavigation {
  topLinks: NavLink[];
  bottomLinks: NavLink[];
  footerAttribution: string;
  footerAttributionUrl?: string;
  footerLinks: NavLink[];
}

export interface SiteTheme {
  preset: string;
  mode: 'light' | 'dark' | 'system';
}

export interface SiteSeoDefaults {
  defaultTitle: string;
  defaultDescription: string;
  keywords: string[];
  ogImage: string;
}

export interface SiteSocialProfiles {
  twitterHandle?: string;
  twitterUrl?: string;
  facebookUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  customLinks?: NavLink[];
}

export interface SiteContentRouting {
  articleBasePath: string;
  articlePermalinkStyle: ArticlePermalinkStyle;
}

export interface SiteContentPreferences {
  postsPerPage: number;
  excerptLength: number;
}

export interface SiteCustomScripts {
  headHtml: string;
  footerHtml: string;
}

const DEFAULT_IDENTITY: SiteIdentity = {
  title: 'AdAstro',
  description: 'A practical, speed-first CMS built with Astro and Supabase.',
  tagline: 'AdAstro - The Lightspeed CMS',
  logoUrl: '/logo.svg'
};

const DEFAULT_NAVIGATION: SiteNavigation = {
  topLinks: [
    { label: 'Home', href: '/' },
    { label: 'Articles', href: `/${DEFAULT_ARTICLE_ROUTING.basePath}` },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' }
  ],
  bottomLinks: [
    { label: 'Home', href: '/' },
    { label: 'Articles', href: `/${DEFAULT_ARTICLE_ROUTING.basePath}` },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' }
  ],
  footerAttribution: 'Powered by AdAstro',
  footerAttributionUrl: 'https://github.com/burconsult/adastro',
  footerLinks: [
    { label: 'Powered by AdAstro', href: 'https://github.com/burconsult/adastro' }
  ]
};

const DEFAULT_THEME: SiteTheme = {
  preset: 'adastro',
  mode: 'system'
};

const DEFAULT_SEO_DEFAULTS: SiteSeoDefaults = {
  defaultTitle: '%s | {{siteTitle}}',
  defaultDescription: 'A practical, speed-first CMS built with Astro and Supabase.',
  keywords: ['adastro', 'astro cms', 'performance cms'],
  ogImage: '/images/og-default.jpg'
};

const DEFAULT_SOCIAL_PROFILES: SiteSocialProfiles = {};

const DEFAULT_CONTENT_ROUTING: SiteContentRouting = {
  articleBasePath: DEFAULT_ARTICLE_ROUTING.basePath,
  articlePermalinkStyle: DEFAULT_ARTICLE_ROUTING.permalinkStyle
};

const DEFAULT_CONTENT_PREFERENCES: SiteContentPreferences = {
  postsPerPage: 10,
  excerptLength: 150
};

const DEFAULT_CUSTOM_SCRIPTS: SiteCustomScripts = {
  headHtml: '',
  footerHtml: ''
};

let cachedIdentity: SiteIdentity | null = null;
let loadingPromise: Promise<SiteIdentity> | null = null;
let cachedNavigation: SiteNavigation | null = null;
let loadingNavigationPromise: Promise<SiteNavigation> | null = null;
let cachedTheme: SiteTheme | null = null;
let loadingThemePromise: Promise<SiteTheme> | null = null;
let cachedSeoDefaults: SiteSeoDefaults | null = null;
let loadingSeoDefaultsPromise: Promise<SiteSeoDefaults> | null = null;
let cachedSocialProfiles: SiteSocialProfiles | null = null;
let loadingSocialProfilesPromise: Promise<SiteSocialProfiles> | null = null;
let cachedContentRouting: SiteContentRouting | null = null;
let loadingContentRoutingPromise: Promise<SiteContentRouting> | null = null;
let cachedContentPreferences: SiteContentPreferences | null = null;
let loadingContentPreferencesPromise: Promise<SiteContentPreferences> | null = null;
let cachedCustomScripts: SiteCustomScripts | null = null;
let loadingCustomScriptsPromise: Promise<SiteCustomScripts> | null = null;

async function fetchSiteIdentity(): Promise<SiteIdentity> {
  const settingsService = new SettingsService();
  const settings = await settingsService.getSettings([
    'site.title',
    'site.description',
    'site.tagline',
    'site.logoUrl'
  ]);

  const logoCandidate = typeof settings['site.logoUrl'] === 'string'
    ? settings['site.logoUrl'].trim()
    : '';
  const logoUrl = logoCandidate && (logoCandidate.startsWith('/') || logoCandidate.startsWith('http'))
    ? logoCandidate
    : DEFAULT_IDENTITY.logoUrl;

  return {
    title: settings['site.title'] ?? DEFAULT_IDENTITY.title,
    description: settings['site.description'] ?? DEFAULT_IDENTITY.description,
    tagline: settings['site.tagline'] ?? DEFAULT_IDENTITY.tagline,
    logoUrl
  };
}

const normalizeLinks = (value: unknown, fallback: NavLink[]): NavLink[] => {
  if (!Array.isArray(value)) return fallback;
  const normalized = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as { label?: unknown; href?: unknown };
      const label = typeof record.label === 'string' ? record.label.trim() : '';
      const href = typeof record.href === 'string' ? record.href.trim() : '';
      if (!label || !href) return null;
      return { label, href };
    })
    .filter((entry): entry is NavLink => Boolean(entry));
  return normalized.length > 0 ? normalized : fallback;
};

const ensureCoreNavLink = (links: NavLink[], required: NavLink): NavLink[] => {
  if (links.some((link) => link.href === required.href)) {
    return links;
  }
  return [...links, required];
};

async function fetchSiteNavigation(): Promise<SiteNavigation> {
  const settingsService = new SettingsService();
  const settings = await settingsService.getSettings([
    'navigation.topLinks',
    'navigation.bottomLinks',
    'navigation.footerAttribution',
    'navigation.footerAttributionUrl'
  ]);
  const contentRouting = await fetchSiteContentRouting();

  const footerAttribution = typeof settings['navigation.footerAttribution'] === 'string'
    ? settings['navigation.footerAttribution'].trim()
    : DEFAULT_NAVIGATION.footerAttribution;
  const footerAttributionUrl = typeof settings['navigation.footerAttributionUrl'] === 'string'
    ? settings['navigation.footerAttributionUrl'].trim()
    : DEFAULT_NAVIGATION.footerAttributionUrl;
  const normalizedFooterAttribution = footerAttribution;
  const normalizedFooterAttributionUrl = normalizedFooterAttribution
    ? (footerAttributionUrl || undefined)
    : undefined;

  const topLinks = normalizeLinks(settings['navigation.topLinks'], DEFAULT_NAVIGATION.topLinks)
    .map((link) => ({ ...link, href: applyArticleBasePathToHref(link.href, { basePath: contentRouting.articleBasePath }) }));
  const bottomLinks = normalizeLinks(settings['navigation.bottomLinks'], DEFAULT_NAVIGATION.bottomLinks)
    .map((link) => ({ ...link, href: applyArticleBasePathToHref(link.href, { basePath: contentRouting.articleBasePath }) }));
  const footerPoweredByLabel = normalizedFooterAttribution || DEFAULT_NAVIGATION.footerAttribution;
  const footerPoweredByUrl = normalizedFooterAttributionUrl || DEFAULT_NAVIGATION.footerAttributionUrl;

  return {
    topLinks: ensureCoreNavLink(topLinks, { label: 'About', href: '/about' }),
    bottomLinks: ensureCoreNavLink(bottomLinks, { label: 'About', href: '/about' }),
    footerAttribution: footerPoweredByLabel,
    footerAttributionUrl: footerPoweredByUrl,
    footerLinks: footerPoweredByUrl
      ? [{ label: footerPoweredByLabel, href: footerPoweredByUrl }]
      : [{ label: footerPoweredByLabel, href: DEFAULT_NAVIGATION.footerAttributionUrl }]
  };
}

async function fetchSiteContentRouting(): Promise<SiteContentRouting> {
  const settingsService = new SettingsService();
  const settings = await settingsService.getSettings([
    'content.articleBasePath',
    'content.articlePermalinkStyle'
  ]);

  return {
    articleBasePath: normalizeArticleBasePath(settings['content.articleBasePath']),
    articlePermalinkStyle: normalizeArticlePermalinkStyle(settings['content.articlePermalinkStyle'])
  };
}

async function fetchSiteContentPreferences(): Promise<SiteContentPreferences> {
  const settingsService = new SettingsService();
  const settings = await settingsService.getSettings([
    'content.postsPerPage',
    'content.excerptLength'
  ]);

  const postsPerPageRaw = Number(settings['content.postsPerPage']);
  const excerptLengthRaw = Number(settings['content.excerptLength']);
  const postsPerPage = Number.isFinite(postsPerPageRaw)
    ? Math.min(50, Math.max(1, Math.floor(postsPerPageRaw)))
    : DEFAULT_CONTENT_PREFERENCES.postsPerPage;
  const excerptLength = Number.isFinite(excerptLengthRaw)
    ? Math.min(500, Math.max(50, Math.floor(excerptLengthRaw)))
    : DEFAULT_CONTENT_PREFERENCES.excerptLength;

  return {
    postsPerPage,
    excerptLength
  };
}

async function fetchSiteCustomScripts(): Promise<SiteCustomScripts> {
  const settingsService = new SettingsService();
  const settings = await settingsService.getSettings([
    'site.customHeadScripts',
    'site.customFooterScripts'
  ]);

  const headHtml = typeof settings['site.customHeadScripts'] === 'string'
    ? settings['site.customHeadScripts'].slice(0, 50_000)
    : DEFAULT_CUSTOM_SCRIPTS.headHtml;
  const footerHtml = typeof settings['site.customFooterScripts'] === 'string'
    ? settings['site.customFooterScripts'].slice(0, 50_000)
    : DEFAULT_CUSTOM_SCRIPTS.footerHtml;

  return {
    headHtml,
    footerHtml
  };
}

const normalizeThemeMode = (value: unknown): SiteTheme['mode'] => {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return DEFAULT_THEME.mode;
};

async function fetchSiteTheme(): Promise<SiteTheme> {
  const settingsService = new SettingsService();
  const settings = await settingsService.getSettings([
    'appearance.theme.active',
    'appearance.theme.mode'
  ]);

  const preset = typeof settings['appearance.theme.active'] === 'string'
    ? settings['appearance.theme.active'].trim()
    : DEFAULT_THEME.preset;
  const resolvedPreset = getThemeModuleById(preset) ? preset : DEFAULT_THEME.preset;

  return {
    preset: resolvedPreset || DEFAULT_THEME.preset,
    mode: normalizeThemeMode(settings['appearance.theme.mode'])
  };
}

const normalizeUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return undefined;
  try {
    return new URL(trimmed).toString();
  } catch {
    return undefined;
  }
};

const normalizeTwitterHandle = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const handle = value.trim().replace(/^@/, '');
  if (!handle) return undefined;
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return undefined;
  return handle;
};

const normalizeCustomSocialLinks = (value: unknown): NavLink[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as { label?: unknown; href?: unknown };
      const label = typeof record.label === 'string' ? record.label.trim() : '';
      const href = normalizeUrl(record.href);
      if (!label || !href) return null;
      return {
        label: label.slice(0, 32),
        href
      };
    })
    .filter((entry): entry is NavLink => {
      if (!entry) return false;
      const dedupeKey = entry.href.toLowerCase();
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    });
};

const normalizeKeywords = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [...DEFAULT_SEO_DEFAULTS.keywords];
  const normalized = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0)
    .slice(0, 20);
  return normalized.length > 0 ? normalized : [...DEFAULT_SEO_DEFAULTS.keywords];
};

async function fetchSiteSeoDefaults(): Promise<SiteSeoDefaults> {
  const settingsService = new SettingsService();
  const settings = await settingsService.getSettings([
    'seo.defaultTitle',
    'seo.defaultDescription',
    'seo.keywords',
    'seo.ogImage'
  ]);

  const defaultTitle = typeof settings['seo.defaultTitle'] === 'string' && settings['seo.defaultTitle'].trim().length > 0
    ? settings['seo.defaultTitle'].trim()
    : DEFAULT_SEO_DEFAULTS.defaultTitle;
  const defaultDescription = typeof settings['seo.defaultDescription'] === 'string' && settings['seo.defaultDescription'].trim().length > 0
    ? settings['seo.defaultDescription'].trim()
    : DEFAULT_SEO_DEFAULTS.defaultDescription;
  const ogImageCandidate = typeof settings['seo.ogImage'] === 'string'
    ? settings['seo.ogImage'].trim()
    : '';
  const ogImage = ogImageCandidate && (ogImageCandidate.startsWith('/') || ogImageCandidate.startsWith('http'))
    ? ogImageCandidate
    : DEFAULT_SEO_DEFAULTS.ogImage;

  return {
    defaultTitle,
    defaultDescription,
    keywords: normalizeKeywords(settings['seo.keywords']),
    ogImage
  };
}

async function fetchSiteSocialProfiles(): Promise<SiteSocialProfiles> {
  const settingsService = new SettingsService();
  const settings = await settingsService.getSettings([
    'social.twitter',
    'social.facebook',
    'social.linkedin',
    'social.github',
    'social.links'
  ]);

  const twitterHandle = normalizeTwitterHandle(settings['social.twitter']);

  return {
    twitterHandle,
    twitterUrl: twitterHandle ? `https://x.com/${twitterHandle}` : undefined,
    facebookUrl: normalizeUrl(settings['social.facebook']),
    linkedinUrl: normalizeUrl(settings['social.linkedin']),
    githubUrl: normalizeUrl(settings['social.github']),
    customLinks: normalizeCustomSocialLinks(settings['social.links'])
  };
}

export async function getSiteIdentity(options?: { refresh?: boolean }): Promise<SiteIdentity> {
  if (options?.refresh) {
    cachedIdentity = null;
    loadingPromise = null;
  }

  if (cachedIdentity) {
    return cachedIdentity;
  }

  if (!loadingPromise) {
    loadingPromise = fetchSiteIdentity().catch((error) => {
      console.warn('Failed to load site identity from settings. Falling back to defaults.', error);
      return DEFAULT_IDENTITY;
    }).then((identity) => {
      cachedIdentity = identity;
      return identity;
    });
  }

  return loadingPromise;
}

export async function getSiteNavigation(options?: { refresh?: boolean }): Promise<SiteNavigation> {
  if (options?.refresh) {
    cachedNavigation = null;
    loadingNavigationPromise = null;
  }

  if (cachedNavigation) {
    return cachedNavigation;
  }

  if (!loadingNavigationPromise) {
    loadingNavigationPromise = fetchSiteNavigation().catch((error) => {
      console.warn('Failed to load site navigation from settings. Falling back to defaults.', error);
      return DEFAULT_NAVIGATION;
    }).then((navigation) => {
      cachedNavigation = navigation;
      return navigation;
    });
  }

  return loadingNavigationPromise;
}

export async function getSiteTheme(options?: { refresh?: boolean }): Promise<SiteTheme> {
  if (options?.refresh) {
    cachedTheme = null;
    loadingThemePromise = null;
  }

  if (cachedTheme) {
    return cachedTheme;
  }

  if (!loadingThemePromise) {
    loadingThemePromise = fetchSiteTheme().catch((error) => {
      console.warn('Failed to load site theme from settings. Falling back to defaults.', error);
      return DEFAULT_THEME;
    }).then((theme) => {
      cachedTheme = theme;
      return theme;
    });
  }

  return loadingThemePromise;
}

export async function getSiteSeoDefaults(options?: { refresh?: boolean }): Promise<SiteSeoDefaults> {
  if (options?.refresh) {
    cachedSeoDefaults = null;
    loadingSeoDefaultsPromise = null;
  }

  if (cachedSeoDefaults) {
    return cachedSeoDefaults;
  }

  if (!loadingSeoDefaultsPromise) {
    loadingSeoDefaultsPromise = fetchSiteSeoDefaults().catch((error) => {
      console.warn('Failed to load SEO defaults from settings. Falling back to defaults.', error);
      return DEFAULT_SEO_DEFAULTS;
    }).then((seoDefaults) => {
      cachedSeoDefaults = seoDefaults;
      return seoDefaults;
    });
  }

  return loadingSeoDefaultsPromise;
}

export async function getSiteSocialProfiles(options?: { refresh?: boolean }): Promise<SiteSocialProfiles> {
  if (options?.refresh) {
    cachedSocialProfiles = null;
    loadingSocialProfilesPromise = null;
  }

  if (cachedSocialProfiles) {
    return cachedSocialProfiles;
  }

  if (!loadingSocialProfilesPromise) {
    loadingSocialProfilesPromise = fetchSiteSocialProfiles().catch((error) => {
      console.warn('Failed to load social profiles from settings. Falling back to defaults.', error);
      return DEFAULT_SOCIAL_PROFILES;
    }).then((socialProfiles) => {
      cachedSocialProfiles = socialProfiles;
      return socialProfiles;
    });
  }

  return loadingSocialProfilesPromise;
}

export async function getSiteContentRouting(options?: { refresh?: boolean }): Promise<SiteContentRouting> {
  if (options?.refresh) {
    cachedContentRouting = null;
    loadingContentRoutingPromise = null;
  }

  if (cachedContentRouting) {
    return cachedContentRouting;
  }

  if (!loadingContentRoutingPromise) {
    loadingContentRoutingPromise = fetchSiteContentRouting().catch((error) => {
      console.warn('Failed to load content routing settings. Falling back to defaults.', error);
      return DEFAULT_CONTENT_ROUTING;
    }).then((routing) => {
      cachedContentRouting = routing;
      return routing;
    });
  }

  return loadingContentRoutingPromise;
}

export async function getSiteContentPreferences(options?: { refresh?: boolean }): Promise<SiteContentPreferences> {
  if (options?.refresh) {
    cachedContentPreferences = null;
    loadingContentPreferencesPromise = null;
  }

  if (cachedContentPreferences) {
    return cachedContentPreferences;
  }

  if (!loadingContentPreferencesPromise) {
    loadingContentPreferencesPromise = fetchSiteContentPreferences().catch((error) => {
      console.warn('Failed to load content preferences from settings. Falling back to defaults.', error);
      return DEFAULT_CONTENT_PREFERENCES;
    }).then((preferences) => {
      cachedContentPreferences = preferences;
      return preferences;
    });
  }

  return loadingContentPreferencesPromise;
}

export async function getSiteCustomScripts(options?: { refresh?: boolean }): Promise<SiteCustomScripts> {
  if (options?.refresh) {
    cachedCustomScripts = null;
    loadingCustomScriptsPromise = null;
  }

  if (cachedCustomScripts) {
    return cachedCustomScripts;
  }

  if (!loadingCustomScriptsPromise) {
    loadingCustomScriptsPromise = fetchSiteCustomScripts().catch((error) => {
      console.warn('Failed to load custom script snippets from settings. Falling back to defaults.', error);
      return DEFAULT_CUSTOM_SCRIPTS;
    }).then((scripts) => {
      cachedCustomScripts = scripts;
      return scripts;
    });
  }

  return loadingCustomScriptsPromise;
}

export function resetSiteThemeCache(): void {
  cachedTheme = null;
  loadingThemePromise = null;
}

export function resetSiteIdentityCache(): void {
  cachedIdentity = null;
  loadingPromise = null;
}

export function resetSiteNavigationCache(): void {
  cachedNavigation = null;
  loadingNavigationPromise = null;
}

export function resetSiteContentRoutingCache(): void {
  cachedContentRouting = null;
  loadingContentRoutingPromise = null;
}

export function resetSiteContentPreferencesCache(): void {
  cachedContentPreferences = null;
  loadingContentPreferencesPromise = null;
}

export function resetSiteSeoDefaultsCache(): void {
  cachedSeoDefaults = null;
  loadingSeoDefaultsPromise = null;
}

export function resetSiteSocialProfilesCache(): void {
  cachedSocialProfiles = null;
  loadingSocialProfilesPromise = null;
}

export function resetSiteCustomScriptsCache(): void {
  cachedCustomScripts = null;
  loadingCustomScriptsPromise = null;
}

export function resetAllSiteConfigCaches(): void {
  resetSiteIdentityCache();
  resetSiteNavigationCache();
  resetSiteThemeCache();
  resetSiteSeoDefaultsCache();
  resetSiteSocialProfilesCache();
  resetSiteContentRoutingCache();
  resetSiteContentPreferencesCache();
  resetSiteCustomScriptsCache();
}

export function getDefaultSiteIdentity(): SiteIdentity {
  return { ...DEFAULT_IDENTITY };
}

export function getDefaultSiteNavigation(): SiteNavigation {
  return { ...DEFAULT_NAVIGATION };
}

export function getDefaultSiteTheme(): SiteTheme {
  return { ...DEFAULT_THEME };
}

export function getDefaultSiteSeoDefaults(): SiteSeoDefaults {
  return { ...DEFAULT_SEO_DEFAULTS, keywords: [...DEFAULT_SEO_DEFAULTS.keywords] };
}

export function getDefaultSiteSocialProfiles(): SiteSocialProfiles {
  return { ...DEFAULT_SOCIAL_PROFILES };
}

export function getDefaultSiteContentRouting(): SiteContentRouting {
  return { ...DEFAULT_CONTENT_ROUTING };
}

export function getDefaultSiteContentPreferences(): SiteContentPreferences {
  return { ...DEFAULT_CONTENT_PREFERENCES };
}

export function getDefaultSiteCustomScripts(): SiteCustomScripts {
  return { ...DEFAULT_CUSTOM_SCRIPTS };
}
