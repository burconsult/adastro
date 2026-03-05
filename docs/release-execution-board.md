# Release Execution Board

Use this board to drive v1.0.0 release readiness with deterministic gate progression.

## Autonomous Execution Protocol

1. Run gates in order (`G1` -> `G12`).
2. Do not advance if current gate is `FAIL` or `BLOCKED`.
3. Capture evidence for each gate:
   - What was checked.
   - What was fixed.
   - How it was verified.
   - Exit criteria pass/fail.
4. Re-run `npm run verify:quick` after each gate.
5. Before RC/release tagging, run `npm run verify:full`.

## Status Legend

- `TODO` - not started.
- `IN_PROGRESS` - active execution.
- `PASS` - gate complete and verified.
- `FAIL` - verified failure/regression found.
- `BLOCKED` - cannot execute due missing external prerequisite.

## Gate Board

| Gate | Area | Status | Blocker |
| --- | --- | --- | --- |
| G1 | Setup/install flow (Vercel/Netlify/Supabase) | PASS | - |
| G2 | Core schema integrity (core vs feature separation) | PASS | - |
| G3 | Feature lifecycle (ai/comments/newsletter) | PASS | - |
| G4 | Auth/admin bootstrap + security defaults | PASS | - |
| G5 | Media upload/storage reliability | PASS | - |
| G6 | Theming completeness (no style leaks) | PASS | - |
| G7 | Default content + page model coherence | PASS | - |
| G8 | Admin UX consistency + legacy cleanup | PASS | - |
| G9 | SEO/routing/canonical integrity | PASS | - |
| G10 | Performance gate (PSI/Lighthouse >= 90) | PASS | - |
| G11 | Automated validation + regression stability | PASS | - |
| G12 | Public release hygiene + docs integrity | PASS | - |

---

## Post-v1 Strategic Tracks

- Multilingual CMS rollout (localized content records, locale-prefixed routing, hreflang/canonical handling, translated shared UI strings, and feature-level i18n integration).

## Gate Definitions

### G1 - Setup/install flow

