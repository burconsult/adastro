# Release Execution Board

This file tracks only the current release candidate. Completed release history belongs in `CHANGELOG.md`, Git tags, and GitHub releases rather than accumulating here.

## Current Candidate

- Target: `v1.6.0`
- Status: release candidate prepared; final hosted manual gates pending
- Release type: minor
- Rationale: content version history, privileged-function hardening, reliable scheduled publishing, editorial audit trail, and the Astro 7 runtime refresh

## Status Legend

- `TODO` - not yet run for this candidate.
- `IN_PROGRESS` - active work or incomplete evidence.
- `PASS` - verified for this candidate.
- `FAIL` - verified regression or unmet exit criterion.
- `BLOCKED` - an external prerequisite prevents verification.

## Gate Board

| Gate | Area | Status | Current evidence or remaining work |
| --- | --- | --- | --- |
| G1 | Setup/install flow | BLOCKED | The 2026-07-30 full replay passed; the fresh 2026-08-04 rerun is blocked by the local Docker daemon, and an isolated hosted setup is still required. |
| G2 | Core schema and migrations | PASS | Production has migrations 008-011, private version tables, service-only RPC grants, and the one-minute scheduler job. |
| G3 | Feature lifecycle | PASS | Full local feature lifecycle verification passed. |
| G4 | Auth and security defaults | PASS | Auth, RLS, function ACL, and request-guard tests passed; runtime audit is clean. |
| G5 | Media and storage | BLOCKED | Repeat the authenticated hosted upload/render/delete smoke test before tagging; no production media mutation was authorized in this run. |
| G6 | Themes and accessibility | PASS | Theme contract and automated accessibility coverage passed. |
| G7 | Default content and page model | PASS | Seed and default-content verification passed. |
| G8 | Admin and editorial workflows | PASS | Production draft resaves created two versions and two audit events; the scheduler job is active and its minute worker is completing successfully. |
| G9 | SEO, routing, and canonical URLs | PASS | Automated route, sitemap, RSS, and metadata coverage passed. |
| G10 | Hosted performance | PASS | Mobile Lighthouse on the current production build scored 96-99 performance and 100 accessibility/best-practices/SEO across home, index, and article routes. |
| G11 | Automated validation and deployment parity | PASS | 827 tests, Netlify build, Vercel build, structural checks, dependency audit, and nine-route hosted smoke passed on 2026-08-04. |
| G12 | Release hygiene and documentation | PASS | Release hygiene passed; package, architecture map, changelog, and candidate metadata are prepared for `v1.6.0`. |

All gates must be `PASS` before tagging.

## Candidate Evidence

### 2026-07-30

- `npm audit --omit=dev` reported zero known vulnerabilities after the runtime refresh.
- `npm run test:run` passed 121 files with 1 skipped; 827 tests passed with 19 skipped.
- `npm run verify:full` passed from migration replay through the Vercel production bundle.
- Netlify followed by Vercel in the same worktree passed after provider build outputs were isolated.
- GitHub deployment parity, Architecture Map Guard, Vercel preview, and Netlify preview checks passed for the runtime refresh.
- Release cleanup removed redundant tracked inventories, replaced stale API examples with source-oriented guides, and established a documented local quarantine policy.

### 2026-08-04

- Production hosted smoke passed nine checks covering setup lock, locale routing, public pages, admin auth redirect, feeds, sitemap, robots, security headers, and immutable assets.
- Production content versioning recovered cleanly after migration 008: the test draft now has two versions and matching immutable audit events.
- Supabase Cron is installed and completing the scheduled-post worker every minute without errors; privileged editorial RPCs remain service-role-only.
- `npm run test:run` passed 121 files with 1 skipped; 827 tests passed with 19 skipped.
- `npm run verify:netlify` and the Vercel production build both passed under Node.js 22.22.1.
- `npm audit --omit=dev` reported zero known vulnerabilities after refreshing patched transitive dependencies.
- The fresh local database replay could not complete because Docker Desktop's daemon failed after a metadata-store I/O error; the 2026-07-30 replay remains the latest successful local evidence.

## Open Release Conditions

- Complete G1 against an isolated Supabase project or restore the local Docker daemon and rerun the full setup/migration path.
- Complete G5 with an authenticated hosted media upload, rendered-image check, and cleanup.
- Supabase currently warns that leaked-password protection is disabled; enable it in Auth settings when the project plan supports it.
- Existing Supabase advisor warnings for fixed-key bucket helpers and `current_author_id()` are accepted only because those functions expose no secret-bearing generic lookup and are intentionally constrained by their callers and grants.

## Final Release Sequence

1. Complete G1 and G5.
2. Record known issues and mitigations.
3. Bump package metadata to `1.6.0` and promote the changelog entry.
4. Run:
   - `npm run ci:check-release-hygiene`
   - `npm run ci:check-architecture-map`
   - `npm run verify:full`
   - `npm run verify:netlify`
5. Open and merge the release PR.
6. Tag `v1.6.0`, publish the GitHub release, and verify the production deployment.

## Gate Rules

- Do not mark a gate `PASS` from historical evidence alone.
- Record only concise evidence needed for the current decision.
- Keep detailed command output in CI logs or local release scratch artifacts.
- Never store secrets, production exports, or customer data in release evidence.
- If a candidate is abandoned, rely on Git history instead of copying this board into another tracked archive.
