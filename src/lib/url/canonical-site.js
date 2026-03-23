const CANONICAL_HOST_ALIASES = new Map([
  ['adastro.no', 'www.adastro.no']
]);

const FORCE_HTTPS_HOSTS = new Set([
  'adastro.no',
  'www.adastro.no'
]);

export const FALLBACK_SITE_URL = 'https://example.com';

export const normalizeCanonicalSiteUrl = (value) => {
  if (!value || typeof value !== 'string') return null;

  try {
    const parsed = new URL(value.trim());
    const hostname = parsed.hostname.toLowerCase();
    const canonicalHostname = CANONICAL_HOST_ALIASES.get(hostname);

    if (canonicalHostname) {
      parsed.hostname = canonicalHostname;
    }

    if (FORCE_HTTPS_HOSTS.has(parsed.hostname.toLowerCase())) {
      parsed.protocol = 'https:';
      if (parsed.port === '80' || parsed.port === '443') {
        parsed.port = '';
      }
    }

    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';

    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
};
