import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const coreSql = readFileSync(resolve(process.cwd(), 'infra/supabase/migrations/000_core.sql'), 'utf8');
const upgradeSql = readFileSync(resolve(process.cwd(), 'infra/supabase/migrations/008_content_versioning.sql'), 'utf8');

describe.each([
  ['core baseline', coreSql],
  ['upgrade migration', upgradeSql]
])('content versioning SQL in %s', (_label, sql) => {
  it('creates private post and page version tables with valid JSON snapshots', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS (?:public\.)?post_versions/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS (?:public\.)?page_versions/);
    expect(sql).toContain("snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object')");
    expect(sql).toContain('ALTER TABLE public.post_versions FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE public.page_versions FORCE ROW LEVEL SECURITY');
  });

  it('allocates version numbers under per-content transaction locks', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.create_post_version');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.create_page_version');
    expect(sql).toContain("hashtextextended('post_versions:' || target_post_id::text, 0)");
    expect(sql).toContain("hashtextextended('page_versions:' || target_page_id::text, 0)");
    expect(sql).toContain('COALESCE(MAX(version_number), 0) + 1');
  });

  it('keeps version allocator RPCs service-role-only', () => {
    expect(sql).toContain(
      'REVOKE EXECUTE ON FUNCTION public.create_post_version(UUID, JSONB, UUID)'
    );
    expect(sql).toContain(
      'REVOKE EXECUTE ON FUNCTION public.create_page_version(UUID, JSONB, UUID)'
    );
    expect(sql).toContain('FROM PUBLIC, anon, authenticated;');
    expect(sql).toContain('TO service_role;');
  });

  it('prevents clients from bypassing the server-side version allocator', () => {
    expect(sql).toContain(
      'REVOKE ALL ON TABLE public.post_versions, public.page_versions'
    );
    expect(sql).toContain(
      'GRANT SELECT, DELETE ON TABLE public.post_versions, public.page_versions'
    );
    expect(sql).not.toContain('CREATE POLICY "Authors can insert own post versions"');
    expect(sql).not.toContain('CREATE POLICY "Authors can insert own page versions"');
  });

  it('keeps version history immutable while allowing admin retention cleanup', () => {
    expect(sql).toContain('CREATE POLICY "Admin can delete post versions"');
    expect(sql).toContain('CREATE POLICY "Admin can delete page versions"');
    expect(sql).not.toContain('CREATE POLICY "Admin can manage post versions"');
    expect(sql).not.toContain('CREATE POLICY "Admin can manage page versions"');
  });

  if (_label === 'upgrade migration') {
    it('replaces policies safely when the consolidated baseline already created them', () => {
      expect(sql).toContain(
        'DROP POLICY IF EXISTS "Authors can read own post versions"'
      );
      expect(sql).toContain(
        'DROP POLICY IF EXISTS "Authors can read own page versions"'
      );
    });
  }
});
