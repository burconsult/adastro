-- Feature Migration: Newsletter schema (subscribers, campaigns, deliveries, opt-in)
-- Applied when the newsletter feature is activated/installed.

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email VARCHAR(200) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed', 'unsubscribed')),
  source VARCHAR(80),
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.newsletter_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  template_key VARCHAR(80) NOT NULL DEFAULT 'new_post',
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  provider VARCHAR(40) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'completed', 'partial', 'failed')),
  recipients_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.newsletter_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.newsletter_campaigns(id) ON DELETE CASCADE,
  subscriber_id UUID REFERENCES public.newsletter_subscribers(id) ON DELETE SET NULL,
  email VARCHAR(200) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  provider_message_id VARCHAR(255),
  error TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS confirmation_token VARCHAR(120),
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS consent_record JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email ON public.newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_status ON public.newsletter_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_created_at ON public.newsletter_subscribers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_confirmation_token
  ON public.newsletter_subscribers(confirmation_token);

CREATE INDEX IF NOT EXISTS idx_newsletter_campaigns_created_at ON public.newsletter_campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_campaigns_status_created_at ON public.newsletter_campaigns(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_campaigns_post_id ON public.newsletter_campaigns(post_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_deliveries_campaign_id ON public.newsletter_deliveries(campaign_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_deliveries_status ON public.newsletter_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_deliveries_email ON public.newsletter_deliveries(email);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'newsletter_subscribers'
      AND c.conname = 'newsletter_subscribers_status_check'
  ) THEN
    ALTER TABLE public.newsletter_subscribers
      DROP CONSTRAINT newsletter_subscribers_status_check;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'newsletter_subscribers'
      AND c.conname = 'newsletter_subscribers_status_check'
  ) THEN
    ALTER TABLE public.newsletter_subscribers
      ADD CONSTRAINT newsletter_subscribers_status_check
      CHECK (status IN ('pending', 'subscribed', 'unsubscribed'));
  END IF;
END $$;

-- Newsletter feature settings defaults (feature-scoped, seeded on feature install)
INSERT INTO public.site_settings (key, value, category, description)
VALUES
  (
    'features.newsletter.enabled',
    'false'::jsonb,
    'extras',
    'Allow readers to subscribe and receive email updates.'
  ),
  (
    'features.newsletter.signupFooterEnabled',
    'true'::jsonb,
    'extras',
    'Show the newsletter signup form in the site footer when the feature is active.'
  ),
  (
    'features.newsletter.signupModalEnabled',
    'false'::jsonb,
    'extras',
    'Show a newsletter signup modal after a short delay on the public site.'
  ),
  (
    'features.newsletter.signupModalDelaySeconds',
    to_jsonb(12),
    'extras',
    'How long to wait before showing the newsletter modal.'
  )
ON CONFLICT (key) DO NOTHING;

DROP TRIGGER IF EXISTS update_newsletter_subscribers_updated_at ON public.newsletter_subscribers;
CREATE TRIGGER update_newsletter_subscribers_updated_at
  BEFORE UPDATE ON public.newsletter_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_newsletter_campaigns_updated_at ON public.newsletter_campaigns;
CREATE TRIGGER update_newsletter_campaigns_updated_at
  BEFORE UPDATE ON public.newsletter_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_newsletter_deliveries_updated_at ON public.newsletter_deliveries;
CREATE TRIGGER update_newsletter_deliveries_updated_at
  BEFORE UPDATE ON public.newsletter_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_deliveries FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'newsletter_subscribers'
      AND policyname = 'Admin can manage newsletter subscribers'
  ) THEN
    CREATE POLICY "Admin can manage newsletter subscribers" ON public.newsletter_subscribers
      FOR ALL
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'newsletter_campaigns'
      AND policyname = 'Admin can manage newsletter campaigns'
  ) THEN
    CREATE POLICY "Admin can manage newsletter campaigns" ON public.newsletter_campaigns
      FOR ALL
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'newsletter_deliveries'
      AND policyname = 'Admin can manage newsletter deliveries'
  ) THEN
    CREATE POLICY "Admin can manage newsletter deliveries" ON public.newsletter_deliveries
      FOR ALL
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;
