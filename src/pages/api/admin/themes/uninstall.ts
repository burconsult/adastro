import type { APIRoute } from 'astro';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAdmin } from '../../../../lib/auth/auth-helpers.js';
import { SettingsService } from '../../../../lib/services/settings-service.js';
import { resetSiteThemeCache } from '../../../../lib/site-config.js';

const settingsService = new SettingsService();
const PROJECT_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const INSTALLED_THEME_ROOT = join(PROJECT_ROOT, 'src/lib/themes/installed');
const THEME_UNINSTALL_SCRIPT = join(PROJECT_ROOT, 'infra/themes/uninstall.js');

const runUninstaller = (themeId: string) =>
  new Promise<void>((resolve, reject) => {
    execFile(process.execPath, [THEME_UNINSTALL_SCRIPT, themeId], { cwd: PROJECT_ROOT }, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const payload = await request.json().catch(() => ({}));
    const themeId = typeof payload.id === 'string' ? payload.id.trim() : '';

    if (!themeId) {
      return new Response(JSON.stringify({ error: 'Theme id is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const installedRoot = join(INSTALLED_THEME_ROOT, themeId);
    if (!existsSync(installedRoot)) {
      return new Response(JSON.stringify({ error: 'Only installed themes can be removed.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await runUninstaller(themeId);

    const activeTheme = await settingsService.getSetting('appearance.theme.active');
    if (typeof activeTheme === 'string' && activeTheme === themeId) {
      await settingsService.updateSettings({ 'appearance.theme.active': 'adastro' });
      resetSiteThemeCache();
    }

    return new Response(JSON.stringify({ success: true, requiresRestart: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Theme uninstall failed:', error);
    return new Response(JSON.stringify({ error: 'Failed to uninstall theme.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
