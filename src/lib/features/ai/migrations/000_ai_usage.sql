-- Feature Migration: AI usage events
-- Applied when the AI feature is activated/installed.

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability VARCHAR(20) NOT NULL CHECK (capability IN ('text', 'image', 'audio', 'video')),
  operation VARCHAR(40) NOT NULL,
  provider VARCHAR(40) NOT NULL,
  model VARCHAR(140),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_id UUID REFERENCES public.authors(id) ON DELETE SET NULL,
  request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count > 0),
  input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
  total_tokens INTEGER CHECK (total_tokens IS NULL OR total_tokens >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_created_at
  ON public.ai_usage_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_capability_created_at
  ON public.ai_usage_events(capability, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_provider_created_at
  ON public.ai_usage_events(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_auth_user_created_at
  ON public.ai_usage_events(auth_user_id, created_at DESC);

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_events FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_usage_events'
      AND policyname = 'Admin can manage ai usage events'
  ) THEN
    CREATE POLICY "Admin can manage ai usage events" ON public.ai_usage_events
      FOR ALL
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;
