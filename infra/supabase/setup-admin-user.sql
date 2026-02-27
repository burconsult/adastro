-- Promote an existing Supabase Auth user to admin
-- 1) Create the user in Supabase Auth (Dashboard → Authentication → Users)
-- 2) Run this in the Supabase SQL Editor to set their role

UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'::jsonb,
  true
)
WHERE email = 'admin@example.com';

-- Ensure the author profile links to the auth user (if it already exists)
UPDATE public.authors
SET auth_user_id = auth.users.id,
    updated_at = NOW()
FROM auth.users
WHERE LOWER(public.authors.email) = LOWER(auth.users.email)
  AND auth.users.email = 'admin@example.com';
