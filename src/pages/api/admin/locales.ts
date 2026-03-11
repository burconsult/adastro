import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/auth/auth-helpers';
import { getAvailableLocaleCodes, getCoreLocalePacks, getLocalePackHealth, LOCALE_CATALOG_VERSION, LOCALE_SCHEMA_VERSION } from '@/lib/i18n/catalog';
import { DEFAULT_LOCALE, ensureDefaultLocaleInList, isValidLocaleCode, normalizeLocaleCode, normalizeLocaleList } from '@/lib/i18n/locales';
import { SettingsService } from '@/lib/services/settings-service';

const jsonHeaders = { 'Content-Type': 'application/json' };
const toJson = (payload: unknown, status = 200) => (
  new Response(JSON.stringify(payload), { status, headers: jsonHeaders })
);

const buildPayload = async () => {
  const settingsService = new SettingsService();
  const settings = await settingsService.getSettings(['content.defaultLocale', 'content.locales']);
  const availableLocales = getAvailableLocaleCodes();
  const coreLocales = Object.keys(getCoreLocalePacks()).sort((a, b) => a.localeCompare(b));
  const defaultLocale = normalizeLocaleCode(settings['content.defaultLocale'], DEFAULT_LOCALE);
  const activeLocales = ensureDefaultLocaleInList(
    defaultLocale,
    normalizeLocaleList(settings['content.locales'], defaultLocale)
  );
  const localeHealth = getLocalePackHealth({ activeLocales, defaultLocale });

  return {
    catalogVersion: LOCALE_CATALOG_VERSION,
    schemaVersion: LOCALE_SCHEMA_VERSION,
    defaultLocale,
    activeLocales,
    availableLocales,
    activatableLocales: coreLocales,
    locales: localeHealth.map((entry) => ({
      ...entry,
      canActivate: coreLocales.includes(entry.locale)
    }))
  };
};

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const payload = await buildPayload();
    return toJson(payload);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Authentication required')) {
        return toJson({ error: 'Authentication required' }, 401);
      }
      if (error.message.includes('Admin access required')) {
        return toJson({ error: 'Admin access required' }, 403);
      }
    }

    return toJson({
      error: 'Failed to load locale inventory',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const admin = await requireAdmin(request);
    const body = await request.json().catch(() => null);
    const requestedDefaultLocale = normalizeLocaleCode(body?.defaultLocale, DEFAULT_LOCALE);
    const requestedLocales = Array.isArray(body?.activeLocales)
      ? body.activeLocales
      : [];

    const coreLocales = Object.keys(getCoreLocalePacks()).sort((a, b) => a.localeCompare(b));
    const normalizedActiveLocales = ensureDefaultLocaleInList(
      requestedDefaultLocale,
      normalizeLocaleList(requestedLocales, requestedDefaultLocale)
    ).filter((locale) => coreLocales.includes(locale));

    if (!isValidLocaleCode(requestedDefaultLocale)) {
      return new Response(JSON.stringify({ error: 'Default locale is invalid.' }), { status: 400, headers: jsonHeaders });
    }

    if (!coreLocales.includes(requestedDefaultLocale)) {
      return new Response(JSON.stringify({ error: 'Default locale must have a core language pack.' }), { status: 400, headers: jsonHeaders });
    }

    if (normalizedActiveLocales.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one active locale is required.' }), { status: 400, headers: jsonHeaders });
    }

    const settingsService = new SettingsService();
    await settingsService.updateSettings({
      'content.defaultLocale': requestedDefaultLocale,
      'content.locales': normalizedActiveLocales
    }, admin.id);

    const payload = await buildPayload();
    return toJson(payload);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Authentication required')) {
        return toJson({ error: 'Authentication required' }, 401);
      }
      if (error.message.includes('Admin access required')) {
        return toJson({ error: 'Admin access required' }, 403);
      }
    }

    return toJson({
      error: 'Failed to update locale configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
};
