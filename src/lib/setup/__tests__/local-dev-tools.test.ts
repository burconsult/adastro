import { afterEach, describe, expect, it } from 'vitest';

import {
  buildLocalAppEnv,
  formatShellEnvExports,
  parseLocalSupabaseConfig,
  parseSupabaseStatusEnv,
  resolveLocalSiteUrl
} from '../../../../scripts/local/lib.mjs';

describe('local dev tooling helpers', () => {
  afterEach(() => {
    delete process.env.LOCAL_APP_HOST;
    delete process.env.LOCAL_APP_PORT;
    delete process.env.LOCAL_SITE_URL;
  });

  it('parses the checked-in Supabase config fields needed for local tooling', () => {
    const config = parseLocalSupabaseConfig(`
project_id = "infra"

[api]
port = 55321

[db]
port = 55322
shadow_port = 55320

[db.pooler]
port = 55329

[studio]
port = 55323

[inbucket]
port = 55324

[analytics]
port = 55327
`);

    expect(config.projectId).toBe('infra');
    expect(config.ports).toEqual({
      api: 55321,
      analytics: 55327,
      db: 55322,
      dbPooler: 55329,
      dbShadow: 55320,
      mailpit: 55324,
      studio: 55323
    });
  });

  it('parses env-style output from `supabase status -o env`', () => {
    const env = parseSupabaseStatusEnv(`
API_URL="http://127.0.0.1:55321"
DB_URL="postgresql://postgres:postgres@127.0.0.1:55322/postgres"
PUBLISHABLE_KEY="sb_publishable_example"
SERVICE_ROLE_KEY="sb_secret_example"
`);

    expect(env.API_URL).toBe('http://127.0.0.1:55321');
    expect(env.DB_URL).toBe('postgresql://postgres:postgres@127.0.0.1:55322/postgres');
    expect(env.PUBLISHABLE_KEY).toBe('sb_publishable_example');
    expect(env.SERVICE_ROLE_KEY).toBe('sb_secret_example');
  });

  it('derives SITE_URL from configurable local app host and port', () => {
    process.env.LOCAL_APP_HOST = '0.0.0.0';
    process.env.LOCAL_APP_PORT = '4444';

    expect(resolveLocalSiteUrl()).toBe('http://0.0.0.0:4444');
  });

  it('prefers an explicit LOCAL_SITE_URL override', () => {
    process.env.LOCAL_SITE_URL = 'https://custom.local.test';
    process.env.LOCAL_APP_HOST = '0.0.0.0';
    process.env.LOCAL_APP_PORT = '4444';

    expect(resolveLocalSiteUrl()).toBe('https://custom.local.test');
  });

  it('builds local app env from Supabase status output and app port options', () => {
    const env = buildLocalAppEnv(
      {
        API_URL: 'http://127.0.0.1:55321',
        ANON_KEY: 'local-anon-key',
        SERVICE_ROLE_KEY: 'local-secret-key'
      },
      { host: '127.0.0.1', port: '4555' }
    );

    expect(env.SUPABASE_URL).toBe('http://127.0.0.1:55321');
    expect(env.SUPABASE_PUBLISHABLE_KEY).toBe('local-anon-key');
    expect(env.SUPABASE_SECRET_KEY).toBe('local-secret-key');
    expect(env.SITE_URL).toBe('http://127.0.0.1:4555');
  });

  it('formats shell exports safely for copy/paste', () => {
    const output = formatShellEnvExports({
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
      SUPABASE_SECRET_KEY: 'secret-key',
      SITE_URL: "http://let's.local"
    });

    expect(output).toContain("export SUPABASE_URL='https://test.supabase.co'");
    expect(output).toContain("export SITE_URL='http://let'\\''s.local'");
  });
});
