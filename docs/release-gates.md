# Release Gates

This file defines release policy. Live execution status is tracked in `docs/release-execution-board.md`.

## Scope

Use for both:
- `v1.0.0-rc` decisions
- `v1.0.0` final release decision

## Gate Policy (P0)

All P0 gates must be `PASS` before release.

1. Setup/install flow
2. Core functionality
3. Feature lifecycle
4. Data/safety and fail-closed behavior
5. Quality checks (tests/build/smoke)

Detailed per-gate check/fix/verify/exit criteria:
- `docs/release-execution-board.md`

## Required Evidence for Release Decision

1. `npm run verify:quick` output summary.
2. `npm run verify:full` output summary.
3. Fresh install notes (Vercel + Netlify + new Supabase project).
4. Feature activation/deactivation/uninstall/reinstall notes.
5. Hosted performance evidence for release pages (PSI/Lighthouse).
6. Known issues list with severity and mitigation.

## Autonomous Progression Rule

Do not advance to the next gate until the current gate has:
- checks executed,
- fixes applied,
- verification rerun,
- explicit exit criteria marked `PASS` in the execution board.
