-- Migration: Privileged Function Surface Hardening (v1.5.1)
-- Created: 2026-07-29
-- Description: Remove the arbitrary settings-reader RPC, narrow storage
-- helpers to fixed non-secret keys, and remove unnecessary trigger RPC access.

-- Storage policies need these helpers to read installation-specific bucket
-- names. Keep their input surface fixed so callers cannot use them to read
-- arbitrary site_settings values.
CREATE OR REPLACE FUNCTION public.media_storage_bucket()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN jsonb_typeof(value) = 'string' THEN value #>> '{}'
        ELSE trim(both '"' from value::text)
      END
      FROM public.site_settings
      WHERE key = 'storage.buckets.media'
      LIMIT 1
    ),
    'media-assets'
  );
$$;

CREATE OR REPLACE FUNCTION public.migration_uploads_bucket()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN jsonb_typeof(value) = 'string' THEN value #>> '{}'
        ELSE trim(both '"' from value::text)
      END
      FROM public.site_settings
      WHERE key = 'storage.buckets.migrationUploads'
      LIMIT 1
    ),
    'migration-uploads'
  );
$$;

-- The fixed-key helpers no longer depend on this generic SECURITY DEFINER
-- reader. Dropping it closes public access to server-only settings such as the
-- reCAPTCHA secret.
DROP FUNCTION IF EXISTS public.get_site_setting_text(text, text);

-- Existing installations may retain this no-op auth.users trigger because the
-- relation is owned by Supabase's auth administration role. Keep its function
-- inert and block direct RPC execution. Fresh installations do not create the
-- trigger in the consolidated baseline.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user()
  FROM PUBLIC, anon, authenticated, service_role;

-- Trigger functions run through their owning triggers and do not need direct
-- client RPC permissions.
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

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()
  FROM PUBLIC, anon, authenticated, service_role;

-- These helpers only inspect the caller's JWT, so they do not need elevated
-- table privileges. SECURITY INVOKER avoids an unnecessary definer boundary.
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.role() = 'authenticated' THEN
      COALESCE(NULLIF(auth.jwt() -> 'app_metadata' ->> 'role', ''), 'reader')
    ELSE 'anon'
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT public.current_role() = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.is_author()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT public.current_role() IN ('admin', 'author');
$$;

-- current_author_id must bypass author-profile column restrictions for its
-- caller-scoped lookup, but an empty search path prevents object shadowing.
CREATE OR REPLACE FUNCTION public.current_author_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id
  FROM public.authors
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.current_author_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_author_id() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.current_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_role() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_author() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_author() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.media_storage_bucket() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.media_storage_bucket() TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.migration_uploads_bucket() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.migration_uploads_bucket() TO anon, authenticated, service_role;
