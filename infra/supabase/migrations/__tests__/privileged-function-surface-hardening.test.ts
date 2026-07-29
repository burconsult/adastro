import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const coreSql = readFileSync(resolve(process.cwd(), 'infra/supabase/migrations/000_core.sql'), 'utf8');
const upgradeSql = readFileSync(
  resolve(
    process.cwd(),
    'infra/supabase/migrations/009_privileged_function_surface_hardening.sql'
  ),
  'utf8'
);

describe.each([
  ['core baseline', coreSql],
  ['upgrade migration', upgradeSql]
])('privileged function hardening SQL in %s', (_label, sql) => {
  it('does not expose a generic privileged site-settings reader', () => {
    expect(sql).not.toContain('CREATE OR REPLACE FUNCTION public.get_site_setting_text');
    expect(sql).not.toContain(
      'GRANT EXECUTE ON FUNCTION public.get_site_setting_text(text, text) TO anon'
    );
  });

  it('limits public storage helpers to fixed bucket setting keys', () => {
    expect(sql).toContain("WHERE key = 'storage.buckets.media'");
    expect(sql).toContain("WHERE key = 'storage.buckets.migrationUploads'");
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.media_storage_bucket()');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.migration_uploads_bucket()');
    expect(sql).toContain("SET search_path = ''");
  });

  it('uses invoker rights for JWT-only role helpers', () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.current_role\(\)[\s\S]*?SECURITY INVOKER/
    );
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.is_admin\(\)[\s\S]*?SECURITY INVOKER/
    );
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.is_author\(\)[\s\S]*?SECURITY INVOKER/
    );
  });

  it('does not install the no-op auth-user trigger in the baseline', () => {
    expect(sql).not.toContain('CREATE TRIGGER on_auth_user_created');
    if (_label === 'core baseline') {
      expect(sql).not.toContain('CREATE OR REPLACE FUNCTION public.handle_new_auth_user');
    }
  });

  it('blocks direct client execution of the updated-at trigger function', () => {
    expect(sql).toContain(
      'REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()'
    );
    expect(sql).toContain('FROM PUBLIC, anon, authenticated, service_role;');
  });
});

describe('privileged function upgrade migration', () => {
  it('removes the legacy generic reader and locks down the retained auth trigger function', () => {
    expect(upgradeSql).toContain(
      'DROP FUNCTION IF EXISTS public.get_site_setting_text(text, text);'
    );
    expect(upgradeSql).toContain('CREATE OR REPLACE FUNCTION public.handle_new_auth_user()');
    expect(upgradeSql).toContain(
      'REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user()'
    );
    expect(upgradeSql).toContain('FROM PUBLIC, anon, authenticated, service_role;');
  });
});
