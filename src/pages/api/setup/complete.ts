import type { APIRoute } from 'astro';
import { isSupabaseAdminConfigured, supabaseAdmin } from '@/lib/supabase';
import { resetAllSiteConfigCaches } from '@/lib/site-config';
import {
  hasRequiredSetupEnv,
  isMissingRelationError,
  SETUP_COMPLETION_KEY
} from '@/lib/setup/runtime';

const probeTable = async (tableName: string): Promise<boolean> => {
  const { error } = await (supabaseAdmin as any)
    .from(tableName)
    .select('*', { head: true, count: 'exact' })
    .limit(1);

  if (!error) return true;
  const message = String(error.message || '').toLowerCase();
  if (
    isMissingRelationError(message)
  ) {
    return false;
  }
  throw new Error(error.message);
};

const hasAdminUser = async (): Promise<boolean> => {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200
  });
  if (error) {
    throw new Error(error.message);
  }
  return (data?.users || []).some((user) => user.app_metadata?.role === 'admin');
};

const hasCoreSystemPages = async (): Promise<{ ready: boolean; missing: string[] }> => {
  const requiredSlugs = ['home', 'about', 'contact'];
  const { data, error } = await (supabaseAdmin as any)
    .from('pages')
    .select('slug, status')
    .in('slug', requiredSlugs)
    .eq('status', 'published');

  if (error) {
    throw new Error(error.message);
  }

  const existing = new Set((data || []).map((row: { slug?: string }) => row.slug).filter(Boolean));
  const missing = requiredSlugs.filter((slug) => !existing.has(slug));
  return {
    ready: missing.length === 0,
    missing
  };
};

export const POST: APIRoute = async () => {
  try {
    if (!isSupabaseAdminConfigured || !hasRequiredSetupEnv()) {
      return new Response(JSON.stringify({
        error: 'Required Supabase environment is incomplete. Configure env vars and redeploy first.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      });
    }

    const hasCoreSchema = await probeTable('site_settings');
    if (!hasCoreSchema) {
      return new Response(JSON.stringify({
        error: 'Core schema is not installed. Run Core Schema SQL first.'
      }), {
        status: 409,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      });
    }

    const adminExists = await hasAdminUser();
    if (!adminExists) {
      return new Response(JSON.stringify({
        error: 'No admin user detected. Complete admin bootstrap before finalizing setup.'
      }), {
        status: 409,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      });
    }

    const systemPages = await hasCoreSystemPages();
    if (!systemPages.ready) {
      return new Response(JSON.stringify({
        error: `Missing required system pages: ${systemPages.missing.join(', ')}. Run Setup Step 4 automation or create those pages before finalizing setup.`
      }), {
        status: 409,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      });
    }

    const { error } = await (supabaseAdmin as any)
      .from('site_settings')
      .upsert({
        key: SETUP_COMPLETION_KEY,
        value: true,
        category: 'system',
        description: 'Setup completion gate flag'
      }, {
        onConflict: 'key'
      });

    if (error) {
      throw new Error(error.message);
    }

    resetAllSiteConfigCaches();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('Setup complete API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to complete setup.' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  }
};
