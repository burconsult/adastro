-- Migration: Analytics Retention Hardening
-- Created: 2026-03-25
-- Description: Add analytics retention defaults and tighten a few database security baselines.

INSERT INTO public.site_settings (key, value, category, description)
VALUES (
  'analytics.retention',
  '{"retentionDays":180,"warnAtRowCount":250000,"archiveBeforePrune":true}'::jsonb,
  'general',
  'Hidden admin-managed configuration for analytics archive and prune rules.'
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Service can insert analytics events" ON public.analytics_events;
CREATE POLICY "Service can insert analytics events" ON public.analytics_events
  FOR INSERT TO service_role
  WITH CHECK ((select auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Service can insert system logs" ON public.system_logs;
CREATE POLICY "Service can insert system logs" ON public.system_logs
  FOR INSERT TO service_role
  WITH CHECK ((select auth.role()) = 'service_role');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.schema_migrations FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Service can manage schema migrations" ON public.schema_migrations';
    EXECUTE 'CREATE POLICY "Service can manage schema migrations" ON public.schema_migrations FOR ALL TO service_role USING ((select auth.role()) = ''service_role'') WITH CHECK ((select auth.role()) = ''service_role'')';
  END IF;
END;
$$;
