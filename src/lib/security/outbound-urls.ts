import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const BLOCKED_HOSTNAMES = new Set([
  '0.0.0.0',
  'localhost',
  'metadata',
  'metadata.google.internal'
]);

const BLOCKED_HOSTNAME_SUFFIXES = [
  '.internal',
  '.local',
  '.localhost'
];

const stripIpv6Brackets = (hostname: string): string => (
  hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname
);

const normalizeHostname = (hostname: string): string => (
  stripIpv6Brackets(hostname.trim().replace(/\.$/, '').toLowerCase())
);

const ipv4ToInt = (ip: string): number | null => {
  const segments = ip.split('.').map((segment) => Number(segment));
  if (segments.length !== 4 || segments.some((segment) => Number.isNaN(segment) || segment < 0 || segment > 255)) {
    return null;
  }

  return (((segments[0] << 24) >>> 0)
    + ((segments[1] << 16) >>> 0)
    + ((segments[2] << 8) >>> 0)
    + (segments[3] >>> 0)) >>> 0;
};

const isIpv4InCidr = (ip: string, network: string, prefixLength: number): boolean => {
  const ipInt = ipv4ToInt(ip);
  const networkInt = ipv4ToInt(network);
  if (ipInt === null || networkInt === null) return false;
  const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
  return (ipInt & mask) === (networkInt & mask);
};

const isPrivateIpv4 = (ip: string): boolean => (
  isIpv4InCidr(ip, '0.0.0.0', 8)
  || isIpv4InCidr(ip, '10.0.0.0', 8)
  || isIpv4InCidr(ip, '100.64.0.0', 10)
  || isIpv4InCidr(ip, '127.0.0.0', 8)
  || isIpv4InCidr(ip, '169.254.0.0', 16)
  || isIpv4InCidr(ip, '172.16.0.0', 12)
  || isIpv4InCidr(ip, '192.0.0.0', 24)
  || isIpv4InCidr(ip, '192.0.2.0', 24)
  || isIpv4InCidr(ip, '192.168.0.0', 16)
  || isIpv4InCidr(ip, '198.18.0.0', 15)
  || isIpv4InCidr(ip, '198.51.100.0', 24)
  || isIpv4InCidr(ip, '203.0.113.0', 24)
  || isIpv4InCidr(ip, '224.0.0.0', 4)
  || isIpv4InCidr(ip, '240.0.0.0', 4)
);

const isPrivateIpv6 = (ip: string): boolean => {
  const normalized = ip.trim().toLowerCase();
  const mappedIpv4Match = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mappedIpv4Match) {
    return isPrivateIpv4(mappedIpv4Match[1]);
  }

  return normalized === '::'
    || normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe8')
    || normalized.startsWith('fe9')
    || normalized.startsWith('fea')
    || normalized.startsWith('feb')
    || normalized.startsWith('ff')
    || normalized.startsWith('2001:db8');
};

const isDisallowedIpAddress = (address: string): boolean => {
  const normalized = normalizeHostname(address);
  const family = isIP(normalized);

  if (family === 4) return isPrivateIpv4(normalized);
  if (family === 6) return isPrivateIpv6(normalized);
  return false;
};

const isDisallowedHostname = (hostname: string): boolean => {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return true;
  if (BLOCKED_HOSTNAMES.has(normalized)) return true;
  return BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
};

export class UnsafeOutboundUrlError extends Error {
  reason: 'invalid_url' | 'url_not_allowed' | 'dns_lookup_failed';

  constructor(
    message: string,
    reason: 'invalid_url' | 'url_not_allowed' | 'dns_lookup_failed' = 'url_not_allowed'
  ) {
    super(message);
    this.name = 'UnsafeOutboundUrlError';
    this.reason = reason;
  }
}

const validateLookupResults = async (hostname: string): Promise<void> => {
  let records: Awaited<ReturnType<typeof lookup>>;
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch (error) {
    throw new UnsafeOutboundUrlError(
      `Could not resolve outbound host "${hostname}".`,
      'dns_lookup_failed'
    );
  }

  if (!Array.isArray(records) || records.length === 0) {
    throw new UnsafeOutboundUrlError(`Outbound host "${hostname}" did not resolve to a public IP address.`, 'dns_lookup_failed');
  }

  for (const record of records) {
    if (isDisallowedIpAddress(record.address)) {
      throw new UnsafeOutboundUrlError(`Outbound host "${hostname}" resolves to a private or reserved address.`, 'url_not_allowed');
    }
  }
};

export const assertSafeOutboundHttpUrl = async (value: string | URL): Promise<URL> => {
  let parsed: URL;
  try {
    parsed = value instanceof URL ? new URL(value.toString()) : new URL(String(value));
  } catch {
    throw new UnsafeOutboundUrlError('URL is not valid.', 'invalid_url');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UnsafeOutboundUrlError('Only http and https URLs are allowed.', 'url_not_allowed');
  }

  if (parsed.username || parsed.password) {
    throw new UnsafeOutboundUrlError('URLs with embedded credentials are not allowed.', 'url_not_allowed');
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (isDisallowedHostname(hostname)) {
    throw new UnsafeOutboundUrlError('URL host is not allowed.', 'url_not_allowed');
  }

  if (isDisallowedIpAddress(hostname)) {
    throw new UnsafeOutboundUrlError('URL address is not allowed.', 'url_not_allowed');
  }

  if (!isIP(hostname)) {
    await validateLookupResults(hostname);
  }

  return parsed;
};
