import { sanitizeRedirectPath } from './redirects';

export type AppUserRole = 'admin' | 'author' | 'reader';

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

export function defaultPathForRole(role: unknown): string {
  return DEFAULT_PATH_BY_ROLE[normalizeAppUserRole(role)];
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

export function resolveRoleSafeRedirect(role: unknown, requestedPath: unknown): string {
  const fallback = defaultPathForRole(role);
  const sanitized = sanitizeRedirectPath(requestedPath, fallback);

  if (sanitized.startsWith('/admin') && !canRoleAccessAdminPath(role, sanitized)) {
    return fallback;
  }

  return sanitized;
}

export function buildInvitePasswordSetupPath(role: unknown): string {
  const nextPath = defaultPathForRole(role);
  return `/auth/reset-password?next=${encodeURIComponent(nextPath)}`;
}
