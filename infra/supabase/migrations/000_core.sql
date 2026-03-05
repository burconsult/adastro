-- Migration: Core Schema (v1.0.0)
-- Created: 2025-02-12
-- Description: Consolidated schema for initial installs

-- Migration: Initial Schema (v1.0.0)
-- Created: 2025-01-19
-- Description: Fresh schema using Supabase Auth roles (admin/author/reader)

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Core tables
CREATE TABLE IF NOT EXISTS authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  alt_text TEXT,
  caption TEXT,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  dimensions JSONB,
  uploaded_by UUID REFERENCES authors(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS original_filename TEXT,
  ADD COLUMN IF NOT EXISTS original_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS original_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS original_file_size INTEGER,
  ADD COLUMN IF NOT EXISTS original_dimensions JSONB;

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale ~ '^[a-z]{2}(-[a-z]{2})?$'),
  content TEXT NOT NULL,
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  excerpt TEXT,
  author_id UUID REFERENCES authors(id) ON DELETE CASCADE NOT NULL,
  featured_image_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('draft', 'published', 'scheduled')) DEFAULT 'draft',
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  seo_metadata JSONB,
  custom_fields JSONB,
  CONSTRAINT posts_locale_slug_unique UNIQUE (locale, slug)
);

CREATE TABLE IF NOT EXISTS post_categories (
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, category_id)
);

CREATE TABLE IF NOT EXISTS post_tags (
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- Admin feature tables
CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  data JSONB NOT NULL,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS migration_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'rolled_back')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  options JSONB,
  rollback_safe BOOLEAN DEFAULT true,
  results JSONB,
  error_log TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS migration_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES migration_jobs(id) ON DELETE CASCADE NOT NULL,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('author', 'category', 'tag', 'media', 'post')),
  entity_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'published', 'failed', 'cancelled')),
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level VARCHAR(20) NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'critical')),
  category VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  source VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts(published_at);
CREATE INDEX IF NOT EXISTS idx_posts_locale ON posts(locale);
CREATE INDEX IF NOT EXISTS idx_posts_locale_slug ON posts(locale, slug);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);

CREATE INDEX IF NOT EXISTS idx_site_settings_key ON site_settings(key);
CREATE INDEX IF NOT EXISTS idx_site_settings_category ON site_settings(category);
CREATE INDEX IF NOT EXISTS idx_site_settings_updated_at ON site_settings(updated_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_entity ON analytics_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);

CREATE INDEX IF NOT EXISTS idx_migration_jobs_status ON migration_jobs(status);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_created_at ON migration_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_migration_artifacts_job_id ON migration_artifacts(job_id);
CREATE INDEX IF NOT EXISTS idx_migration_artifacts_type ON migration_artifacts(entity_type);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_for ON scheduled_posts(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_post_id ON scheduled_posts(post_id);

CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs(category);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_level_created_at ON system_logs(level, created_at);

-- Helper function used by feature installers/uninstallers to run DDL safely with service role.
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

-- Storage bucket helpers keep bucket names configurable per installation.
CREATE OR REPLACE FUNCTION public.get_site_setting_text(setting_key text, fallback_value text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  setting_value jsonb;
BEGIN
  SELECT value INTO setting_value
  FROM public.site_settings
  WHERE key = setting_key
  LIMIT 1;

  IF setting_value IS NULL THEN
    RETURN fallback_value;
  END IF;

  IF jsonb_typeof(setting_value) = 'string' THEN
    RETURN setting_value #>> '{}';
  END IF;

  RETURN trim(both '"' from setting_value::text);
EXCEPTION
  WHEN undefined_table THEN
    RETURN fallback_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.media_storage_bucket()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_site_setting_text('storage.buckets.media', 'media-assets');
$$;

CREATE OR REPLACE FUNCTION public.migration_uploads_bucket()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_site_setting_text('storage.buckets.migrationUploads', 'migration-uploads');
$$;

-- Updated-at helper
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_authors_updated_at
  BEFORE UPDATE ON authors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_site_settings_updated_at
  BEFORE UPDATE ON site_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_posts_updated_at
  BEFORE UPDATE ON scheduled_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auth helpers
CREATE OR REPLACE FUNCTION public.current_author_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.authors
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.role() = 'authenticated' THEN
      COALESCE(NULLIF(auth.jwt() -> 'app_metadata' ->> 'role', ''), 'author')
    ELSE 'anon'
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_role() = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.is_author()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_role() IN ('admin', 'author');
$$;

-- Create author record on auth.user creation
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  display_name text;
  slug_source text;
  slug_base text;
  slug_value text;
BEGIN
  display_name := COALESCE(NULLIF(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1), 'Author');
  slug_source := COALESCE(
    NULLIF(new.raw_user_meta_data->>'username', ''),
    NULLIF(new.raw_user_meta_data->>'name', ''),
    split_part(new.email, '@', 1),
    display_name,
    'author'
  );
  slug_base := regexp_replace(lower(slug_source), '[^a-z0-9]+', '-', 'g');
  slug_base := trim(both '-' from slug_base);

  IF slug_base = '' THEN
    slug_base := 'author';
  END IF;

  slug_value := slug_base;
  IF EXISTS (SELECT 1 FROM public.authors WHERE slug = slug_value) THEN
    slug_value := slug_base || '-' || substr(replace(new.id::text, '-', ''), 1, 6);
  END IF;

  INSERT INTO public.authors (auth_user_id, name, email, slug)
  VALUES (new.id, display_name, new.email, slug_value)
  ON CONFLICT (email)
  DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id,
                updated_at = NOW();

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Column-level privacy
REVOKE SELECT ON TABLE public.authors FROM anon, authenticated;
GRANT SELECT (id, name, slug, bio, avatar_url, created_at, updated_at) ON public.authors TO anon, authenticated;
GRANT SELECT ON TABLE public.authors TO service_role;

REVOKE SELECT ON TABLE public.media_assets FROM anon, authenticated;
GRANT SELECT (id, filename, storage_path, alt_text, caption, mime_type, file_size, dimensions, created_at)
  ON public.media_assets TO anon, authenticated;
GRANT SELECT ON TABLE public.media_assets TO service_role;

-- Enable Row Level Security
ALTER TABLE authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public can read published posts" ON posts
  FOR SELECT USING (status = 'published');

CREATE POLICY "Public can read categories" ON categories
  FOR SELECT USING (true);

CREATE POLICY "Public can read tags" ON tags
  FOR SELECT USING (true);

CREATE POLICY "Public can read author profiles" ON authors
  FOR SELECT USING (true);

CREATE POLICY "Public can read media assets" ON media_assets
  FOR SELECT USING (true);

CREATE POLICY "Public can read published post categories" ON post_categories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_categories.post_id
        AND posts.status = 'published'
    )
  );

