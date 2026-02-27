import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/auth/auth-helpers.js';
import { SettingsService } from '../../../../lib/services/settings-service.js';
import { getThemeModuleById } from '../../../../lib/themes/registry.js';
import { resetSiteThemeCache } from '../../../../lib/site-config.js';

const settingsService = new SettingsService();
const allowedModes = new Set(['light', 'dark', 'system']);

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const payload = await request.json().catch(() => ({}));
    const themeId = typeof payload.id === 'string' ? payload.id.trim() : '';
    const mode = typeof payload.mode === 'string' ? payload.mode.trim() : '';

    if (!themeId) {
      return new Response(JSON.stringify({ error: 'Theme id is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const theme = getThemeModuleById(themeId);
    if (!theme) {
      return new Response(JSON.stringify({ error: 'Unknown theme id.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const updates: Record<string, any> = { 'appearance.theme.active': themeId };
    if (allowedModes.has(mode)) {
      updates['appearance.theme.mode'] = mode;
    }

    await settingsService.updateSettings(updates);
    resetSiteThemeCache();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Theme activation failed:', error);
    return new Response(JSON.stringify({ error: 'Failed to activate theme.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
