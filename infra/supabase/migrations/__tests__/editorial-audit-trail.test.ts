import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const coreSql = readFileSync(resolve(process.cwd(), 'infra/supabase/migrations/000_core.sql'), 'utf8');
const upgradeSql = readFileSync(
  resolve(process.cwd(), 'infra/supabase/migrations/011_editorial_audit_trail.sql'),
  'utf8'
);

describe.each([
  ['core baseline', coreSql],
  ['upgrade migration', upgradeSql]
])('editorial audit trail SQL in %s', (_label, sql) => {
  it('creates a constrained audit ledger with cursor-friendly indexes', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.audit_events');
    expect(sql).toContain("CHECK (jsonb_typeof(metadata) = 'object')");
    expect(sql).toContain('idx_audit_events_created_cursor');
    expect(sql).toContain('created_at DESC, id DESC');
    expect(sql).toContain('idx_audit_events_actor_cursor');
  });

  it('forces RLS and grants only the required table operations', () => {
    expect(sql).toContain('ALTER TABLE public.audit_events FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('CREATE POLICY "Admin can read audit events"');
    expect(sql).toContain('CREATE POLICY "Service can insert audit events"');
    expect(sql).toContain(
      'REVOKE ALL ON TABLE public.audit_events FROM PUBLIC, anon, authenticated, service_role'
    );
    expect(sql).toContain('GRANT SELECT ON TABLE public.audit_events TO authenticated');
    expect(sql).toContain(
      'GRANT SELECT, INSERT, DELETE ON TABLE public.audit_events TO service_role'
    );
  });

  it('blocks mutation except through bounded service-role retention', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.guard_audit_events_immutable()');
    expect(sql).toContain("RAISE EXCEPTION 'audit events are immutable'");
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.prune_audit_events');
    expect(sql).toContain('GREATEST(COALESCE(retention_days, 365), 30)');
    expect(sql).toContain('LEAST(');
    expect(sql).toContain('TO service_role;');
  });

  it('records automatic scheduled publication inside the database transaction', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.audit_scheduled_publication()');
    expect(sql).toContain('CREATE TRIGGER audit_scheduled_publication');
    expect(sql).toContain("WHEN (OLD.status = 'scheduled' AND NEW.status = 'published')");
    expect(sql).toContain("'Scheduled publishing worker'");
  });
});
