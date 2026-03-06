export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'other';

export type UserAgentProfile = {
  browser: string;
  os: string;
  deviceType: DeviceType;
  isBot: boolean;
};

const BOT_RE = /(bot|crawler|spider|slurp|bingpreview|facebookexternalhit|headless|preview)/i;
const TABLET_RE = /(ipad|tablet|kindle|silk|playbook)/i;
const MOBILE_RE = /(mobi|iphone|ipod|android.+mobile|windows phone)/i;

const normalizeUa = (value: unknown): string => (
  typeof value === 'string' ? value.trim().slice(0, 500) : ''
);

const pickBrowser = (ua: string): string => {
  if (!ua) return 'Unknown';
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\//i.test(ua) || /opera/i.test(ua)) return 'Opera';
  if (/samsungbrowser\//i.test(ua)) return 'Samsung Internet';
  if (/ucbrowser\//i.test(ua)) return 'UC Browser';
  if (/firefox\//i.test(ua) || /fxios\//i.test(ua)) return 'Firefox';
  if (/chrome\//i.test(ua) || /crios\//i.test(ua)) return 'Chrome';
  if (/safari\//i.test(ua) && /version\//i.test(ua)) return 'Safari';
  if (/brave/i.test(ua)) return 'Brave';
  return 'Other';
};

const pickOs = (ua: string): string => {
  if (!ua) return 'Unknown';
  if (/windows nt/i.test(ua)) return 'Windows';
  if (/android/i.test(ua)) return 'Android';
  if (/(iphone|ipad|ipod)/i.test(ua)) return 'iOS';
  if (/mac os x/i.test(ua)) return 'macOS';
  if (/cros/i.test(ua)) return 'ChromeOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Other';
};

const pickDeviceType = (ua: string, isBot: boolean): DeviceType => {
  if (!ua) return 'other';
  if (isBot) return 'bot';
  if (TABLET_RE.test(ua)) return 'tablet';
  if (MOBILE_RE.test(ua)) return 'mobile';
  if (/mozilla|chrome|safari|firefox|edg|opera/i.test(ua)) return 'desktop';
  return 'other';
};

export const parseUserAgent = (value: unknown): UserAgentProfile => {
  const ua = normalizeUa(value);
  const isBot = BOT_RE.test(ua);
  return {
    browser: pickBrowser(ua),
    os: pickOs(ua),
    deviceType: pickDeviceType(ua, isBot),
    isBot
  };
};