CREATE POLICY "Public can read published post tags" ON post_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_tags.post_id
        AND posts.status = 'published'
    )
  );

-- Author/admin access
CREATE POLICY "Authors can read own posts" ON posts
  FOR SELECT USING (
    public.is_admin()
    OR author_id = public.current_author_id()
  );

CREATE POLICY "Authors can insert own posts" ON posts
  FOR INSERT WITH CHECK (
    public.is_author()
    AND author_id = public.current_author_id()
  );

CREATE POLICY "Authors can update own posts" ON posts
  FOR UPDATE USING (
    public.is_author()
    AND author_id = public.current_author_id()
  )
  WITH CHECK (
    public.is_author()
    AND author_id = public.current_author_id()
  );

CREATE POLICY "Authors can delete own posts" ON posts
  FOR DELETE USING (
    public.is_author()
    AND author_id = public.current_author_id()
  );

CREATE POLICY "Admin can manage posts" ON posts
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Authors can update own profile" ON authors
  FOR UPDATE USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Admin can manage authors" ON authors
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin can manage categories" ON categories
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Authors can insert tags" ON tags
  FOR INSERT WITH CHECK (public.is_author());

CREATE POLICY "Admin can manage tags" ON tags
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Authors can insert post categories" ON post_categories
  FOR INSERT WITH CHECK (
    public.is_author()
    AND EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_categories.post_id
        AND posts.author_id = public.current_author_id()
    )
  );

CREATE POLICY "Authors can delete post categories" ON post_categories
  FOR DELETE USING (
    public.is_author()
    AND EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_categories.post_id
        AND posts.author_id = public.current_author_id()
    )
  );

CREATE POLICY "Admin can manage post categories" ON post_categories
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Authors can insert post tags" ON post_tags
  FOR INSERT WITH CHECK (
    public.is_author()
    AND EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_tags.post_id
        AND posts.author_id = public.current_author_id()
    )
  );

CREATE POLICY "Authors can delete post tags" ON post_tags
  FOR DELETE USING (
    public.is_author()
    AND EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_tags.post_id
        AND posts.author_id = public.current_author_id()
    )
  );

CREATE POLICY "Admin can manage post tags" ON post_tags
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Authors can manage own media" ON media_assets
  FOR ALL USING (
    public.is_author()
    AND uploaded_by = public.current_author_id()
  )
  WITH CHECK (
    public.is_author()
    AND uploaded_by = public.current_author_id()
  );

