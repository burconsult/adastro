-- Migration: Localized Content Core (v1.1.0)
-- Created: 2026-03-05
-- Description: Add locale-scoped slugs for posts/pages and default locale backfill.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS locale TEXT;

UPDATE public.posts
SET locale = 'en'
WHERE locale IS NULL OR btrim(locale) = '';

ALTER TABLE public.posts
  ALTER COLUMN locale SET DEFAULT 'en',
  ALTER COLUMN locale SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'posts_locale_format_check'
      AND conrelid = 'public.posts'::regclass
  ) THEN
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_locale_format_check
      CHECK (locale ~ '^[a-z]{2}(-[a-z]{2})?$');
  END IF;
END;
$$;

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_slug_key;

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_locale_slug_unique;

DROP INDEX IF EXISTS public.idx_posts_slug;
DROP INDEX IF EXISTS public.idx_posts_locale_slug;
DROP INDEX IF EXISTS public.idx_posts_locale_slug_unique;

CREATE INDEX IF NOT EXISTS idx_posts_slug ON public.posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_locale ON public.posts(locale);
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_locale_slug_unique ON public.posts(locale, slug);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'posts_locale_slug_unique'
      AND conrelid = 'public.posts'::regclass
  ) THEN
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_locale_slug_unique UNIQUE USING INDEX idx_posts_locale_slug_unique;
  END IF;
END;
$$;

ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS locale TEXT;

UPDATE public.pages
SET locale = 'en'
WHERE locale IS NULL OR btrim(locale) = '';

ALTER TABLE public.pages
  ALTER COLUMN locale SET DEFAULT 'en',
  ALTER COLUMN locale SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pages_locale_format_check'
      AND conrelid = 'public.pages'::regclass
  ) THEN
    ALTER TABLE public.pages
      ADD CONSTRAINT pages_locale_format_check
      CHECK (locale ~ '^[a-z]{2}(-[a-z]{2})?$');
  END IF;
END;
$$;

ALTER TABLE public.pages
  DROP CONSTRAINT IF EXISTS pages_slug_key;

ALTER TABLE public.pages
  DROP CONSTRAINT IF EXISTS pages_locale_slug_unique;

DROP INDEX IF EXISTS public.idx_pages_slug;
DROP INDEX IF EXISTS public.idx_pages_locale_slug;
DROP INDEX IF EXISTS public.idx_pages_locale_slug_unique;

CREATE INDEX IF NOT EXISTS idx_pages_slug ON public.pages(slug);
CREATE INDEX IF NOT EXISTS idx_pages_locale ON public.pages(locale);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pages_locale_slug_unique ON public.pages(locale, slug);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pages_locale_slug_unique'
      AND conrelid = 'public.pages'::regclass
  ) THEN
    ALTER TABLE public.pages
      ADD CONSTRAINT pages_locale_slug_unique UNIQUE USING INDEX idx_pages_locale_slug_unique;
  END IF;
END;
$$;
