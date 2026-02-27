-- Feature Migration: Comments schema
-- Applied when the comments feature is activated/installed.

CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  author_name VARCHAR(120) NOT NULL,
  author_email VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_status_created_at ON public.comments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_status_created_at ON public.comments(post_id, status, created_at DESC);

DROP TRIGGER IF EXISTS update_comments_updated_at ON public.comments;
CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'comments'
      AND policyname = 'Public can read approved comments on published posts'
  ) THEN
    CREATE POLICY "Public can read approved comments on published posts" ON public.comments
      FOR SELECT
      TO anon, authenticated
      USING (
        status = 'approved'
        AND EXISTS (
          SELECT 1
          FROM public.posts
          WHERE posts.id = comments.post_id
            AND posts.status = 'published'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'comments'
      AND policyname = 'Admin can manage comments'
  ) THEN
    CREATE POLICY "Admin can manage comments" ON public.comments
      FOR ALL
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;

REVOKE SELECT ON TABLE public.comments FROM anon, authenticated;
GRANT SELECT (id, post_id, author_name, content, status, created_at, updated_at)
  ON public.comments TO anon, authenticated;
GRANT SELECT ON TABLE public.comments TO service_role;
