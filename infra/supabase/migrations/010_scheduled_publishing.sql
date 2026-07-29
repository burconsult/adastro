-- Migration: Scheduled Publishing
-- Created: 2026-07-29
-- Description: Synchronize scheduled posts into a durable queue and publish
-- due entries atomically through a one-minute Supabase Cron reconciliation job.

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'posts_scheduled_publish_at_check'
      AND conrelid = 'public.posts'::regclass
  ) THEN
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_scheduled_publish_at_check
      CHECK (status <> 'scheduled' OR published_at IS NOT NULL);
  END IF;
END;
$$;

-- Retire stale or duplicate active queue entries before enforcing one active
-- schedule per post.
UPDATE public.scheduled_posts AS schedule
SET
  status = 'cancelled',
  error_message = 'Schedule no longer matches a scheduled post.'
WHERE schedule.status IN ('pending', 'processing')
  AND NOT EXISTS (
    SELECT 1
    FROM public.posts AS post
    WHERE post.id = schedule.post_id
      AND post.status = 'scheduled'
      AND post.published_at IS NOT NULL
  );

WITH ranked_active_schedules AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY post_id
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS schedule_rank
  FROM public.scheduled_posts
  WHERE status IN ('pending', 'processing')
)
UPDATE public.scheduled_posts AS schedule
SET
  status = 'cancelled',
  error_message = 'Superseded by a newer active schedule.'
FROM ranked_active_schedules AS ranked
WHERE schedule.id = ranked.id
  AND ranked.schedule_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_posts_one_active_per_post
  ON public.scheduled_posts(post_id)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_pending_due
  ON public.scheduled_posts(scheduled_for, id, post_id)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.sync_scheduled_post_queue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'scheduled' AND NEW.published_at IS NOT NULL THEN
    INSERT INTO public.scheduled_posts (
      post_id,
      scheduled_for,
      status,
      retry_count,
      error_message
    )
    VALUES (
      NEW.id,
      NEW.published_at,
      'pending',
      0,
      NULL
    )
    ON CONFLICT (post_id) WHERE status IN ('pending', 'processing')
    DO UPDATE SET
      scheduled_for = EXCLUDED.scheduled_for,
      status = 'pending',
      retry_count = 0,
      error_message = NULL;
  ELSIF TG_OP = 'UPDATE'
    AND OLD.status = 'scheduled'
    AND NEW.status <> 'scheduled'
  THEN
    UPDATE public.scheduled_posts
    SET
      status = CASE
        WHEN NEW.status = 'published' THEN 'published'
        ELSE 'cancelled'
      END,
      error_message = NULL
    WHERE post_id = NEW.id
      AND status IN ('pending', 'processing');
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_scheduled_post_queue()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS sync_scheduled_post_queue ON public.posts;
CREATE TRIGGER sync_scheduled_post_queue
  AFTER INSERT OR UPDATE OF status, published_at ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_scheduled_post_queue();

-- Backfill posts scheduled before queue synchronization was installed.
INSERT INTO public.scheduled_posts (
  post_id,
  scheduled_for,
  status,
  retry_count,
  error_message
)
SELECT
  post.id,
  post.published_at,
  'pending',
  0,
  NULL
FROM public.posts AS post
WHERE post.status = 'scheduled'
  AND post.published_at IS NOT NULL
ON CONFLICT (post_id) WHERE status IN ('pending', 'processing')
DO UPDATE SET
  scheduled_for = EXCLUDED.scheduled_for,
  status = 'pending',
  retry_count = 0,
  error_message = NULL;

