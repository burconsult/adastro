import { sanitizeRedirectPath } from './redirects';
import { buildLocalizedPath, DEFAULT_LOCALE, normalizeLocaleCode } from '../i18n/locales';

export type AppUserRole = 'admin' | 'author' | 'reader';
type AppPathOptions = {
  locale?: string;
  defaultLocale?: string;
};

const ADMIN_ALLOWED_PATH_PREFIX = '/admin';
const AUTHOR_ALLOWED_ADMIN_PREFIXES = ['/admin/posts', '/admin/media'];
const DEFAULT_PATH_BY_ROLE: Record<AppUserRole, string> = {
  admin: '/admin',
  author: '/admin/posts',
  reader: '/profile'
};

export function normalizeAppUserRole(role: unknown): AppUserRole {
  const normalized = typeof role === 'string' ? role.trim().toLowerCase() : '';
  if (normalized === 'admin' || normalized === 'author' || normalized === 'reader') {
    return normalized;
  }
  return 'reader';
}

const isLocalizableAppPath = (pathname: string): boolean => (
  pathname === '/profile'
  || pathname.startsWith('/profile/')
  || pathname === '/auth'
  || pathname.startsWith('/auth/')
);

const localizeAppPath = (path: string, options?: AppPathOptions): string => {
  const rawLocale = typeof options?.locale === 'string' ? options.locale.trim() : '';
  if (!rawLocale) {
    return path;
  }

  try {
    const parsed = new URL(path, 'http://local.test');
    if (!isLocalizableAppPath(parsed.pathname)) {
      return path;
    }

    const locale = normalizeLocaleCode(rawLocale, options?.defaultLocale ?? DEFAULT_LOCALE);
    return `${buildLocalizedPath(parsed.pathname, locale)}${parsed.search}${parsed.hash}`;
  } catch {
    return path;
  }
};

export function defaultPathForRole(role: unknown, options?: AppPathOptions): string {
  return localizeAppPath(DEFAULT_PATH_BY_ROLE[normalizeAppUserRole(role)], options);
}

export function canRoleAccessAdminPath(role: unknown, pathname: string): boolean {
  const normalizedRole = normalizeAppUserRole(role);
  if (!pathname.startsWith(ADMIN_ALLOWED_PATH_PREFIX)) {
    return true;
  }

  if (normalizedRole === 'admin') {
    return true;
  }

  if (normalizedRole !== 'author') {
    return false;
  }

  return AUTHOR_ALLOWED_ADMIN_PREFIXES.some((prefix) => (
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  ));
}

export function resolveRoleSafeRedirect(role: unknown, requestedPath: unknown, options?: AppPathOptions): string {
  const fallback = defaultPathForRole(role, options);
  const sanitized = sanitizeRedirectPath(requestedPath, fallback);

  if (sanitized.startsWith('/admin') && !canRoleAccessAdminPath(role, sanitized)) {
    return fallback;
  }

  return localizeAppPath(sanitized, options);
}

export function buildInvitePasswordSetupPath(role: unknown, options?: AppPathOptions): string {
  const nextPath = defaultPathForRole(role, options);
  const resetPasswordPath = localizeAppPath('/auth/reset-password', options);
  return `${resetPasswordPath}?next=${encodeURIComponent(nextPath)}`;
}
