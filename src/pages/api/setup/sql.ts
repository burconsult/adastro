import type { APIRoute } from 'astro';
import coreSql from '../../../../infra/supabase/migrations/000_core.sql?raw';
import seedSql from '../../../../infra/supabase/seed.sql?raw';
import adminSql from '../../../../infra/supabase/setup-admin-user.sql?raw';
import { assertSetupApiAccess, SetupAccessError } from '@/lib/setup/gate';

const templates: Record<string, { name: string; sql: string }> = {
  core: {
    name: 'Core Schema',
    sql: coreSql
  },
  seed: {
    name: 'Optional Demo Content',
    sql: seedSql
  },
  admin: {
    name: 'Admin User Role',
    sql: adminSql
  }
};

export const GET: APIRoute = async ({ request, url }) => {
  try {
    await assertSetupApiAccess(request);
  } catch (error) {
    if (error instanceof SetupAccessError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      });
    }
    throw error;
  }

  const template = (url.searchParams.get('template') || '').trim().toLowerCase();
  const selected = templates[template];

  if (!selected) {
    return new Response(JSON.stringify({ error: 'Unknown SQL template.' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  }

  return new Response(JSON.stringify({
    template,
    name: selected.name,
    sql: selected.sql
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
};
