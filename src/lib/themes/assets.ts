import archivoBlackLatin400Url from '@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2?url';
import cormorantGaramondLatin600Url from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2?url';
import ibmPlexMonoLatin500Url from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2?url';
import ibmPlexSansLatin500Url from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2?url';
import instrumentSerifLatin400Url from '@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2?url';
import interTightLatin500Url from '@fontsource/inter-tight/files/inter-tight-latin-500-normal.woff2?url';
import jetbrainsMonoLatin500Url from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2?url';
import libreBaskervilleLatin700Url from '@fontsource/libre-baskerville/files/libre-baskerville-latin-700-normal.woff2?url';
import montserratLatin500Url from '@fontsource/montserrat/files/montserrat-latin-500-normal.woff2?url';
import outfitLatin500Url from '@fontsource/outfit/files/outfit-latin-500-normal.woff2?url';
import playfairDisplayLatin600Url from '@fontsource/playfair-display/files/playfair-display-latin-600-normal.woff2?url';
import poppinsLatin500Url from '@fontsource/poppins/files/poppins-latin-500-normal.woff2?url';
import quicksandLatin500Url from '@fontsource/quicksand/files/quicksand-latin-500-normal.woff2?url';
import robotoLatin500Url from '@fontsource/roboto/files/roboto-latin-500-normal.woff2?url';
import rubikLatin600Url from '@fontsource/rubik/files/rubik-latin-600-normal.woff2?url';
import soraLatin600Url from '@fontsource/sora/files/sora-latin-600-normal.woff2?url';
import spaceGroteskLatin500Url from '@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2?url';

const THEME_STYLE_URLS = Object.entries(
  import.meta.glob('./installed/*/theme.css', {
    eager: true,
    import: 'default',
    query: '?url'
  })
).reduce<Record<string, string>>((acc, [path, url]) => {
  const match = path.match(/installed\/([^/]+)\/theme\.css$/);
  if (match && typeof url === 'string') {
    acc[match[1]] = url;
  }
  return acc;
}, {});

const FONT_PACK_URLS = Object.entries(
  import.meta.glob('../../styles/theme-font-packs/*.css', {
    eager: true,
    import: 'default',
    query: '?url'
  })
).reduce<Record<string, string>>((acc, [path, url]) => {
  const match = path.match(/theme-font-packs\/([^/]+)\.css$/);
  if (match && typeof url === 'string') {
    acc[match[1]] = url;
  }
  return acc;
}, {});

const THEME_FONT_PACK_IDS: Record<string, string | null> = {
  adastro: null,
  'brutalist-grid': 'brutalist-grid',
  'earth-zen': 'earth-zen',
  'fashion-muse': 'fashion-muse',
  'loan-box': 'loan-box',
  'monochrome-calm': 'monochrome-calm',
  'neural-nexus': 'neural-nexus',
  'nordic-modern': 'nordic-modern',
  pulse: 'pulse',
  'simple-lines': 'simple-lines'
};

const THEME_FONT_PRELOADS: Record<string, string[]> = {
  'brutalist-grid': [ibmPlexSansLatin500Url, archivoBlackLatin400Url],
  'earth-zen': [quicksandLatin500Url, cormorantGaramondLatin600Url],
  'fashion-muse': [poppinsLatin500Url, playfairDisplayLatin600Url],
  'loan-box': [robotoLatin500Url, rubikLatin600Url],
  'monochrome-calm': [montserratLatin500Url, libreBaskervilleLatin700Url],
  'neural-nexus': [spaceGroteskLatin500Url, jetbrainsMonoLatin500Url],
  'nordic-modern': [interTightLatin500Url, instrumentSerifLatin400Url],
  pulse: [outfitLatin500Url, soraLatin600Url],
  'simple-lines': [ibmPlexMonoLatin500Url, cormorantGaramondLatin600Url]
};

export const getThemeStylesheetUrl = (themeId: string): string | null => {
  return THEME_STYLE_URLS[themeId] ?? null;
};

export const getAllThemeStylesheetUrls = (): string[] => {
  return Object.entries(THEME_STYLE_URLS)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, url]) => url);
};

export const getThemeFontStylesheetUrl = (themeId: string): string | null => {
  if (themeId === 'adastro') {
    return null;
  }

  const fontPackId = THEME_FONT_PACK_IDS[themeId];
  if (fontPackId) {
    return FONT_PACK_URLS[fontPackId] ?? FONT_PACK_URLS.legacy ?? null;
  }

  return FONT_PACK_URLS.legacy ?? null;
};

export const getLegacyThemeFontStylesheetUrl = (): string | null => {
  return FONT_PACK_URLS.legacy ?? null;
};

export const getThemeFontPreloadUrls = (themeId: string): string[] => {
  return THEME_FONT_PRELOADS[themeId] ?? [];
};

export const getThemeStylesheetAssetMap = (): Record<string, string> => ({ ...THEME_STYLE_URLS });

export const getThemeFontStylesheetAssetMap = (): Record<string, string> => {
  const entries = Object.entries(THEME_FONT_PACK_IDS)
    .map(([themeId, fontPackId]) => {
      if (!fontPackId) {
        return [themeId, ''] as const;
      }

      const url = FONT_PACK_URLS[fontPackId] ?? FONT_PACK_URLS.legacy ?? '';
      return [themeId, url] as const;
    });

  return Object.fromEntries(entries);
};
