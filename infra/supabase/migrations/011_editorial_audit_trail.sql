-- Migration: Editorial Audit Trail
-- Created: 2026-07-29
-- Description: Add an immutable, admin-readable activity ledger with
-- service-only writes, cursor-friendly indexes, export, and bounded retention.

CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_label TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('admin', 'author', 'reader', 'system')),
  action TEXT NOT NULL CHECK (char_length(action) BETWEEN 1 AND 100),
  entity_type TEXT NOT NULL CHECK (char_length(entity_type) BETWEEN 1 AND 100),
  entity_id TEXT,
  entity_label TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  source TEXT NOT NULL DEFAULT 'admin'
    CHECK (source IN ('admin', 'api', 'mcp', 'system', 'migration')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_created_cursor
  ON public.audit_events(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity_cursor
  ON public.audit_events(entity_type, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_cursor
  ON public.audit_events(actor_user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_action_cursor
  ON public.audit_events(action, created_at DESC, id DESC);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can read audit events" ON public.audit_events;
CREATE POLICY "Admin can read audit events" ON public.audit_events
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Service can insert audit events" ON public.audit_events;
CREATE POLICY "Service can insert audit events" ON public.audit_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

REVOKE ALL ON TABLE public.audit_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.audit_events TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.audit_events TO service_role;

CREATE OR REPLACE FUNCTION public.guard_audit_events_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE'
    AND current_setting('adastro.audit_retention', true) = 'on'
  THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'audit events are immutable';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_audit_events_immutable()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS guard_audit_events_immutable ON public.audit_events;
CREATE TRIGGER guard_audit_events_immutable
  BEFORE UPDATE OR DELETE ON public.audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_audit_events_immutable();

CREATE OR REPLACE FUNCTION public.prune_audit_events(retention_days integer DEFAULT 365)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  safe_retention_days integer := LEAST(GREATEST(COALESCE(retention_days, 365), 30), 3650);
  deleted_count integer;
BEGIN
  PERFORM set_config('adastro.audit_retention', 'on', true);

  DELETE FROM public.audit_events
  WHERE created_at < statement_timestamp() - make_interval(days => safe_retention_days);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prune_audit_events(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_audit_events(integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.audit_scheduled_publication()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Admin/API mutations use the service-role PostgREST client and write their
  -- actor-aware event in the application route. The cron session has no JWT,
  -- so only automatic publication is recorded here.
  IF COALESCE(
    current_setting('request.jwt.claim.role', true),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) = 'service_role' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.audit_events (
    actor_user_id,
    actor_label,
    actor_role,
    action,
    entity_type,
    entity_id,
    entity_label,
    metadata,
    source
  )
  VALUES (
    NULL,
    'Scheduled publishing worker',
    'system',
    'post.publish',
    'post',
    NEW.id::text,
    NEW.title,
    jsonb_build_object(
      'previousStatus', OLD.status,
      'status', NEW.status,
      'scheduledFor', NEW.published_at
    ),
    'system'
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_scheduled_publication()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS audit_scheduled_publication ON public.posts;
CREATE TRIGGER audit_scheduled_publication
  AFTER UPDATE OF status ON public.posts
  FOR EACH ROW
  WHEN (OLD.status = 'scheduled' AND NEW.status = 'published')
  EXECUTE FUNCTION public.audit_scheduled_publication();

INSERT INTO public.site_settings (key, value, category, description)
VALUES (
  'audit.retentionDays',
  '365'::jsonb,
  'system',
  'Retention period for immutable editorial audit events before explicit pruning.'
)
ON CONFLICT (key) DO NOTHING;
