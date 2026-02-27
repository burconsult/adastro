import type { APIRoute } from 'astro';
import { SettingsService } from '../../../../lib/services/settings-service.js';
import { DatabaseError } from '../../../../lib/database/connection.js';
import { requireAdmin } from '../../../../lib/auth/auth-helpers.js';

const settingsService = new SettingsService();

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const format = url.searchParams.get('format') || 'json';

    if (format === 'backup') {
      // Create full backup with metadata
      const backup = await settingsService.createBackup();
      
      return new Response(JSON.stringify(backup, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="settings-backup-${new Date().toISOString().split('T')[0]}.json"`
        }
      });
    } else {
      // Export settings as simple key-value pairs
      const settings = await settingsService.exportSettings(category || undefined);
      
      return new Response(JSON.stringify(settings, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="settings-export-${category || 'all'}-${new Date().toISOString().split('T')[0]}.json"`
        }
      });
    }
  } catch (error) {
    console.error('Error creating settings backup:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof DatabaseError ? error.message : 'Failed to create backup' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const admin = await requireAdmin(request);
    const body = await request.json();
    const { backup, settings } = body;

    if (backup) {
      // Restore from full backup
      await settingsService.restoreFromBackup(backup);
    } else if (settings) {
      // Import settings
      await settingsService.importSettings(settings, admin.id);
    } else {
      return new Response(JSON.stringify({ error: 'Either backup or settings data is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error restoring settings:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof DatabaseError ? error.message : 'Failed to restore settings' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
