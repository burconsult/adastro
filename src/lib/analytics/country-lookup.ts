import fs from 'node:fs/promises';
import path from 'node:path';
import { Reader, type CountryResponse, validate as validateIp } from 'maxmind';

const COUNTRY_DB_RELATIVE_PATH = path.join('public', 'data', 'geo', 'ip-to-country.mmdb');
const COUNTRY_DB_PUBLIC_PATH = '/data/geo/ip-to-country.mmdb';

let readerPromise: Promise<Reader<CountryResponse> | null> | null = null;
let loadWarningShown = false;

const showLoadWarning = (message: string, error?: unknown) => {
  if (loadWarningShown) return;
  loadWarningShown = true;
  if (error) {
    console.warn(`${message}:`, error);
    return;
  }
  console.warn(message);
};

const loadFromDisk = async (): Promise<Reader<CountryResponse> | null> => {
  try {
    const dbPath = path.resolve(process.cwd(), COUNTRY_DB_RELATIVE_PATH);
    const buffer = await fs.readFile(dbPath);
    return new Reader<CountryResponse>(buffer);
  } catch (error) {
    showLoadWarning('Analytics country lookup database not found on disk. Country analytics will be limited.', error);
    return null;
  }
};

const loadFromHttp = async (origin: string): Promise<Reader<CountryResponse> | null> => {
  try {
    const url = new URL(COUNTRY_DB_PUBLIC_PATH, origin).toString();
    const response = await fetch(url, { method: 'GET', redirect: 'follow' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return new Reader<CountryResponse>(Buffer.from(arrayBuffer));
  } catch (error) {
    showLoadWarning('Analytics country lookup database could not be fetched from static assets. Country analytics will be limited.', error);
    return null;
  }
};

const isPrivateIpv4 = (ip: string): boolean => {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) return false;
  const parts = ip.split('.').map((segment) => Number(segment));
  if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 0) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] >= 224) return true;
  return false;
};

const isPrivateIpv6 = (ip: string): boolean => {
  const normalized = ip.trim().toLowerCase();
  return (
    normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe80:')
  );
};

const isLookupCandidate = (ip: string): boolean => {
  if (!ip || ip === 'unknown') return false;
  if (!validateIp(ip)) return false;
  if (isPrivateIpv4(ip) || isPrivateIpv6(ip)) return false;
  return true;
};

const normalizeCountryCode = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
};

const getReader = async (requestUrl: string): Promise<Reader<CountryResponse> | null> => {
  if (!readerPromise) {
    readerPromise = (async () => {
      const diskReader = await loadFromDisk();
      if (diskReader) return diskReader;

      const origin = (() => {
        try {
          return new URL(requestUrl).origin;
        } catch {
          return '';
        }
      })();
      if (!origin) return null;
      return loadFromHttp(origin);
    })();
  }
  return readerPromise;
};

export const lookupCountryCode = async (ip: string, requestUrl: string): Promise<string | null> => {
  if (!isLookupCandidate(ip)) return null;
  const reader = await getReader(requestUrl);
  if (!reader) return null;

  try {
    const response = reader.get(ip);
    return normalizeCountryCode(response?.country?.iso_code) ?? normalizeCountryCode(response?.registered_country?.iso_code);
  } catch {
    return null;
  }
};

