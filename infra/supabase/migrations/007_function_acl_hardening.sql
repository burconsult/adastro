-- Migration: Function ACL Hardening (v1.4.1)
-- Created: 2026-04-08
-- Description: Revoke sensitive helper execution from anon/authenticated and
-- harden future function defaults for Supabase owner roles.

-- Harden future function defaults for the current execution role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC;

DO $$
DECLARE
  target_role text;
BEGIN
  FOREACH target_role IN ARRAY ARRAY[current_user::text, 'postgres', 'supabase_admin'] LOOP
    BEGIN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, PUBLIC',
        target_role
      );
    EXCEPTION
      WHEN insufficient_privilege OR undefined_object THEN
        RAISE NOTICE 'Skipping default function privilege hardening for role %.', target_role;
    END;
  END LOOP;
END;
$$;

-- Re-apply the intended grants explicitly. Revoking from PUBLIC alone is not
-- enough if anon/authenticated received direct grants or permissive defaults.
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.current_author_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_author_id() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.current_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_role() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_author() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_author() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_site_setting_text(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_site_setting_text(text, text) TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.media_storage_bucket() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.media_storage_bucket() TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.migration_uploads_bucket() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.migration_uploads_bucket() TO anon, authenticated, service_role;
