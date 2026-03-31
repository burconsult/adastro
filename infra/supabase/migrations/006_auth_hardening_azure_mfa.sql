-- AdAstro v1.4.0 auth hardening
-- 1. Role-less authenticated users must stay readers.
-- 2. Auth user creation must not auto-create or auto-link author records.

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.role() = 'authenticated' THEN
      COALESCE(NULLIF(auth.jwt() -> 'app_metadata' ->> 'role', ''), 'reader')
    ELSE 'anon'
  END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN new;
END;
$$;
