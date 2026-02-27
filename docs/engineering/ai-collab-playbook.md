# AI Collaboration Playbook

## Goal
Keep AI-assisted coding fast without creating architectural drift.

## 1. Session Workflow

1. Orient
- Read `docs/architecture/system-map.md` and `docs/architecture/contracts.md`.

2. Bound the change
- Identify affected surfaces (public/admin/api/setup/features).
- Identify owned tables/settings.

3. Implement
- Keep changes inside one boundary when possible.
- If crossing boundaries, update contracts + map docs in same PR.

4. Verify
- Run focused tests first, then full test/build.
- Validate setup/feature gates when relevant.

5. Document
- Update map docs and release gates impact.

## 2. Prompting Pattern (recommended)

Use this structure for AI change requests:
1. Objective
2. Constraints (security, data safety, non-destructive behavior)
3. Boundaries not to cross
4. Acceptance criteria (tests + runtime checks)
5. Files/surfaces likely involved

## 3. Hard Rules for AI Changes

1. No silent schema changes.
2. No feature behavior exposed when inactive.
3. No bypass of setup completion gate.
4. No usage of secret key in client paths.
5. No direct writes to settings keys that are not defined in registry.

## 4. PR Checklist for AI-Assisted Changes

- Architecture impact described.
- Contracts updated if extension points changed.
- Tests updated/added.
- `npm run test:run` and `npm run build` green.
- `docs/architecture/map.json` updated for structural changes.

## 5. Human Review Focus

1. Boundary violations.
2. Security regressions.
3. Setup/deploy regressions.
4. Data ownership violations.
5. Feature inactive-state leaks.
