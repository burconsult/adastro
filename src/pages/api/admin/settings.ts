import type { APIRoute } from 'astro';
import { SettingsService } from '../../../lib/services/settings-service.js';
import { resetAllSiteConfigCaches } from '../../../lib/site-config.js';
import { DatabaseError } from '../../../lib/database/connection.js';
import { requireAdmin } from '../../../lib/auth/auth-helpers.js';
import {
  applyBundledFeatureMigrations,
  getFeatureIdFromEnableKey,
  toBoolean
} from '../../../lib/features/migrations.js';
import { normalizeFeatureFlag } from '../../../lib/features/flags.js';

const settingsService = new SettingsService();

const getFeatureActivations = async (updates: Record<string, unknown>): Promise<string[]> => {
  const activations = new Set<string>();

  for (const [key, nextValue] of Object.entries(updates)) {
    const featureId = getFeatureIdFromEnableKey(key);
    if (!featureId || !toBoolean(nextValue)) continue;

    const currentValue = await settingsService.getSetting(key);
    const currentlyEnabled = normalizeFeatureFlag(currentValue, false);
    if (!currentlyEnabled) {
      activations.add(featureId);
    }
  }

  return [...activations];
};

export const GET: APIRoute = async ({ request, url }) => {
  try {
    await requireAdmin(request);
    const searchParams = new URL(request.url).searchParams;
    const category = searchParams.get('category');
    const keys = searchParams.get('keys');

    if (category) {
      // Get settings by category
      const categoryData = await settingsService.getSettingsByCategory(category);
      return new Response(JSON.stringify(categoryData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (keys) {
      // Get specific settings by keys
      const keyArray = keys.split(',').map(k => k.trim());
      const settings = await settingsService.getSettings(keyArray);
      return new Response(JSON.stringify(settings), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Get all categories
      const allCategories = await settingsService.getAllCategories();
      return new Response(JSON.stringify(allCategories), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Error fetching settings:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof DatabaseError ? error.message : 'Failed to fetch settings' 
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
    const { key, value } = body;

    if (!key) {
      return new Response(JSON.stringify({ error: 'Setting key is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const featureId = getFeatureIdFromEnableKey(key);
    if (featureId && toBoolean(value)) {
      const currentValue = await settingsService.getSetting(key);
      if (!normalizeFeatureFlag(currentValue, false)) {
        await applyBundledFeatureMigrations(featureId);
      }
    }

    await settingsService.setSetting(key, value, admin.id);
    resetAllSiteConfigCaches();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating setting:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof DatabaseError ? error.message : 'Failed to create setting' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const admin = await requireAdmin(request);
    const body = await request.json();
    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return new Response(JSON.stringify({ error: 'Settings object is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const featureActivations = await getFeatureActivations(settings);
    for (const featureId of featureActivations) {
      await applyBundledFeatureMigrations(featureId);
    }

    await settingsService.updateSettings(settings, admin.id);
    resetAllSiteConfigCaches();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof DatabaseError ? error.message : 'Failed to update settings' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const { category } = body;

    if (category) {
      // Reset category to defaults
      await settingsService.resetToDefaults(category);
    } else {
      // Reset all settings to defaults
      await settingsService.resetToDefaults();
    }
    resetAllSiteConfigCaches();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error resetting settings:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof DatabaseError ? error.message : 'Failed to reset settings' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
