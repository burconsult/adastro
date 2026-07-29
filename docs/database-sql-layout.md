# Database SQL Layout (v1.3.0)

This document defines the canonical SQL files shipped with AdAstro and what each one is for.

## Canonical SQL Groups

### 1) Fresh-Install Core Schema (required)

Path:
- `infra/supabase/migrations/000_core.sql`

What it contains:
- Core CMS tables (`authors`, `posts`, `pages`, `page_sections`, `media_assets`, `site_settings`, taxonomy, migration jobs/artifacts, analytics, user profiles, etc.)
- Core helper functions/triggers used by the app
- Core RLS policies

What it does **not** contain:
- Comments tables
- Newsletter tables
- AI usage tables

This is the baseline SQL the setup flow requires before wizard automation can proceed.

### 2) Core Upgrade Migrations (existing installs only)

Path:
- `infra/supabase/migrations/001_content_locales.sql`
- `infra/supabase/migrations/002_locale_nb_bootstrap.sql`
- `infra/supabase/migrations/003_nb_content_translation_hardening.sql`
- `infra/supabase/migrations/008_content_versioning.sql`
- `infra/supabase/migrations/009_privileged_function_surface_hardening.sql`
- `infra/supabase/migrations/010_scheduled_publishing.sql`
- `infra/supabase/migrations/011_editorial_audit_trail.sql`

Migration notes:
- `001_content_locales.sql` upgrades pre-locale installs by adding `posts.locale`/`pages.locale` and locale-scoped uniqueness (`UNIQUE(locale, slug)`).
- `002_locale_nb_bootstrap.sql` is idempotent and intended for existing `en` content stacks that want Norwegian (`nb`) as active primary locale; it clones/bootstraps localized records where missing.
- `003_nb_content_translation_hardening.sql` backfills known Norwegian `about` page section content on older installs that were already bootstrapped before the translation fixes landed.
- `008_content_versioning.sql` adds private `post_versions` and `page_versions` tables for admin/author version history and restore workflows; inserts are restricted to the server-side allocator functions.
- `009_privileged_function_surface_hardening.sql` removes the generic privileged settings reader, narrows public storage helpers to fixed bucket-name keys, and revokes direct access to trigger functions.
- `010_scheduled_publishing.sql` synchronizes scheduled posts into a durable queue and installs an atomic, retrying one-minute worker through Supabase Cron.
- `011_editorial_audit_trail.sql` adds an immutable admin-readable audit ledger, explicit grants, cursor indexes, and a bounded service-role retention worker.

### 3) Demo Data (optional)

Path:
- `infra/supabase/seed.sql`

Purpose:
- Demo pages, posts, media records, categories, tags, menus/settings content for out-of-box testing/demo installs
- Locale-aware baseline settings (`content.defaultLocale`, `content.locales`, site identity/taxonomy localization maps) for deterministic fresh installs

Notes:
- Safe for demo/dev/fresh installs
- Not required for production if you want an empty editorial start

## Bundled Feature SQL (applied on feature activation)

These are shipped in the repo but should remain inactive until the admin activates a feature.

### AI Feature

- `src/lib/features/ai/migrations/000_ai_usage.sql`

Creates:
- `public.ai_usage_events`

### Comments Feature

- `src/lib/features/comments/migrations/000_comments.sql`

Creates:
- `public.comments`

### Newsletter Feature

- `src/lib/features/newsletter/migrations/000_newsletter.sql`

Creates / updates:
- `public.newsletter_subscribers`
- `public.newsletter_campaigns`
- `public.newsletter_deliveries`
- double opt-in + consent fields/constraints

Runtime application path:
- Feature activation applies bundled feature migrations via `src/lib/features/migrations.ts`

## Support SQL Files (not primary install schema)

### `infra/supabase/functions.sql`

Purpose:
- Installs `exec_sql(text)` helper function used by migration scripts / feature activation helpers

Notes:
- Security-sensitive helper (service-role usage only)
- Setup/migrate scripts can install this when missing

### `infra/supabase/setup-admin-user.sql`

Purpose:
- Manual SQL editor helper to promote an existing Supabase Auth user to admin

Notes:
- Optional helper for manual recovery/bootstrap scenarios
- Wizard/admin bootstrap tooling can cover this in normal install flow

## Non-Canonical / Legacy / Generated SQL To Ignore

Do not use these for v1 installs:
- `external_docs/migrations/*` (legacy/reference artifacts)
- any SQL under `.netlify/` or build output directories (generated copies)

## Recommended Install Order

Fresh install:

1. `000_core.sql`
2. Wizard automation (settings + buckets + admin bootstrap)
3. `seed.sql` (optional demo content + locale-aware baseline settings)
4. Feature activation later (applies feature SQL only when enabled)

Existing install upgrade:

1. Apply any pending core upgrade migrations in numeric order (`001` -> `010`) as needed.
2. Open `/setup` and confirm checks are green.
3. Apply optional `seed.sql` only if you intentionally want demo content/settings additions.
4. Activate features later so feature tables remain opt-in.

## Safety / Idempotency Notes

- Core SQL files are written to be additive/idempotent (`IF NOT EXISTS`, guarded policy/trigger creation where possible).
- Scheduled publishing uses Supabase Cron rather than hosting-provider cron so publication timing is consistent across Vercel and Netlify plans.
- Feature SQL is isolated so deactivated features do not require their tables.
- For non-empty databases, validate in `/setup` after applying SQL to confirm schema readiness before launch.
