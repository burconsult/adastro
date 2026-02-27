import type { APIRoute } from 'astro';
import { SettingsService } from '@/lib/services/settings-service';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { getClientIp } from '@/lib/security/request-guards';
import { supabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase';

const settingsService = new SettingsService();

const text = (value: unknown, max: number) =>
  (typeof value === 'string' ? value.trim() : '').slice(0, max);

const normalizePath = (value: string) => {
  if (!value.startsWith('/')) return '/';
  return value.slice(0, 255);
};

const getReferrerHost = (value: string) => {
  if (!value) return '';
  try {
    return new URL(value).host.slice(0, 255);
  } catch {
    return '';
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (!isSupabaseAdminConfigured) {
    return new Response(null, { status: 204 });
  }

  try {
    const analyticsEnabled = Boolean(await settingsService.getSetting('analytics.enabled'));
    if (!analyticsEnabled) {
      return new Response(null, { status: 204 });
    }

    const ip = getClientIp(request);
    const limiter = checkRateLimit({
      key: `analytics:track:${ip}`,
      limit: 180,
      windowMs: 60_000
    });
    if (!limiter.allowed) {
      return new Response(null, { status: 202 });
    }

    const payload = await request.json().catch(() => ({}));
    const path = normalizePath(text(payload.path, 255));
    if (
      path.startsWith('/admin') ||
      path.startsWith('/auth') ||
      path.startsWith('/api') ||
      path.startsWith('/setup')
    ) {
      return new Response(null, { status: 204 });
    }

    const query = text(payload.query, 500);
    const title = text(payload.title, 240);
    const referrerHost = getReferrerHost(text(payload.referrer, 1000));
    const viewport = text(payload.viewport, 64);
    const userAgent = text(request.headers.get('user-agent') || '', 500);

    await supabaseAdmin.from('analytics_events').insert({
      event_type: 'page_view',
      entity_type: 'page',
      data: {
        path,
        query,
        title,
        referrerHost,
        viewport
      },
      user_agent: userAgent || null
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.warn('Analytics track failed (non-blocking):', error);
    return new Response(null, { status: 202 });
  }
};

export const prerender = false;