Checks:
- `/setup` gate behavior before and after completion.
- Env prerequisite checks (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SITE_URL` recommended).
- Platform-specific links/instructions match detected target host.
- Step ordering is actionable and non-ambiguous.

Fix strategy:
- Resolve ambiguous wording.
- Ensure target-provider labels/links are consistent.
- Ensure step transitions are driven by checks, not manual confirmations.

Verify:
- Local: setup status + setup wizard smoke.
- Hosted: fresh deploy on Vercel and Netlify, env-missing then env-present + redeploy flow.

Exit criteria:
- No setup crash.
- Correct provider-specific instructions and links.
- Setup completion transitions correctly and gate behavior matches setting.

### G2 - Core schema integrity

Checks:
- Core SQL contains only core objects.
- Feature objects exist only in feature installers/migrations.
- Non-empty DB safe behavior (idempotent core SQL).

Fix strategy:
- Move leaked feature DDL from core to feature migration files.
- Enforce ownership boundaries in docs/contracts.

Verify:
- `npm run local:db:core`
- DB inspection confirms no feature tables pre-activation.

Exit criteria:
- Fresh core install leaves all bundled features inactive and non-materialized in DB.

### G3 - Feature lifecycle

Checks:
- Install/activate/deactivate/uninstall/reinstall for `ai`, `comments`, `newsletter`.
- Inactive features do not leak API/UI/widgets.

Fix strategy:
- Harden feature-state guards in UI and API dispatchers.
- Remove orphan imports/components when feature inactive.

Verify:
- Admin feature operations end-to-end.
- API checks return fail-closed responses for inactive features.

Exit criteria:
- Feature lifecycle is reversible and isolated.

### G4 - Auth/admin bootstrap + security

Checks:
- Publishable/secret key model used consistently.
- Admin invite/bootstrap and role assignment.
- Auth callback + redirect URL correctness.
- Setup reentry policy (`setup.allowReentry`) respected.

Fix strategy:
- Normalize env usage and fail-closed checks.
- Fix callback URL generation and setup hints.

Verify:
- Login/logout/admin route access checks.
- Missing secret key behavior rejects privileged actions.

Exit criteria:
- Secure-by-default auth/admin behavior without localhost leakage.

### G5 - Media upload/storage reliability

Checks:
- Upload from editor and media library.
- Metadata insert and dimensions handling.
- Bucket naming and conflicts.

Fix strategy:
- Patch upload pipeline + metadata validation.
- Harden storage fallback/error paths.

Verify:
- Image/video upload and remove block flow.
- Public render from storage-backed assets.

Exit criteria:
- No upload pipeline regressions or metadata write errors.

### G6 - Theming completeness

Checks:
- Theme tokens fully control shape/color/typography across public/admin surfaces.
- No hardcoded radius/default fallback leaks.

Fix strategy:
- Replace hardcoded styling with tokenized classes/variables.

Verify:
- Theme switch smoke across all bundled themes.

Exit criteria:
- Complete visual consistency per theme.

### G7 - Default content + page model coherence

Checks:
- Home/Articles/About/Contact seeded correctly.
- No dead links/404 from default content.
- Editable/removable pages from page editor.

Fix strategy:
- Align seed content + routing + menu defaults.

Verify:
- Fresh seed install and navigation walkthrough.

Exit criteria:
- Clean out-of-box content experience.

### G8 - Admin UX consistency + cleanup

Checks:
- Sidebar/nav consistency across admin routes.
- Redundant legacy pages/components removed.
- Feature UI visibility tied to feature state.

Fix strategy:
- Unify admin shell and route/page metadata.

Verify:
- Manual admin walkthrough all sections.

Exit criteria:
- No legacy UI drift or inactive-feature leakage.

### G9 - SEO/routing/canonical integrity

Checks:
- Canonical URL generation.
- Sitemap/OG output.
- Article base-path and permalink style behavior.

Fix strategy:
- Patch routing + metadata generation mismatches.

Verify:
- Route checks on index/list/detail pages.

Exit criteria:
- SEO output and routing model are deterministic and correct.

### G10 - Performance gate

Checks:
- Lighthouse/PSI mobile scores on representative pages.

Fix strategy:
- Reduce JS/hydration, optimize media/fonts/caching.

Verify:
- Hosted measurements on release candidate URLs.

Exit criteria:
- Mobile performance >= 90 for defined release pages.

### G11 - Automated validation stability

Checks:
- Quick/full local verifiers stable and repeatable.
- No flaky tests in core paths.

Fix strategy:
- Update brittle tests and stabilize fixtures.

Verify:
- `npm run verify:quick`
- `npm run verify:full`

Exit criteria:
- Repeatable green runs from clean state.

### G12 - Public release hygiene

Checks:
- Branding consistency (AdAstro naming).
- Remove redundant/legacy docs/artifacts.
- Final docs accuracy (install, features, architecture maps).

Fix strategy:
- Prune stale files and sync release docs.

Verify:
- Repo scan + docs review + build/test pass.

Exit criteria:
- Public repo is clean, accurate, and release-ready.

---

## Evidence Log

### 2026-03-05

- Multilingual foundation rollout (active):
  - Added locale model settings (`content.defaultLocale`, `content.locales`) and locale runtime (`src/lib/i18n/locales.ts`, `src/lib/i18n/runtime.ts`).
  - Added locale-prefixed public routes under `src/pages/[locale]/*` with locale-aware post/page lookup + fallback.
  - Added locale-aware middleware context + deterministic unprefixed -> default locale redirects.
  - Added locale column + locale-scoped slug uniqueness for posts/pages in core SQL and upgrade migration (`infra/supabase/migrations/001_content_locales.sql`).
  - Added locale-aware admin CRUD/filtering and slug validation for posts/pages.
  - Added locale-aware canonical/hreflang/OG locale output plus locale-aware sitemap/RSS generation.
  - Removed legacy unprefixed dynamic page route `src/pages/[slug].astro` to avoid SSR route collisions with `src/pages/[locale]/index.astro`.
  - Updated routing tests for locale-aware routing config shape.
  - Verification:
    - `npm run test:run` -> PASS
    - `npm run build` -> PASS
    - `npm run ci:check-admin-consistency` -> PASS
    - `npm run ci:check-release-hygiene` -> PASS
    - `npm run verify:quick` -> PASS

- Norwegian locale rollout (`nb`) for existing content stacks:
  - Added Norwegian locale catalog (`src/lib/i18n/messages/nb.json`) with standards-compliant metadata output (`og:locale=nb_NO`, RSS language `nb-no`).
  - Localized public route UI strings and shared public card/grid/navigation components for locale-aware rendering on `/nb/*`.
  - Added public header locale switcher in the top-right nav controls so users can switch between active locales without leaving the current page path.
  - Added locale bootstrap migration (`infra/supabase/migrations/002_locale_nb_bootstrap.sql`) to:
    - set `content.defaultLocale=nb` + `content.locales=[\"nb\",\"en\"]` for existing English content stacks,
    - clone pages/posts from `en` to `nb` when missing,
    - preserve post category/tag relations,
    - translate deterministic seeded content + page sections.

### 2026-02-19

- Demo-content + settings coverage polish:
  - Updated:

### 2026-02-22

- Final pre-release audit sweep completed:
  - `npm run verify:full` passed (DB reset/core+seed checks, full vitest suite, production build).
  - Hosted Vercel smoke check passed across public/admin routes.
  - Fixed hosted post edit React hydration mismatch by deferring locale-formatted timestamps until hydration in `PostEditor` and `PublishingControls`.
  - Upgraded `fast-xml-parser` (critical advisory removed) and `nodemailer` (direct high advisory removed).
  - Hardened WordPress WXR parser config with `processEntities: false`.
  - Performed final hygiene cleanup removing unused core `src/lib/i18n/*` stubs after v2 multilingual deferral.
  - Lighthouse (mobile) spot checks on release URLs:
    - `/` -> Perf 99 / A11y 100 / BP 100 / SEO 100
    - `/blog` -> Perf 99 / A11y 100 / BP 100 / SEO 100
    - `/blog/ai-seo-autopilot-nano-banana/` -> Perf 100 / A11y 100 / BP 100 / SEO 100
    - `/about` -> Perf 100 / A11y 100 / BP 100 / SEO 100
    - `infra/supabase/seed.sql`
    - `src/layouts/BaseLayout.astro`
    - `src/lib/site-config.ts`
    - `src/lib/settings/core-definitions.ts`
    - `src/components/BlogPostCard.astro`
    - `src/pages/blog/index.astro`
    - `src/pages/blog/page/[page].astro`
    - `src/pages/blog/[slug].astro`
    - `src/pages/tag/[tag].astro`
    - `src/pages/category/[category].astro`
    - `src/pages/author/[slug].astro`
    - `docs/settings-coverage.md`
    - `public/images/og-default.jpg`
  - What changed:
    - Seeded article bodies no longer duplicate hero images.
    - About page demo content expanded with richer project context and editable sections.
    - Added real default JPG Open Graph image and wired SEO defaults (`seo.defaultTitle`, `seo.defaultDescription`, `seo.keywords`, `seo.ogImage`) into frontend metadata output.
    - Wired social settings (`social.twitter/facebook/linkedin/github`) into frontend metadata (`twitter:site`, `rel=\"me\"`, Organization/WebSite JSON-LD) and optional footer social links.
    - Wired content settings (`content.postsPerPage`, `content.excerptLength`) into listing and card rendering.
    - Added settings coverage inventory doc; only performance keys remain intentionally non-runtime-wired in v1.0.0.
  - Verification:
    - `npm run test:run -- src/components/__tests__/BlogPostCard.test.tsx src/components/__tests__/BlogPostGrid.test.tsx src/lib/services/__tests__/settings-service.test.ts src/lib/components/__tests__/SetupWizard.test.tsx` -> PASS
    - `npm run build` -> PASS
    - `npm run verify:quick` -> PASS

- Final hosted verification sweep (post-deploy):
  - Fixes applied:
    - `src/components/PageRenderer.astro`
    - `src/components/PageSections.astro`
    - `src/components/sections/HeroSection.astro`
    - `src/components/sections/CtaSection.astro`
  - What was fixed:
    - Eliminated hardcoded `/blog` CTA/content links in page-section rendering by rewriting legacy `/blog...` hrefs to the configured article base path at render time.
  - Hosted verification:
    - Home page CTA links now resolve to `/articles` on deployed site.
    - Canonical + `og:url` on `https://adastrocms.vercel.app/articles` both resolve to `/articles`.
    - Admin walkthrough rerun (`/admin`, `/admin/posts`, `/admin/pages`, `/admin/media`, `/admin/users`, `/admin/features`, `/admin/settings`) with no console errors and no failed/4xx/5xx API requests.
  - Performance capture (Lighthouse mobile, hosted):
    - `/` -> performance `100`, FCP `1.2s`, LCP `1.4s`, TBT `0ms`, CLS `0`
    - `/articles` -> performance `99`, FCP `1.1s`, LCP `1.4s`, TBT `0ms`, CLS `0`
    - `/articles/pagespeed-90-without-plugins/` -> performance `98`, FCP `1.2s`, LCP `1.4s`, TBT `0ms`, CLS `0.019`
  - Local verification:
    - `npm run test:run -- src/lib/routing/__tests__/articles.test.ts src/lib/components/__tests__/SetupWizard.test.tsx` -> PASS
    - `npm run build` -> PASS
    - `npm run verify:quick` -> PASS

- Gate sweep follow-up (G1/G8/G9/G10):
  - Hosted checks:
    - Fresh install on new Supabase project confirmed by user (`G1` hosted prerequisite met).
    - Playwright walkthrough on `https://adastrocms.vercel.app` for admin routes (`/admin`, `/admin/posts`, `/admin/pages`, `/admin/migration`, `/admin/media`, `/admin/categories`, `/admin/tags`, `/admin/users`, `/admin/features`, `/admin/themes`, `/admin/settings`) with no console or API failures.
    - Settings page interaction pass (all categories + reset/import/restore dialogs) with no runtime errors.
    - Frontend asset sanity check: no admin JS assets loaded on public pages; admin-named CSS chunks are shared global/theme utilities (no admin selector leakage found).
  - Fixes applied:
    - `src/layouts/BaseLayout.astro`
    - `src/pages/blog/index.astro`
    - `src/pages/blog/page/[page].astro`
    - `src/pages/blog/[slug].astro`
  - Verification:
    - `npm run test:run -- src/lib/seo/__tests__/metadata-generator.test.ts src/lib/seo/__tests__/seo-integration.test.ts src/lib/seo/__tests__/sitemap-generator.test.ts src/lib/routing/__tests__/articles.test.ts` -> PASS
    - `npm run build` -> PASS
    - `npm run verify:quick` -> PASS
  - Notes:
    - Fixed canonical/`og:url` mismatch for configured article base paths by explicitly passing canonical URLs from blog index/pagination/post routes.

- Auth/invite/password flow hardening:
  - Updated:
    - `src/lib/auth/access-policy.ts`
    - `src/lib/auth/author-provisioning.ts`
    - `src/pages/api/admin/invite-user.ts`
    - `src/pages/api/admin/users/[id].ts`
    - `src/pages/api/auth/login.ts`
    - `src/pages/api/auth/forgot-password.ts`
    - `src/pages/api/auth/password.ts`
    - `src/pages/auth/forgot-password.astro`
    - `src/pages/auth/reset-password.astro`
    - `src/lib/client/auth/auth-callback.js`
    - `src/lib/client/auth/login.js`
    - `src/lib/client/auth/forgot-password.js`
    - `src/lib/client/auth/reset-password.js`
    - `src/lib/components/ProfileManager.tsx`
    - `INSTALLATION.md`
    - `docs/architecture/auth-rls.md`
  - Verification:
    - `npm run test:run -- src/lib/auth/__tests__/access-policy.test.ts src/pages/api/auth/__tests__/login.test.ts src/pages/api/auth/__tests__/password.test.ts src/pages/api/auth/__tests__/forgot-password.test.ts src/pages/api/admin/__tests__/invite-user.test.ts src/lib/components/__tests__/SetupWizard.test.tsx` -> PASS
    - `npm run build` -> PASS
  - Notes:
    - Invite/recovery now route through password setup before role-safe destination redirects.
    - Added complete forgot/reset/change password coverage and author profile provisioning on role assignment.

- Gate 11 verification rerun:
  - Commands:
    - `npm run verify:quick`
    - `npm run verify:full`
  - Result: PASS
  - Notes:
    - `verify:full` summary: 58 test files passed, 1 skipped; 585 tests passed, 19 skipped; build PASS.
    - Release hygiene check and default-content checks passed in full verifier.

### 2026-02-14

- Baseline quick verifier:
  - Command: `npm run verify:quick`
  - Result: PASS
  - Notes: Local DB reset/setup + setup/auth/settings smoke tests passed.

- Documentation + map synchronization:
  - Updated: `docs/release-gates.md`, `docs/release-smoke-test.md`, `docs/architecture/system-map.md`, `docs/architecture/README.md`, `docs/architecture/map.json`
  - Result: PASS
  - Notes: Added canonical execution board references and autonomous progression policy.

- Gate 1 local rerun:
  - Command: `npm run verify:quick`
  - Result: PASS
  - Notes: Setup wizard-related smoke remains green after docs/map updates.

- Gate 2 schema separation checks:
  - Commands:
    - `rg -n "comments|newsletter_subscribers|newsletter_campaigns|newsletter_deliveries" infra/supabase/migrations/000_core.sql || true`
    - `npm run local:db:core`
    - `node scripts/local/verify-db.mjs`
  - Result: PASS
  - Notes:
    - No feature table identifiers found in core migration files.
    - Core reset/setup succeeds and validation confirms feature tables are absent in core-only state.

- Post-G2 regression check:
  - Command: `npm run verify:quick`
  - Result: PASS
  - Notes: Targeted setup/auth/settings tests remain green after Gate 2 validation.

- Gate 3 inactive-feature leak hardening:
  - Updated:
    - `src/pages/blog/[slug].astro` (comments render now guarded by `isFeatureActive('comments')`)
    - `src/pages/admin/media.astro` + `src/lib/components/MediaLibrary.tsx` (media extensions filtered by active feature ids)
    - `src/pages/profile.astro` + `src/lib/components/ProfileManager.tsx` (profile extensions filtered by active feature ids)
  - Verification:
    - `npm run test:run -- src/lib/features/__tests__/state.test.ts src/lib/features/comments/__tests__/api.test.ts src/lib/features/comments/ui/__tests__/CommentsSection.test.tsx` -> PASS
    - `npm run verify:quick` -> PASS
    - `npm run build` -> PASS
  - Notes:
    - Inactive feature UI leakage for comments/newsletter extension surfaces is now blocked on server-derived active feature IDs.

- Gate 3 lifecycle automation + verification:
  - Updated:
    - `scripts/local/verify-feature-lifecycle.mjs`
    - `src/pages/api/features/__tests__/dispatch.test.ts`
    - `package.json`
    - `docs/engineering/local-testing.md`
  - Verification:
    - `npm run test:run -- src/pages/api/features/__tests__/dispatch.test.ts src/lib/features/__tests__/state.test.ts src/lib/features/comments/__tests__/api.test.ts src/lib/components/__tests__/SetupWizard.test.tsx` -> PASS
    - `npm run verify:features` -> PASS
    - `npm run verify:quick` -> PASS
  - Notes:
    - Lifecycle script now executes: activate -> use -> deactivate -> uninstall -> reinstall for `comments`, `newsletter`, and `ai`, with data/state assertions and final DB baseline restore.
    - Feature API dispatcher behavior now has dedicated tests for 400/404/409/500 + successful active dispatch.

- Gate 4 auth/bootstrap hardening:
  - Updated:
    - `infra/supabase/scripts/migrate.js`
    - `infra/supabase/scripts/bootstrap-admin.js`
    - `scripts/local/lib.mjs`
    - `src/pages/api/admin/invite-user.ts`
    - `src/pages/api/admin/__tests__/invite-user.test.ts`
  - Verification:
    - `npm run test:run -- src/pages/api/admin/__tests__/invite-user.test.ts src/lib/auth/__tests__/middleware.test.ts src/lib/components/__tests__/SetupWizard.test.tsx` -> PASS
    - `npm run verify:quick` -> PASS
  - Notes:
    - Removed remaining legacy service-role key support so scripts/runtime are consistently keyed on `SUPABASE_PUBLISHABLE_KEY` + `SUPABASE_SECRET_KEY`.
    - Added invite-user regression coverage to ensure callback redirect derives from deploy origin when `SITE_URL` is absent (prevents localhost leakage).

- Gate 5 media reliability hardening:
  - Updated:
    - `src/pages/api/admin/media/[id].ts`
    - `src/pages/api/admin/media/__tests__/media-id-route.test.ts`
  - Verification:
    - `npm run test:run -- src/lib/services/__tests__/media-manager.test.ts src/pages/api/admin/media/__tests__/media-id-route.test.ts src/lib/services/__tests__/media-manager.integration.test.ts` -> PASS
    - `npm run verify:quick` -> PASS
    - `npm run build` -> PASS
  - Notes:
    - Fixed request-context binding bug in media detail route (`GET`/`DELETE`) that could trigger 500 errors during media management flows.
    - Existing media-manager coverage confirms dimensions insert fallback for legacy column typing and upload/delete pipeline behavior.

- Admin API request-context hardening:
  - Updated:
    - `src/pages/api/admin/categories/[id].ts`
    - `src/pages/api/admin/tags/[id].ts`
    - `src/pages/api/admin/categories/__tests__/category-id-route.test.ts`
    - `src/pages/api/admin/tags/__tests__/tag-id-route.test.ts`
  - Verification:
    - `npm run test:run -- src/pages/api/admin/media/__tests__/media-id-route.test.ts src/pages/api/admin/categories/__tests__/category-id-route.test.ts src/pages/api/admin/tags/__tests__/tag-id-route.test.ts src/pages/api/admin/__tests__/invite-user.test.ts` -> PASS
    - `npm run verify:quick` -> PASS
    - `npm run build` -> PASS
  - Notes:
    - Fixed additional undefined-`request` defects in category/tag detail endpoints (`GET`/`DELETE`) that could surface as admin 500s.

- Gate 6 theme-shape token hardening:
  - Updated:
    - `src/styles/global.css`
  - Verification:
    - `npm run build` -> PASS
  - Notes:
    - `rounded-full` is now computed from theme radius token (`--radius`), enabling hard-corner themes to flatten pill/circle UI consistently without per-page overrides.

- Gate 7 default content coherence automation:
  - Updated:
    - `scripts/local/verify-default-content.mjs`
    - `scripts/local/verify-local.mjs`
    - `package.json`
    - `src/pages/api/admin/__tests__/invite-user.test.ts`
  - Verification:
    - `npm run verify:content` -> PASS
    - `npm run verify:quick` -> PASS
    - `npm run verify:full` -> PASS
  - Notes:
    - Added seeded content verifier covering required pages (`home`, `about`, `contact`, articles base path), section presence, navigation links, and internal-link integrity against published pages/posts.
    - Full local verification now includes default-content checks in seeded mode.
    - Invite-user regression test now adapts to `SITE_URL` vs request-origin callback behavior, removing local-env false negatives in full verification runs.

- Gate 8 admin navigation regression coverage:
  - Updated:
    - `src/components/admin/__tests__/nav-items.test.tsx`
    - `src/pages/api/admin/features/__tests__/index.test.ts`
  - Verification:
    - `npm run test:run -- src/components/admin/__tests__/nav-items.test.tsx src/pages/api/admin/__tests__/invite-user.test.ts` -> PASS
    - `npm run test:run -- src/pages/api/admin/features/__tests__/index.test.ts src/components/admin/__tests__/nav-items.test.tsx` -> PASS
  - Notes:
    - Added deterministic nav resolution tests to enforce comment-menu visibility gating and active-state behavior for nested admin routes.
    - Added API coverage for feature-list activity/toggleability mapping (including always-on modules).

- Gate 6 theme token coverage hardening:
  - Updated:
    - `src/lib/themes/installed/earth-zen/theme.css`
    - `src/lib/themes/installed/fashion-muse/theme.css`
    - `src/lib/themes/installed/monochrome-calm/theme.css`
    - `src/lib/themes/installed/neural-nexus/theme.css`
    - `src/lib/themes/installed/nordic-modern/theme.css`
    - `scripts/ci/check-theme-tokens.mjs`
    - `scripts/local/verify-local.mjs`
    - `package.json`
  - Verification:
    - `npm run ci:check-theme-tokens` -> PASS
    - `npm run verify:quick` -> PASS
    - `npm run verify:full` -> PASS
  - Notes:
    - Added missing `success/warning/info` tokens (light + dark) across all bundled themes to eliminate fallback color leaks.
    - Added deterministic token audit and wired it into local quick/full verification.

## Gate 1 Current Notes

- Status: PASS.
- Exit criteria met:
  - Setup wizard/auth bootstrap behavior is green in local verifier.
  - Fresh hosted install on a new Supabase project has been confirmed.

## Gate 2 Current Notes

- Status: PASS.
- Exit criteria met:
  - Core SQL is clean of comments/newsletter feature tables.
  - Core-only setup path leaves feature tables unmaterialized.

## Gate 3 Current Notes

- Status: PASS.
- Exit criteria met:
  - Full lifecycle evidence executed for `ai`, `comments`, and `newsletter` on local Supabase.
  - Inactive-feature leakage is blocked in both UI extension surfaces and API dispatch.

## Gate 4 Current Notes

- Status: PASS.
- Exit criteria met:
  - Publishable/secret key model is used consistently across setup/admin migration scripts.
  - Admin invite flow has explicit regression coverage for redirect URL correctness (no localhost fallback leakage).
  - Setup reentry behavior and auth/admin middleware checks remain covered by quick verifier suite.

## Gate 5 Current Notes

- Status: PASS.
- Exit criteria met:
  - Media upload pipeline and dimensions fallback handling remain covered by dedicated service tests.
  - Media asset GET/DELETE route reliability fixed and protected by regression tests.
  - Local quick verifier + full build remain green after media route hardening.

## Gate 6 Current Notes

- Status: PASS.
- Exit criteria met:
  - Global shape token propagation includes `rounded-full` semantics.
  - Bundled themes define full light/dark semantic tokens including `success`, `warning`, and `info`.
  - Theme token audit is enforced in local quick/full verification.

## Gate 7 Current Notes

- Status: PASS.
- Exit criteria met:
  - Default seeded pages (`home`, `about`, `contact`, and article base path) are present/published and contain sections.
  - Navigation/internal-link coherence checks pass without dead internal targets.
  - Full local verifier executes seeded content checks as part of `verify:full`.

## Gate 8 Current Notes

- Status: PASS.
- Completed:
  - Eliminated multiple admin API request-context defects and added route-level regression tests.
  - Added admin nav visibility/active-state regression tests for feature-gated comments navigation.
  - Added feature-list API regression tests to lock active/inactive/toggleable state mapping in admin.
  - Completed hosted admin route walkthrough (including Settings categories/actions) with no console/network failures.

## Gate 9 Current Notes

- Status: PASS.
- Completed:
  - Automated SEO/routing test coverage is green in full verification (`metadata-generator`, `seo-integration`, `sitemap-generator`, `rss-generator`, routing tests).
  - Fixed canonical/`og:url` mapping for configured article base path routes (`/articles` style installs).
  - Eliminated hardcoded `/blog` page-section links so configured article base path is honored consistently in default system pages.
  - Hosted canonical/`og:url` spot-check completed on release deployment.

## Gate 10 Current Notes

- Status: PASS.
- Completed:
  - Prior hosted PSI evidence remains at/near target on representative pages (per latest user validation).
  - Additional frontend sanity check confirms no admin JS payload leakage on public pages.
  - Final hosted Lighthouse mobile capture completed after latest deployment with all representative pages >= 98 performance.

## Gate 11 Current Notes

- Status: PASS.
- Exit criteria met:
  - `npm run verify:quick` passed on 2026-02-19.
  - `npm run verify:full` passed on 2026-02-19 (tests + build + release hygiene checks).

## Gate 12 Current Notes

- Status: IN_PROGRESS.
- Completed:
  - Docs/install/auth architecture updates synced with latest auth/invite/password behavior.
  - Release hygiene check passes in `verify:full`.
  - Added settings coverage audit doc (`docs/settings-coverage.md`) and wired all core settings except performance toggles to runtime behavior.
- Remaining for `G12 PASS`:
  - Final explicit sweep/removal of any legacy or redundant files before public repo cutover/tagging.
