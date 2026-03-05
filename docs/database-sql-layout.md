# Database SQL Layout (v1.1.x)

This document defines the canonical SQL files shipped with AdAstro and what each one is for.

## Canonical SQL Groups

### 1) Core Schema (required)

Path:
- `infra/supabase/migrations/000_core.sql`
- `infra/supabase/migrations/001_content_locales.sql`
- `infra/supabase/migrations/002_locale_nb_bootstrap.sql`

What it contains:
- Core CMS tables (`authors`, `posts`, `pages`, `media_assets`, settings, taxonomy, etc.)
- Core helper functions/triggers used by the app
- Core RLS policies
- Core upgrade migrations for locale-aware content records and locale bootstrap flows

What it does **not** contain:
- Comments tables
- Newsletter tables
- AI usage tables

This is the baseline SQL the setup flow requires before wizard automation can proceed.

Migration notes:
- `001_content_locales.sql` upgrades pre-locale installs by adding `posts.locale`/`pages.locale` and locale-scoped uniqueness (`UNIQUE(locale, slug)`).
- `002_locale_nb_bootstrap.sql` is idempotent and intended for existing `en` content stacks that want Norwegian (`nb`) as active primary locale; it clones/bootstraps localized records where missing.

### 2) Demo Data (optional)

Path:
- `infra/supabase/seed.sql`

Purpose:
- Demo pages, posts, media records, categories, tags, menus/settings content for out-of-box testing/demo installs

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

## Recommended Install Order (fresh install)

1. `000_core.sql`
2. Wizard automation (settings + buckets + admin bootstrap)
3. `seed.sql` (optional demo content)
4. Feature activation later (applies feature SQL only when enabled)

## Safety / Idempotency Notes

- Core SQL files are written to be additive/idempotent (`IF NOT EXISTS`, guarded policy/trigger creation where possible).
- Feature SQL is isolated so deactivated features do not require their tables.
- For non-empty databases, validate in `/setup` after applying SQL to confirm schema readiness before launch.
