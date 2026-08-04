# Local Testing Workflow

This workflow is optimized for rapid, repeatable verification with local Supabase + local app runtime.

## Prerequisites
- Docker Desktop running.
- Supabase CLI installed (`supabase --version`).
- Project dependencies installed (`npm install`).

## Commands
- `npm run local:supabase:start` - start local Supabase stack.
- `npm run local:supabase:status` - print local Supabase endpoints/keys.
- `npm run local:doctor` - inspect local Supabase config, published ports, runtime status, and whether the app schema is bootstrapped.
- `npm run local:env` - print exportable local app env values derived from the running local Supabase stack.
- `npm run local:db:core` - reset + apply only core schema.
- `npm run local:db:full` - reset + apply core schema + seed content.
- `npm run local:dev` - run Astro dev with local Supabase env auto-injected.
- `npm run verify:content` - validate seeded default content coherence for the configured default locale (required pages, locale settings, nav links, and internal link integrity).
- `npm run verify:features` - run bundled feature lifecycle checks (activate -> use -> deactivate -> uninstall -> reinstall) on local Supabase.
- `npm run ci:check-admin-consistency` - verify admin pages/nav contracts (layout/header parity, nav-to-route mapping, hydrated page `<noscript>` fallbacks, feature detail back-nav actions, comments gate).
- `npm run ci:check-theme-tokens` - verify every installed theme defines the required token set for light/dark mode.
- `npm run ci:check-release-hygiene` - enforce release-doc hygiene (no legacy env names/branding/local absolute paths).
- `npm run verify:quick` - local core DB reset + quick smoke checks.
- `npm run verify:full` - local full DB reset + full tests + build.
- `npm run verify:stability` - run repeatability checks (`verify:quick` twice + `verify:full` once).

## What the local scripts do
1. Ensure Docker and Supabase local stack are running.
2. Install `exec_sql` function in local Postgres (required by migration runner).
3. Inject local env values into process runtime:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
   - `SITE_URL` derived from `LOCAL_APP_HOST` / `LOCAL_APP_PORT` (defaults to `http://127.0.0.1:4321`) unless `LOCAL_SITE_URL` is set
4. Run migration/reset/seed flow via `infra/supabase/scripts/migrate.js`.
5. Run admin consistency and theme token verification before tests.
6. In full mode, run default content and release hygiene verification before tests/build.

This lets you keep one checked-in local `.env` baseline while local scripts use live local Supabase credentials automatically.

## Docker and Apple Silicon troubleshooting

Supabase CLI updates can pull newer local-service images than the versions already cached by Docker Desktop. If public ECR pulls hang with `error getting credentials` even though the registry is public, retry the command with an empty temporary Docker configuration instead of editing `~/.docker/config.json`:

```bash
task_docker_config=$(mktemp -d)
trap 'rmdir "$task_docker_config" 2>/dev/null || true' EXIT
DOCKER_CONFIG="$task_docker_config" supabase start --workdir infra
```

If an optional service then fails on Apple Silicon with `exec format error` or `sh: executable file not found`, the core CMS verification can run without the local UI, email viewer, telemetry, Edge Runtime, or Vector services:

```bash
supabase start --workdir infra \
  --exclude vector,logflare,edge-runtime,studio,mailpit
npm run verify:full
```

This reduced local stack still includes Postgres, Auth, REST, Storage, and the API gateway. Do not use the exclusions when testing Studio, local email delivery, Edge Functions, Logflare, or Vector behavior.
