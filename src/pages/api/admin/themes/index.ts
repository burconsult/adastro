import type { APIRoute } from 'astro';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAdmin } from '../../../../lib/auth/auth-helpers.js';
import { getThemeModules } from '../../../../lib/themes/registry.js';
import { SettingsService } from '../../../../lib/services/settings-service.js';

const settingsService = new SettingsService();
const INSTALLED_THEME_ROOT = join(fileURLToPath(new URL('../../../../../', import.meta.url)), 'src/lib/themes/installed');

const getInstalledThemeIds = () => {
  if (!existsSync(INSTALLED_THEME_ROOT)) return [];
  return readdirSync(INSTALLED_THEME_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
};

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const installedIds = new Set(getInstalledThemeIds());
    const settings = await settingsService.getSettings([
      'appearance.theme.active',
      'appearance.theme.mode'
    ]);
    const configuredActiveTheme = typeof settings['appearance.theme.active'] === 'string'
      ? settings['appearance.theme.active']
      : 'adastro';
    const activeMode = typeof settings['appearance.theme.mode'] === 'string'
      ? settings['appearance.theme.mode']
      : 'system';
    const themeModules = getThemeModules();
    const activeTheme = themeModules.some((theme) => theme.id === configuredActiveTheme)
      ? configuredActiveTheme
      : 'adastro';

    const themes = themeModules.map((theme) => ({
      id: theme.id,
      label: theme.label,
      description: theme.description,
      version: theme.version,
      author: theme.author,
      previewImage: theme.previewImage,
      accent: theme.accent,
      fonts: theme.fonts,
      fontImports: theme.fontImports,
      installed: installedIds.has(theme.id),
      bundled: !installedIds.has(theme.id),
      active: theme.id === activeTheme
    }));

    return new Response(JSON.stringify({ themes, activeTheme, activeMode }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error loading themes:', error);
    return new Response(JSON.stringify({ error: 'Failed to load themes' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
