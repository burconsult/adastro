# AdAstro - The Lightspeed CMS

AdAstro pairs Astro + React with Supabase Auth, Postgres, and Storage to deliver a forkable publishing stack. It ships with a WordPress migration pipeline, a lightweight admin workspace, and fast, SEO-ready public pages.

## Highlights
- **WordPress migration pipeline** – WXR ingest with progress streaming, trial imports, and rollback via `migration_artifacts`.
- **Supabase Auth roles** – app metadata roles (`admin`/`author`/`reader`) + author profiles with slugs.
- **Admin workspace** – React components power Astro SSR routes under `src/pages/admin/*`.
- **Pages system** – editable pages with reusable section layouts and SEO metadata.
- **Media pipeline** – upload + CDN-aware delivery with optional AI alt-text suggestions.
- **SEO + performance** – JSON‑LD, OG metadata, fast SSR, and PageSpeed-friendly defaults.
- **Locale-first routing** – locale-prefixed public URLs (`/{locale}/...`) with locale-scoped post/page slugs.
- **Bundled modular features** – AI, comments, and newsletter ship in the repo but stay disabled until enabled.

## Deploy

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/burconsult/adastro)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/burconsult/adastro)
[![Create Supabase Project](https://img.shields.io/badge/Supabase-Create%20Project-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/dashboard/new/project)

For Netlify or other providers, swap the Astro adapter:
- `@astrojs/netlify` is already included in dependencies.
- Auto-detection uses `netlify` on Netlify and `vercel` on Vercel.
- Optionally set `ASTRO_ADAPTER=netlify` to force Netlify mode explicitly.

## Setup Wizard
- Open `/setup` to run the in-app **AdAstro - The Lightspeed CMS** setup wizard.
- Follow the canonical setup document: `INSTALLATION.md`.
- Environment variable reference lives in `docs/environment-variables.md`.
- SQL layout reference (core/demo/feature separation) lives in `docs/database-sql-layout.md`.
- It runs non-destructive readiness checks (env vars, schema, storage, admin bootstrap) and shows provider-specific deployment steps.
- It includes one-click Supabase automation for default settings, bucket provisioning, and admin bootstrap by email.
- Supabase/Vercel operations that cannot be automated are listed as explicit manual tasks in the wizard.
- It includes a content URL model step (`content.articleBasePath`, `content.articlePermalinkStyle`) for slug/permalink compatibility.

## Architecture Snapshot
- **Frontend** – Astro with server output + React islands; admin routes live under `src/pages/admin/*`.
- **Backend** – Supabase (Postgres + Storage + Auth) accessed through repositories and services in `src/lib`.
- **Migration** – `WordPressMigrationService` streams progress + artifacts for undo.
- **Infra** – `infra/supabase/scripts/migrate.js` installs the consolidated core schema.
- **Architecture map** – start from `docs/architecture/system-map.md` and `docs/architecture/README.md`.

## Prerequisites
- Node.js 20+
- A Supabase project with Postgres + Storage enabled
- A deploy target (Vercel or Netlify) for hosted installs

## Environment Variables
Required for hosted deploys:
```bash
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
SITE_URL=https://your-domain.com
```

Use `docs/environment-variables.md` for:
- local-only `.env` usage
- feature-specific keys (AI/newsletter)
- CDN overrides
- adapter/storage override vars
- optional MCP server token (`MCP_SERVER_TOKEN`)

Notes:
- `SITE_URL` is strongly recommended for canonical URLs and auth redirects.
- Any env var change on Vercel/Netlify requires a redeploy.

## Getting Started
1. Install dependencies: `npm install`
2. Configure required env vars (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`) in your host, then redeploy.
3. Start the dev server: `npm run dev` (defaults to http://localhost:4321)
4. Open `/setup`:
   - Step 1: Environment + Docs (verify env vars and provider instructions).
   - Step 2: Supabase Database (run Core Schema SQL in Supabase SQL Editor).
   - Step 3: Auth + Email Sender (run automated setup, then configure Auth URLs + SMTP).
   - Step 4: Content URLs (set article base path and permalink style).
   - Step 5: Verification (resolve blockers and mark setup complete).
5. Log in at `/auth/login` and continue in `/admin`.

For local CLI-first setup, `npm run db:setup` and `npm run db:seed` remain available.

### Content URL Model
Choose the article base path and permalink style in setup:
- `content.articleBasePath`: `blog`, `posts`, `articles`, etc.
- `content.articlePermalinkStyle`: `segment` or `wordpress`

This helps preserve imported URL structures while keeping article slugs unchanged.

Locale settings:
- `content.defaultLocale`: default locale used for redirects/fallback.
- `content.locales`: enabled locale codes used for public route prefixes.
- Recommended for Norwegian Bokmal: use `nb` in URLs (`/nb/...`).
- Shipped locale packs include `en`, `nb`, `es`, and `zh`; only locales listed in `content.locales` are active.
- Public locale activation is managed in `/admin/locales` and the setup wizard; admin pages remain English-only.
- Fresh installs should set the default locale and active locales during `/setup` before entering content so localized system pages are provisioned deterministically.
- Add a new locale by adding `src/lib/i18n/messages/<locale>.json` and optional feature files under `src/lib/features/*/messages/<locale>.json`, then activate it in `/admin/locales`.
- Every locale JSON must include `_meta.locale`, `_meta.catalogVersion`, `_meta.schemaVersion`, and `_meta.fallbackLocale`. Missing feature packs fall back to English by design.
- Navigation links support optional per-locale overrides via `labelByLocale` and `hrefByLocale` for translated labels and locale-specific slugs.
- Optional localized site identity uses `site.titleByLocale`, `site.descriptionByLocale`, and `site.taglineByLocale`.
- Optional localized taxonomy labels use `content.categoryLabelsByLocale`, `content.categoryDescriptionsByLocale`, and `content.tagLabelsByLocale`.
- Post and page editors can seed localized drafts from existing variants so alternate locale metadata starts linked correctly.

### Additional Scripts
| Command | Description |
| --- | --- |
| `npm run build` | Build production assets and server output |
| `npm run preview` | Run the production build locally |
| `npm run db:reset` | Drop + recreate schema (dev only) |
| `npm run db:full` | Convenience wrapper for setup + seed |
| `npm run local:dev` | Start app with local Supabase env auto-wired |
| `npm run local:db:core` | Local Supabase reset + core schema apply |
| `npm run local:db:full` | Local Supabase reset + schema + seed |
| `npm run verify:quick` | Fast local validation (core DB + targeted tests) |
| `npm run verify:full` | Full local validation (core+seed DB + full tests + build) |

### Local Autonomous Testing
Use this path for fast, repeatable AI-assisted validation with one project `.env`:

1. Start Docker Desktop.
2. Run `npm run verify:quick` for a fast safety pass.
3. Run `npm run verify:full` before shipping significant changes.

Notes:
- Local scripts auto-start Supabase using `infra/supabase/config.toml`.
- Local scripts auto-wire app env (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SITE_URL`) from `supabase status -o env`.
- `local:db:*` commands pre-install `exec_sql` in local Postgres so migration scripts stay consistent with hosted workflows.

## Testing & Quality
- `npm run test` (watch) / `npm run test:run` (CI) execute Vitest and the React component suites.
- `npm run test:ui` starts the Vitest UI dashboard.
- Before tagging a release, run:
  - `npm run test:run`
  - `npm run build`

## Maintenance Model
AdAstro is currently maintained by a single developer. The codebase has automated checks and hardening, but it is not positioned as an enterprise-certified platform. Treat releases as best-effort open-source software and validate in staging before production rollouts.

## Remote MCP (Optional)
AdAstro includes a built-in **remote MCP server** at `/mcp` for AI tools that support MCP over HTTP.

- Enable it by setting `MCP_SERVER_TOKEN` and redeploying.
- It always exposes core publishing/admin tools (posts, pages, media, settings, analytics summary).
- Active modular features can register additional MCP tools (for example AI post image/audio generation and comments moderation).
- Inactive features do not expose MCP tools.
- It does not expose arbitrary SQL.

See `docs/mcp-server.md` for the endpoint details, auth, tool list, and security notes.

## WordPress Migration Workflow
1. Export “All content” from WordPress (`Tools → Export`).
2. Upload the WXR file at `/admin/migration` (large files use a signed storage upload automatically).
3. Optional: enable **Trial import** to cap the first 10 posts.
4. Watch progress stream events (status text + determinate progress bar).
5. Undo a trial run via the **Rollback** action if you want a clean retry.
6. Use `PostMigrationOptimizer` from the admin panel or service layer to rewrite media URLs, fix broken links, and audit SEO metadata.

`tests/fixtures/sample-wordpress-export.xml` provides a lightweight dataset for automated or manual dry runs.

## Media Pipeline Cheat Sheet
- `src/lib/services/media-manager.ts` orchestrates uploads, metadata, and AI-generated alt text.
- `src/lib/services/cdn-manager.ts` abstracts Vercel/Cloudflare/custom CDN URL building and cache purges.
- React helpers (`OptimizedImage`, `MediaUpload`, `MediaManager`) live under `src/lib/components`.
- Detailed behavior lives in `src/lib/services/README-media.md`.
> Storage paths default to `uploads/*` in the configured media bucket. By default this is derived per instance, with `media-assets` as fallback.

## Block Editor Flag
The EditorJS block editor renders inside `PostEditor` when `editor.blocks.enabled` is `true`. Toggle this setting via the admin settings table or seed data; legacy Markdown editing remains available as a fallback.

## Documentation Index
- `docs/architecture/README.md` – architecture map index for fast orientation.
- `docs/architecture/system-map.md` – canonical runtime map (routes, layers, control points).
- `docs/architecture/setup-flow.md` – setup gate lifecycle and manual/automated boundaries.
- `docs/architecture/feature-map.md` – bundled/external feature lifecycle + runtime wiring.
- `docs/architecture/ai-feature.md` – AI capability/provider architecture and extension points.
- `docs/architecture/contracts.md` – interface contracts (setup, feature, settings, theme, media).
- `docs/architecture/i18n.md` – public multilingual model, locale pack metadata/versioning, and activation workflow.
- `docs/architecture/data-ownership.md` – table ownership and schema change protocol.
- `docs/engineering/ai-collab-playbook.md` – workflow/rules for AI-assisted implementation.
- `docs/engineering/local-testing.md` – local Supabase-first validation workflow and verify commands.
- `docs/environment-variables.md` – canonical env var matrix (core, optional, feature-specific).
- `docs/database-sql-layout.md` – canonical SQL file layout and install order (core/demo/features).
- `docs/mcp-server.md` – built-in remote MCP endpoint (`/mcp`), auth, tool list, and integration notes.
- `docs/release-gates.md` – release decision gates and required evidence.
- `docs/performance-release-checklist.md` – PSI/Lighthouse release gate process for 90+ targets.
- `docs/release-smoke-test.md` – fresh-instance validation matrix for Supabase + Vercel/Netlify.
- `docs/feature-development.md` – how to build modular features using the same contract as AI/comments/newsletter.
- `INSTALLATION.md` – canonical installation flow (platform steps, redeploy points, wizard boundaries, setup lifecycle diagram).
- `CHANGELOG.md` – release notes, migration-impact updates, and known limitations.
- `docs/architecture/migration-pipeline.md` – mermaid diagram of the migration pipeline.
- `docs/architecture/auth-rls.md` – mermaid diagram of auth + RLS flow.
- `docs/architecture/theme-packages.md` – theme package format + install notes.
- `docs/architecture/motion.md` – motion library options and integration notes.
- `docs/migration.md` – migration behavior, endpoints, and undo mechanics.
Plans/roadmaps are tracked externally to keep the repo lean.

## Release Notes
- `SITE_URL` now drives both build-time `site` resolution and runtime sitemap/RSS URL generation.
- Invite callbacks derive from `SITE_URL` (or request origin fallback) to avoid localhost redirect leaks.
- Supabase Auth redirect URLs and SMTP sender setup are still required platform tasks during install (`INSTALLATION.md`).

## Roadmap
Roadmap and planning docs live outside the repo to keep the core tree production‑focused.
