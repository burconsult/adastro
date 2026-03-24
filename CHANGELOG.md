# Changelog

All notable changes to AdAstro are documented in this file.

## 1.3.0 "Schneller" - 2026-03-24

### Added
- Added the `Loan Box` bundled theme based on the supplied design system, with locally hosted fonts and full semantic-token coverage.

### Changed
- Reset the theme contract around stricter semantic tokens for light and dark mode, with public and admin surfaces aligned on the same token model.
- Replaced runtime Google Fonts loading with self-hosted local font assets so theme typography remains customizable without third-party font requests.
- Fixed article card title contrast and removed unintended underline/link-color leakage from article boxes across themes.
- Hardened public navigation and menu states so links, buttons, and theme toggles use foreground/surface semantics instead of theme-link color leakage.
- Trimmed public-page JavaScript by replacing the pageview tracker React island with an inline idle script and mounting the public toast host only on auth pages that use it.

### Performance
- Reduced non-critical public hydration work on article and index pages.
- Removed remote font requests from the public runtime.
- Kept public PSI/Lighthouse work focused on non-regressive changes to performance and accessibility.

### Known Limitations (1.3.0)
- Hosted PSI/Lighthouse score deltas still need to be recorded per deployment environment before a formal release tag.
- Admin surfaces remain English-only by design; multilingual support still targets public surfaces.

## 1.2.0 "Solidbeam" - 2026-03-23

### Changed
- Hardened public request handling and cache behavior for hosted deployments, including explicit public HTML cache variation handling.
- Improved Vercel-facing performance and canonical-site behavior for public article, search, and page routes.
- Tightened auth/access-policy handling, callback flows, and runtime config caching around hosted production paths.
- Strengthened first-party analytics, robots handling, and release metadata for the hosted release cut.

### Performance
- Added cache-policy infrastructure for public responses and aligned middleware behavior to avoid incorrect shared HTML reuse.
- Focused the release on hosted hardening and infra performance improvements for the public site.

### Security
- Hardened fail-closed auth and access-path handling during the 1.2.0 release run.

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