CREATE POLICY "Admin can manage media" ON media_assets
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Admin-only tables
CREATE POLICY "Admin can manage site settings" ON site_settings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin can read analytics events" ON analytics_events
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Service can insert analytics events" ON analytics_events
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admin can manage migration jobs" ON migration_jobs
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin can manage migration artifacts" ON migration_artifacts
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin can manage scheduled posts" ON scheduled_posts
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin can read system logs" ON system_logs
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Service can insert system logs" ON system_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Storage bucket defaults
INSERT INTO site_settings (key, value, category, description)
VALUES
  (
    'storage.buckets.media',
    to_jsonb('media-assets'::text),
    'system',
    'Supabase Storage bucket for public media uploads'
  ),
  (
    'storage.buckets.migrationUploads',
    to_jsonb('migration-uploads'::text),
    'system',
    'Supabase Storage bucket for migration upload staging files'
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
VALUES (
  public.media_storage_bucket(),
  public.media_storage_bucket(),
  true,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
VALUES (
  public.migration_uploads_bucket(),
  public.migration_uploads_bucket(),
  false,
  ARRAY['text/xml', 'application/xml', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
-- Migration: User Profiles
-- Created: 2025-02-06
-- Description: Store profile data for authenticated users

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  avatar_source TEXT CHECK (avatar_source IN ('custom', 'gravatar')) DEFAULT 'gravatar',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_user_id ON user_profiles(auth_user_id);

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
-- Migration: Pages and Page Sections
-- Created: 2025-02-12
-- Description: Pages support with template sections

CREATE TABLE IF NOT EXISTS pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale ~ '^[a-z]{2}(-[a-z]{2})?$'),
  status TEXT CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
  template TEXT NOT NULL DEFAULT 'default',
  content_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_html TEXT,
  excerpt TEXT,
  author_id UUID REFERENCES authors(id) ON DELETE SET NULL,
  seo_metadata JSONB,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT pages_locale_slug_unique UNIQUE (locale, slug)
);

CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug);
CREATE INDEX IF NOT EXISTS idx_pages_locale ON pages(locale);
CREATE INDEX IF NOT EXISTS idx_pages_locale_slug ON pages(locale, slug);
CREATE INDEX IF NOT EXISTS idx_pages_status ON pages(status);

CREATE TABLE IF NOT EXISTS page_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES pages(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_sections_page_id ON page_sections(page_id);
CREATE INDEX IF NOT EXISTS idx_page_sections_order ON page_sections(page_id, order_index);

CREATE TRIGGER update_pages_updated_at
  BEFORE UPDATE ON pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_page_sections_updated_at
  BEFORE UPDATE ON page_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
-- Migration: Add audio asset support to posts
-- Created: 2025-02-10
-- Description: Adds audio_asset_id to posts for AI narration

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS audio_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_audio_asset_id ON posts(audio_asset_id);
-- Migration: Allow audio uploads in media-assets bucket
-- Created: 2025-02-10
-- Description: Adds common audio mime types for AI narration files

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg'
]
WHERE id = public.media_storage_bucket();
-- Migration: Security Hardening (v1.0.1)
-- Created: 2025-02-10
-- Description: Tighten RLS policy roles, storage access, and default privileges.

-- 1) Scope policies to explicit roles so anon doesn't evaluate author/admin checks
ALTER POLICY "Public can read published posts" ON public.posts TO anon, authenticated;
ALTER POLICY "Public can read categories" ON public.categories TO anon, authenticated;
ALTER POLICY "Public can read tags" ON public.tags TO anon, authenticated;
ALTER POLICY "Public can read author profiles" ON public.authors TO anon, authenticated;
ALTER POLICY "Public can read media assets" ON public.media_assets TO anon, authenticated;
ALTER POLICY "Public can read published post categories" ON public.post_categories TO anon, authenticated;
ALTER POLICY "Public can read published post tags" ON public.post_tags TO anon, authenticated;

ALTER POLICY "Authors can read own posts" ON public.posts TO authenticated;
ALTER POLICY "Authors can insert own posts" ON public.posts TO authenticated;
ALTER POLICY "Authors can update own posts" ON public.posts TO authenticated;
ALTER POLICY "Authors can delete own posts" ON public.posts TO authenticated;
ALTER POLICY "Admin can manage posts" ON public.posts TO authenticated;

ALTER POLICY "Authors can update own profile" ON public.authors TO authenticated;
ALTER POLICY "Admin can manage authors" ON public.authors TO authenticated;
ALTER POLICY "Admin can manage categories" ON public.categories TO authenticated;
ALTER POLICY "Authors can insert tags" ON public.tags TO authenticated;
ALTER POLICY "Admin can manage tags" ON public.tags TO authenticated;

ALTER POLICY "Authors can insert post categories" ON public.post_categories TO authenticated;
ALTER POLICY "Authors can delete post categories" ON public.post_categories TO authenticated;
ALTER POLICY "Admin can manage post categories" ON public.post_categories TO authenticated;
ALTER POLICY "Authors can insert post tags" ON public.post_tags TO authenticated;
ALTER POLICY "Authors can delete post tags" ON public.post_tags TO authenticated;
ALTER POLICY "Admin can manage post tags" ON public.post_tags TO authenticated;