CREATE OR REPLACE FUNCTION public.process_scheduled_posts(batch_size integer DEFAULT 100)
RETURNS TABLE (
  processed_schedule_id uuid,
  processed_post_id uuid,
  outcome text,
  processing_error text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  queue_item record;
  published_post public.posts%ROWTYPE;
  version_snapshot jsonb;
  failure_message text;
  retry_status text;
  safe_batch_size integer := LEAST(GREATEST(COALESCE(batch_size, 100), 1), 100);
BEGIN
  FOR queue_item IN
    SELECT
      schedule.id AS schedule_id,
      schedule.post_id
    FROM public.scheduled_posts AS schedule
    INNER JOIN public.posts AS post
      ON post.id = schedule.post_id
    WHERE schedule.status = 'pending'
      AND schedule.scheduled_for <= statement_timestamp()
      AND post.status = 'scheduled'
      AND post.published_at IS NOT NULL
      AND post.published_at <= statement_timestamp()
    ORDER BY schedule.scheduled_for ASC, schedule.id ASC
    -- Post updates acquire the post lock before the queue-sync trigger touches
    -- scheduled_posts. Match that order here to avoid editor/worker deadlocks.
    FOR UPDATE OF post SKIP LOCKED
    LIMIT safe_batch_size
  LOOP
    BEGIN
      UPDATE public.scheduled_posts
      SET
        status = 'processing',
        error_message = NULL
      WHERE id = queue_item.schedule_id;

      UPDATE public.posts AS post
      SET
        status = 'published',
        updated_at = statement_timestamp()
      WHERE post.id = queue_item.post_id
        AND post.status = 'scheduled'
        AND post.published_at IS NOT NULL
        AND post.published_at <= statement_timestamp()
      RETURNING post.* INTO published_post;

      IF NOT FOUND THEN
        UPDATE public.scheduled_posts
        SET
          status = 'cancelled',
          error_message = 'Post is no longer due for publication.'
        WHERE id = queue_item.schedule_id;

        processed_schedule_id := queue_item.schedule_id;
        processed_post_id := queue_item.post_id;
        outcome := 'cancelled';
        processing_error := NULL;
        RETURN NEXT;
        CONTINUE;
      END IF;

      SELECT jsonb_build_object(
        'schemaVersion', 1,
        'title', published_post.title,
        'slug', published_post.slug,
        'locale', published_post.locale,
        'content', published_post.content,
        'blocks', COALESCE(published_post.blocks, '[]'::jsonb),
        'excerpt', published_post.excerpt,
        'authorId', published_post.author_id,
        'status', published_post.status,
        'publishedAt', published_post.published_at,
        'categoryIds', COALESCE(
          (
            SELECT jsonb_agg(post_category.category_id ORDER BY post_category.category_id)
            FROM public.post_categories AS post_category
            WHERE post_category.post_id = published_post.id
          ),
          '[]'::jsonb
        ),
        'tagIds', COALESCE(
          (
            SELECT jsonb_agg(post_tag.tag_id ORDER BY post_tag.tag_id)
            FROM public.post_tags AS post_tag
            WHERE post_tag.post_id = published_post.id
          ),
          '[]'::jsonb
        ),
        'featuredImageId', published_post.featured_image_id,
        'audioAssetId', published_post.audio_asset_id,
        'seoMetadata', published_post.seo_metadata,
        'customFields', published_post.custom_fields
      )
      INTO version_snapshot;

      PERFORM public.create_post_version(
        published_post.id,
        version_snapshot,
        NULL
      );

      UPDATE public.scheduled_posts
      SET
        status = 'published',
        error_message = NULL
      WHERE id = queue_item.schedule_id;

      processed_schedule_id := queue_item.schedule_id;
      processed_post_id := queue_item.post_id;
      outcome := 'published';
      processing_error := NULL;
      RETURN NEXT;
    EXCEPTION
      WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS failure_message = MESSAGE_TEXT;

        UPDATE public.scheduled_posts
        SET
          retry_count = retry_count + 1,
          status = CASE
            WHEN retry_count + 1 >= 3 THEN 'failed'
            ELSE 'pending'
          END,
          error_message = LEFT(failure_message, 1000)
        WHERE id = queue_item.schedule_id
        RETURNING status INTO retry_status;

        processed_schedule_id := queue_item.schedule_id;
        processed_post_id := queue_item.post_id;
        outcome := COALESCE(retry_status, 'failed');
        processing_error := LEFT(failure_message, 1000);
        RETURN NEXT;
    END;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_scheduled_posts(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_scheduled_posts(integer)
  TO service_role;

-- Reconcile every minute. The worker uses row locks and state checks, so missed,
-- duplicate, or overlapping invocations are safe.
DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  FOR existing_job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'adastro-publish-scheduled-posts'
  LOOP
    PERFORM cron.unschedule(existing_job_id);
  END LOOP;

  PERFORM cron.schedule(
    'adastro-publish-scheduled-posts',
    '* * * * *',
    'SELECT public.process_scheduled_posts(100);'
  );
END;
$$;
