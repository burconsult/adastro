import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const coreSql = readFileSync(resolve(process.cwd(), 'infra/supabase/migrations/000_core.sql'), 'utf8');
const upgradeSql = readFileSync(
  resolve(process.cwd(), 'infra/supabase/migrations/010_scheduled_publishing.sql'),
  'utf8'
);

describe.each([
  ['core baseline', coreSql],
  ['upgrade migration', upgradeSql]
])('scheduled publishing SQL in %s', (_label, sql) => {
  it('keeps one active queue entry synchronized per scheduled post', () => {
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_posts_one_active_per_post');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_scheduled_posts_pending_due');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.sync_scheduled_post_queue()');
    expect(sql).toContain('CREATE TRIGGER sync_scheduled_post_queue');
    expect(sql).toContain("ON CONFLICT (post_id) WHERE status IN ('pending', 'processing')");
  });

  it('claims due work safely for duplicate or overlapping runs', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.process_scheduled_posts');
    expect(sql).toContain('FOR UPDATE OF post SKIP LOCKED');
    expect(sql).toContain("schedule.status = 'pending'");
    expect(sql).toContain("post.status = 'scheduled'");
  });

  it('creates a publication version and retries isolated failures', () => {
    expect(sql).toContain('PERFORM public.create_post_version');
    expect(sql).toContain('retry_count = retry_count + 1');
    expect(sql).toContain("WHEN retry_count + 1 >= 3 THEN 'failed'");
  });

  it('keeps worker and trigger functions off the public RPC surface', () => {
    expect(sql).toContain(
      'REVOKE EXECUTE ON FUNCTION public.sync_scheduled_post_queue()'
    );
    expect(sql).toContain(
      'REVOKE EXECUTE ON FUNCTION public.process_scheduled_posts(integer)'
    );
    expect(sql).toContain('FROM PUBLIC, anon, authenticated;');
    expect(sql).toContain('TO service_role;');
  });

  it('installs a one-minute reconciliation job through Supabase Cron', () => {
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS pg_cron');
    expect(sql).toContain("'adastro-publish-scheduled-posts'");
    expect(sql).toContain("'* * * * *'");
    expect(sql).toContain("'SELECT public.process_scheduled_posts(100);'");
  });
});