ALTER POLICY "Authors can manage own media" ON public.media_assets TO authenticated;
ALTER POLICY "Admin can manage media" ON public.media_assets TO authenticated;

ALTER POLICY "Admin can manage site settings" ON public.site_settings TO authenticated;
ALTER POLICY "Admin can read analytics events" ON public.analytics_events TO authenticated;
ALTER POLICY "Service can insert analytics events" ON public.analytics_events TO service_role;
ALTER POLICY "Admin can manage migration jobs" ON public.migration_jobs TO authenticated;
ALTER POLICY "Admin can manage migration artifacts" ON public.migration_artifacts TO authenticated;
ALTER POLICY "Admin can manage scheduled posts" ON public.scheduled_posts TO authenticated;
ALTER POLICY "Admin can read system logs" ON public.system_logs TO authenticated;
ALTER POLICY "Service can insert system logs" ON public.system_logs TO service_role;

-- 2) Force RLS on public tables
ALTER TABLE public.authors FORCE ROW LEVEL SECURITY;
ALTER TABLE public.categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tags FORCE ROW LEVEL SECURITY;
ALTER TABLE public.posts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.post_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.post_tags FORCE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.migration_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.migration_artifacts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs FORCE ROW LEVEL SECURITY;

-- 3) Tighten default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;

-- 4) Restrict helper function execution from PUBLIC
REVOKE EXECUTE ON FUNCTION public.current_author_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_author() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_site_setting_text(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.media_storage_bucket() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.migration_uploads_bucket() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_author_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_author() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_site_setting_text(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.media_storage_bucket() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.migration_uploads_bucket() TO anon, authenticated, service_role;
-- Migration: Storage Security Policies (v1.0.2)
-- Created: 2025-02-10
-- Description: Apply RLS policies for Supabase storage.objects.
-- Note: storage.objects is owned by the storage admin role. Run this migration
-- with a postgres/superuser connection (e.g., Supabase SQL editor or CLI).

DROP POLICY IF EXISTS "Public read media-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authors upload media-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authors update own media-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authors delete own media-assets" ON storage.objects;
DROP POLICY IF EXISTS "Admin manage all media-assets" ON storage.objects;
DROP POLICY IF EXISTS "Service role manage migration uploads" ON storage.objects;

CREATE POLICY "Public read media-assets" ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = public.media_storage_bucket());

CREATE POLICY "Authors upload media-assets" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = public.media_storage_bucket()
    AND public.is_author()
    AND (storage.foldername(name))[1] = 'uploads'
  );

CREATE POLICY "Authors update own media-assets" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = public.media_storage_bucket()
    AND owner = (SELECT auth.uid())
  )
  WITH CHECK (
    bucket_id = public.media_storage_bucket()
    AND owner = (SELECT auth.uid())
  );

CREATE POLICY "Authors delete own media-assets" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = public.media_storage_bucket()
    AND owner = (SELECT auth.uid())
  );

CREATE POLICY "Admin manage all media-assets" ON storage.objects
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Service role manage migration uploads" ON storage.objects
  FOR ALL
  TO service_role
  USING (
    bucket_id = public.migration_uploads_bucket()
    AND (storage.foldername(name))[1] = 'wxr'
  )
  WITH CHECK (
    bucket_id = public.migration_uploads_bucket()
    AND (storage.foldername(name))[1] = 'wxr'
  );

-- RLS policies for pages, page sections, and user profiles
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.page_sections FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published pages" ON public.pages
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "Public can read published page sections" ON public.page_sections
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pages
      WHERE pages.id = page_sections.page_id
        AND pages.status = 'published'
    )
  );

CREATE POLICY "Authors can read own pages" ON public.pages
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR author_id = public.current_author_id()
  );

CREATE POLICY "Authors can insert own pages" ON public.pages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_author()
    AND author_id = public.current_author_id()
  );

CREATE POLICY "Authors can update own pages" ON public.pages
  FOR UPDATE
  TO authenticated
  USING (
    public.is_author()
    AND author_id = public.current_author_id()
  )
  WITH CHECK (
    public.is_author()
    AND author_id = public.current_author_id()
  );

CREATE POLICY "Authors can delete own pages" ON public.pages
  FOR DELETE
  TO authenticated
  USING (
    public.is_author()
    AND author_id = public.current_author_id()
  );

CREATE POLICY "Admin can manage pages" ON public.pages
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Authors can manage page sections" ON public.page_sections
  FOR ALL
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.pages
      WHERE pages.id = page_sections.page_id
        AND pages.author_id = public.current_author_id()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.pages
      WHERE pages.id = page_sections.page_id
        AND pages.author_id = public.current_author_id()
    )
  );

CREATE POLICY "Users can read own profile" ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Admin can read user profiles" ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
