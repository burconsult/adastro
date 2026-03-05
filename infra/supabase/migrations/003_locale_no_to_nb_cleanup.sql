-- Migration: Locale cleanup from `no` to `nb` (v1.1.2)
-- Created: 2026-03-05
-- Description: Convert legacy `no` locale settings/content rows to canonical `nb`.

-- Ensure default locale uses `nb`.
UPDATE public.site_settings
SET value = to_jsonb('nb'::text),
    updated_at = NOW()
WHERE key = 'content.defaultLocale'
  AND value = to_jsonb('no'::text);

-- Normalize locale list by replacing `no` with `nb` while preserving order.
WITH expanded AS (
  SELECT
    entry.locale,
    entry.ord
  FROM public.site_settings settings,
       jsonb_array_elements_text(settings.value) WITH ORDINALITY AS entry(locale, ord)
  WHERE settings.key = 'content.locales'
    AND jsonb_typeof(settings.value) = 'array'
),
normalized AS (
  SELECT
    CASE WHEN btrim(locale) = 'no' THEN 'nb' ELSE btrim(locale) END AS locale,
    MIN(ord) AS first_ord
  FROM expanded
  WHERE btrim(locale) <> ''
  GROUP BY CASE WHEN btrim(locale) = 'no' THEN 'nb' ELSE btrim(locale) END
),
ordered AS (
  SELECT locale
  FROM normalized
  ORDER BY
    CASE WHEN locale = 'nb' THEN 0 ELSE 1 END,
    first_ord
)
UPDATE public.site_settings settings
SET value = to_jsonb(ARRAY(SELECT locale FROM ordered)),
    updated_at = NOW()
WHERE settings.key = 'content.locales'
  AND EXISTS (
    SELECT 1
    FROM expanded
    WHERE btrim(locale) = 'no'
  );

-- Remove `no` duplicates when equivalent `nb` content already exists.
DELETE FROM public.pages no_page
USING public.pages nb_page
WHERE no_page.locale = 'no'
  AND nb_page.locale = 'nb'
  AND nb_page.slug = no_page.slug;

DELETE FROM public.posts no_post
USING public.posts nb_post
WHERE no_post.locale = 'no'
  AND nb_post.locale = 'nb'
  AND nb_post.slug = no_post.slug;

-- Promote remaining `no` rows to `nb`.
UPDATE public.pages
SET locale = 'nb',
    updated_at = NOW()
WHERE locale = 'no';

UPDATE public.posts
SET locale = 'nb',
    updated_at = NOW()
WHERE locale = 'no';
