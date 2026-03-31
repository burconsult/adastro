# AdAstro Repository Instructions

## Git Workflow

- Prefer pull-request-based workflows for substantive changes.
- Do not work directly on `main` unless the user explicitly asks for it.
- Before making commit-ready changes, create or switch to a task branch using the `codex/` prefix when possible.
- If a task already has an active non-`main` branch, continue on that branch unless the user asks to change it.
- Keep changes focused and avoid mixing broad refactors with behavior changes unless the task requires it.
- When the user asks to finalize work, prefer `stage -> commit -> push` and share the branch or PR link rather than leaving changes only in the local worktree.
- Release tags in this repo use `v<semver>` (for example `v1.4.0`).

## Validation

- Runtime target is Node `22.x`.
- Prefer repo-supported commands over ad hoc validation.
- Start with the smallest relevant checks for the files you touched, then broaden only as needed.
- Common validation commands are `npm run test:run` and `npm run build`.
- Use `npm run verify:netlify` for Netlify/release-sensitive delivery changes and `npm run verify:full` for broader local validation when warranted.

## Database, Auth, And Security

- Treat auth, setup, admin, RLS, storage, and migration code as fail-closed surfaces.
- Keep the existing application role model (`admin`, `author`, `reader`) unless a change is explicitly required.
- Keep service-role and secret-bearing logic server-only; never expose secrets or environment-specific values in commits.
- For shipped schema changes, add an upgrade migration under `infra/supabase/migrations/` for existing installs. Update `infra/supabase/migrations/000_core.sql` only when the consolidated initial-install baseline should also change.

## Documentation

- Update docs with behavior changes, especially `README.md`, `INSTALLATION.md`, `CHANGELOG.md`, and any relevant files under `docs/`.
- When auth, environment variables, setup flow, migrations, or modular feature surfaces change, document the operator impact in the same change set.
