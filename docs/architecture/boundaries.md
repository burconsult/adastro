# Boundaries

## 1. Core vs Feature Boundary

Core includes:
- Routing, auth middleware, setup system, settings framework, pages/posts/media primitives.

Features include:
- AI, comments, newsletter, and external modules using `FeatureModule` contract.

Rules:
1. Core must not import feature internals directly (`src/lib/features/<id>/*`) except via feature runtime APIs.
2. Feature code cannot mutate core behavior without explicit extension hooks.
3. Any new hook must be added in `src/lib/features/types.ts` and documented in `contracts.md`.

## 2. Data Boundary

1. Core tables are managed only via core migrations.
2. Feature tables are managed by feature migrations/uninstall SQL.
3. Core reset/setup scripts must never drop user data in production flows.

## 3. UI Boundary

1. Admin shell/layout remains core-owned.
2. Feature panels are injected only through registered extension points.
3. Public feature UI (comments/newsletter) must be gated by feature active state.

## 4. Security Boundary

1. Client uses `SUPABASE_PUBLISHABLE_KEY` only.
2. Server-only operations require `SUPABASE_SECRET_KEY`.
3. API routes enforce auth/role checks server-side; never trust client role claims.
4. CSP, same-origin unsafe method checks, and setup gate are middleware responsibilities.

## 5. Setup Boundary

1. Setup wizard can automate safe operations after core prerequisites.
2. Initial core schema bootstrap remains manual trust boundary.
3. Setup gate is released only through `/api/setup/complete` checks.
4. Post-completion `/setup` access is controlled by `setup.allowReentry` and should be disabled in production.
