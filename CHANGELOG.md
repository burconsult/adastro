# Changelog

All notable changes to AdAstro are documented in this file.

## 1.1.0 - 2026-03-19

### Added
- Public multilingual routing is now release-ready with locale-prefixed URLs (`/{locale}/...`) and locale-scoped post/page variants.
- Locale operations control plane at `/admin/locales` for activating locales, checking pack health, and managing locale-scoped site identity overrides.
- Translation catalogs now ship for `en`, `nb`, `es`, and `zh`, including metadata versioning (`_meta.catalogVersion: 1.1.0`).

### Changed
- Core content model is locale-aware (`posts.locale`, `pages.locale`, `UNIQUE(locale, slug)`), including upgrade migrations for existing installs.
- Setup flow and system page provisioning now bootstrap default and active locales deterministically for fresh installs.
- SEO outputs now include locale-aware canonical/hreflang/OG metadata plus locale-aware sitemap and RSS behavior.
- Post/page editors can create localized variants from existing content to preserve cross-locale linkage and metadata.

### Security
- Refreshed dependency tree with `npm audit fix`; high-severity npm advisories resolved at release cut time.
- Locale/runtime fallback behavior remains fail-closed to English when locale packs are missing or incomplete.

### Migration Notes
- Existing deployments upgrading from `1.0.0` should apply:
  - `infra/supabase/migrations/001_content_locales.sql`
  - `infra/supabase/migrations/002_locale_nb_bootstrap.sql` (for Norwegian bootstrap path)
- After migration, confirm `content.defaultLocale` and `content.locales` in `/admin/locales`.

### Known Limitations (1.1.0)
- Admin surfaces remain English-only by design; multilingual support targets public surfaces.
- Hosted smoke/performance validation should still be re-run on your own Vercel/Netlify deployment before production cutover.

## 1.0.0 - 2026-02-18

### Added
- Setup wizard flow for hosted installs with provider-aware guidance and setup gating.
- Modular feature lifecycle for bundled features (`ai`, `comments`, `newsletter`) with install/activate/deactivate/uninstall controls.
- Dedicated feature admin pages under Features submenu when features are active.
- Local verification pipeline (`verify:quick`, `verify:full`, feature lifecycle/content/theme/admin checks).

### Changed
- Consolidated environment model to `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`.
- Setup and core SQL flows now align with non-destructive installs and fresh project onboarding.
- Theming system token coverage expanded for consistent shape/color semantics across bundled themes.
- Default system pages/content aligned for cleaner out-of-box navigation and editing.
- WordPress migration redirect mapping now respects configured article routing (`content.articleBasePath`, `content.articlePermalinkStyle`).
- WordPress migration robustness improved for author slug collisions and media MIME normalization.

### Security
- Admin and privileged setup operations fail closed when secret key/admin context is unavailable.
- Feature state gating enforced across API/UI surfaces to prevent inactive feature leakage.
- CSP and setup gate behavior validated in regression suites.

### Known Limitations (1.0.0)
- WordPress migration currently imports posts/authors/taxonomies/media; `post_type=page` content is not auto-imported.
- Supabase Auth URL + SMTP sender/provider setup still requires manual dashboard steps.
- Netlify support is available, but final parity validation should be performed per deployment.
