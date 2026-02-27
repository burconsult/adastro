-- Custom database functions for the Adastro platform

-- Function to execute raw SQL (for migrations)
-- This is a security-sensitive function and should only be used with service role key
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

REVOKE EXECUTE ON FUNCTION exec_sql(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;

DO $$
BEGIN
  ALTER FUNCTION exec_sql(text) OWNER TO postgres;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping exec_sql ownership change (insufficient privileges).';
END;
$$;
