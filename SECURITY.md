# Security Policy

If you believe you found a security issue in AdAstro, please do **not** open a public GitHub issue first.

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

AdAstro is currently pre-1.x public release oriented. Security fixes are handled on a best-effort basis for the latest public release branch/version.

## Hardening Reference

See the detailed implementation and deployment guidance in:
- `docs/security.md`
