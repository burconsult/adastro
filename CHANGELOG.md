# Changelog

All notable changes to AdAstro are documented in this file.

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
