# Release Execution Board

This file tracks only the current release candidate. Completed release history belongs in `CHANGELOG.md`, Git tags, and GitHub releases rather than accumulating here.

## Current Candidate

- Target: `v1.6.0`
- Status: release cleanup and final validation
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
| G1 | Setup/install flow | TODO | Repeat fresh hosted setup against an isolated Supabase project. |
| G2 | Core schema and migrations | PASS | Full local migration replay through `011_editorial_audit_trail.sql` passed. |
| G3 | Feature lifecycle | PASS | Full local feature lifecycle verification passed. |
| G4 | Auth and security defaults | PASS | Auth, RLS, function ACL, and request-guard tests passed; runtime audit is clean. |
| G5 | Media and storage | TODO | Repeat hosted upload/render/delete smoke test. |
| G6 | Themes and accessibility | PASS | Theme contract and automated accessibility coverage passed. |
| G7 | Default content and page model | PASS | Seed and default-content verification passed. |
| G8 | Admin and editorial workflows | IN_PROGRESS | Local coverage passes; repeat hosted activity/version/scheduling walkthrough. |
| G9 | SEO, routing, and canonical URLs | PASS | Automated route, sitemap, RSS, and metadata coverage passed. |
| G10 | Hosted performance | TODO | Capture fresh mobile Lighthouse or PSI evidence for representative routes. |
| G11 | Automated validation and deployment parity | PASS | Full verifier and both hosted provider previews passed. |
| G12 | Release hygiene and documentation | IN_PROGRESS | Cleanup audit is active; release metadata has not been cut. |

All gates must be `PASS` before tagging.

## Candidate Evidence

### 2026-07-30

- `npm audit --omit=dev` reported zero known vulnerabilities after the runtime refresh.
- `npm run test:run` passed 121 files with 1 skipped; 827 tests passed with 19 skipped.
- `npm run verify:full` passed from migration replay through the Vercel production bundle.
- Netlify followed by Vercel in the same worktree passed after provider build outputs were isolated.
- GitHub deployment parity, Architecture Map Guard, Vercel preview, and Netlify preview checks passed for the runtime refresh.
- Release cleanup removed redundant tracked inventories, replaced stale API examples with source-oriented guides, and established a documented local quarantine policy.

## Final Release Sequence

1. Complete G1, G5, G8, G10, and G12.
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
