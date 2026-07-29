-- Migration: Content Versioning
-- Created: 2026-07-06
-- Description: Persist restorable article and page versions for draft/publish workflows.

CREATE TABLE IF NOT EXISTS public.post_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_by UUID REFERENCES public.authors(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT post_versions_post_version_unique UNIQUE (post_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_post_versions_post_id ON public.post_versions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_versions_post_created_at ON public.post_versions(post_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.page_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES public.pages(id) ON DELETE CASCADE NOT NULL,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_by UUID REFERENCES public.authors(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT page_versions_page_version_unique UNIQUE (page_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_page_versions_page_id ON public.page_versions(page_id);
CREATE INDEX IF NOT EXISTS idx_page_versions_page_created_at ON public.page_versions(page_id, created_at DESC);

-- Allocate per-content version numbers under a transaction-scoped advisory
-- lock so concurrent saves cannot select the same next version number.
CREATE OR REPLACE FUNCTION public.create_post_version(
  target_post_id UUID,
  version_snapshot JSONB,
  actor_author_id UUID DEFAULT NULL
)
RETURNS public.post_versions
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  inserted_version public.post_versions;
BEGIN
  IF jsonb_typeof(version_snapshot) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Post version snapshot must be a JSON object.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('post_versions:' || target_post_id::text, 0)
  );

  INSERT INTO public.post_versions (post_id, version_number, snapshot, created_by)
  SELECT target_post_id, COALESCE(MAX(version_number), 0) + 1, version_snapshot, actor_author_id
  FROM public.post_versions
  WHERE post_id = target_post_id
  RETURNING * INTO inserted_version;

  RETURN inserted_version;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_page_version(
  target_page_id UUID,
  version_snapshot JSONB,
  actor_author_id UUID DEFAULT NULL
)
RETURNS public.page_versions
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  inserted_version public.page_versions;
BEGIN
  IF jsonb_typeof(version_snapshot) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Page version snapshot must be a JSON object.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('page_versions:' || target_page_id::text, 0)
  );

  INSERT INTO public.page_versions (page_id, version_number, snapshot, created_by)
  SELECT target_page_id, COALESCE(MAX(version_number), 0) + 1, version_snapshot, actor_author_id
  FROM public.page_versions
  WHERE page_id = target_page_id
  RETURNING * INTO inserted_version;

  RETURN inserted_version;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_post_version(UUID, JSONB, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_post_version(UUID, JSONB, UUID)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_page_version(UUID, JSONB, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_page_version(UUID, JSONB, UUID)
  TO service_role;

REVOKE ALL ON TABLE public.post_versions, public.page_versions
  FROM anon, authenticated;
GRANT SELECT, DELETE ON TABLE public.post_versions, public.page_versions
  TO authenticated;
GRANT ALL ON TABLE public.post_versions, public.page_versions
  TO service_role;

ALTER TABLE public.post_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.page_versions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authors can read own post versions" ON public.post_versions;
DROP POLICY IF EXISTS "Admin can delete post versions" ON public.post_versions;
DROP POLICY IF EXISTS "Authors can read own page versions" ON public.page_versions;
DROP POLICY IF EXISTS "Admin can delete page versions" ON public.page_versions;

CREATE POLICY "Authors can read own post versions" ON public.post_versions
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = post_versions.post_id
        AND posts.author_id = public.current_author_id()
    )
  );

CREATE POLICY "Admin can delete post versions" ON public.post_versions
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Authors can read own page versions" ON public.page_versions
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.pages
      WHERE pages.id = page_versions.page_id
        AND pages.author_id = public.current_author_id()
    )
  );

CREATE POLICY "Admin can delete page versions" ON public.page_versions
  FOR DELETE
  TO authenticated
  USING (public.is_admin());
