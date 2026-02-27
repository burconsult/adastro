# Security Policy

If you believe you found a security issue in AdAstro, please do **not** open a public GitHub issue first.

AdAstro is an open-source project maintained on a best-effort basis. Security for the initial release has been hardened and tested, but no absolute guarantee is provided.

## Report a Vulnerability

Send a private report with reproduction details and impact to:
- **GitHub Security Advisory** (preferred, when enabled on the public repo)
- or contact the maintainer directly (use the contact details listed on the repo profile/site)

Include:
- affected version / commit
- deployment context (local / Vercel / Netlify)
- steps to reproduce
- proof of impact
- any suggested fix/mitigation (optional)

## Scope

Please report issues related to:
- authentication / authorization
- privilege escalation
- data exposure
- RLS/storage policy bypass
- XSS/CSRF/SSRF/injection vulnerabilities
- insecure default configuration

## Supported Versions

Security fixes are handled on a best-effort basis for the latest public release.

## Security Testing and Hardening (v1 baseline)

Security posture for v1 includes:
- Supabase RLS enabled across core and feature tables.
- Column-level grant hardening for sensitive fields (for example `authors.email`, `comments.author_email`, and media original-path metadata).
- Storage bucket policies scoped to expected roles and paths.
- Setup and admin routes fail closed when auth/role checks fail.
- Automated release checks (`npm run verify:full`) and targeted route/component tests in CI.

## Hardening Reference

See the detailed implementation and deployment guidance in:
- `docs/security.md`
