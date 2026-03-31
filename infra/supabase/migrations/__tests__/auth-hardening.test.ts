import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const coreSql = readFileSync(resolve(process.cwd(), 'infra/supabase/migrations/000_core.sql'), 'utf8');
const hardeningSql = readFileSync(resolve(process.cwd(), 'infra/supabase/migrations/006_auth_hardening_azure_mfa.sql'), 'utf8');

describe('auth hardening SQL', () => {
  it('keeps role-less authenticated users at reader level', () => {
    expect(coreSql).toContain("COALESCE(NULLIF(auth.jwt() -> 'app_metadata' ->> 'role', ''), 'reader')");
    expect(hardeningSql).toContain("COALESCE(NULLIF(auth.jwt() -> 'app_metadata' ->> 'role', ''), 'reader')");
  });

  it('stops auto-provisioning author rows from auth user creation', () => {
    expect(coreSql).not.toContain('INSERT INTO public.authors (auth_user_id, name, email, slug)');
    expect(hardeningSql).toContain('RETURN new;');
  });
});
