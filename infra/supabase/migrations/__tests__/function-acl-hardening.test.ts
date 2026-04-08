import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const coreSql = readFileSync(resolve(process.cwd(), 'infra/supabase/migrations/000_core.sql'), 'utf8');
const hardeningSql = readFileSync(resolve(process.cwd(), 'infra/supabase/migrations/007_function_acl_hardening.sql'), 'utf8');

describe('function ACL hardening SQL', () => {
  it('keeps exec_sql service-role-only in the baseline and upgrade migration', () => {
    expect(coreSql).toContain(
      'REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM PUBLIC, anon, authenticated;'
    );
    expect(coreSql).toContain('GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;');
    expect(hardeningSql).toContain(
      'REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM PUBLIC, anon, authenticated;'
    );
    expect(hardeningSql).toContain('GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;');
  });

  it('hardens future default function privileges for Supabase owner roles', () => {
    expect(coreSql).toContain(
      "ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, PUBLIC"
    );
    expect(hardeningSql).toContain(
      "ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, PUBLIC"
    );
  });
});
