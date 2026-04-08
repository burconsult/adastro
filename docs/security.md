# AdAstro Security Guide

This document summarizes the security features built into the Adastro CMS and the
recommended configuration steps for production deployments.

Last updated: 2026-03-31

## Overview

Security is implemented at multiple layers:
- Database (Postgres + RLS policies)
- Storage (Supabase Storage policies)
- API routes (server-side auth enforcement)
- App middleware (security headers + caching rules)
- Admin UI (XSS hardening for migration output)

## Database Security

### Row Level Security (RLS)
RLS is enabled and forced for all public tables. Policies:
- Public read on published content and taxonomies
- Author ownership for content creation and updates
- Admin-only access for operational tables
- Authenticated users without explicit `app_metadata.role` now resolve to `reader`, not `author`

Migrations:
- `infra/supabase/migrations/000_core.sql`
  - Core schema includes the current baseline RLS policies and auth/storage security setup.
- `infra/supabase/migrations/006_auth_hardening_azure_mfa.sql`
  - Hardens `public.current_role()` to fail closed to `reader`
  - Stops automatic author provisioning/linking on `auth.users` creation
- `infra/supabase/migrations/007_function_acl_hardening.sql`
  - Re-applies sensitive helper-function grants explicitly so `public.exec_sql(text)` stays service-role-only
  - Hardens future default function ACLs for Supabase owner roles (`postgres`, `supabase_admin`)

### Helper Functions
Sensitive helper functions explicitly revoke execution from `anon`, `authenticated`, and `PUBLIC` before re-granting only the minimal required roles.
`public.exec_sql(text)` is service-role-only and should be treated as a migration/bootstrap helper, not a public RPC surface.
`service_role` remains server-only and must never be exposed to the browser.

## Storage Security

Storage objects are protected with RLS policies:
- Public read for the configured media bucket (`storage.buckets.media`)
- Authors can upload/update/delete their own uploads
- Admins can manage all media assets
- Migration uploads restricted to the configured migration bucket (`storage.buckets.migrationUploads`) under `wxr/*`

Migration:
- `infra/supabase/migrations/000_core.sql`
  - Includes current storage policy definitions for media and migration buckets.
  - Some owner-level SQL blocks (e.g. `storage.objects` policy DDL and auth trigger DDL) must still be applied in the Supabase SQL Editor on hosted installs, as documented in `INSTALLATION.md`.

## API Security

All admin endpoints require auth:
- `requireAdmin` for admin-only endpoints
- `requireAuthor` for author-access endpoints
- Setup read endpoints (`GET /api/setup/status`, `GET /api/setup/sql`) stay reachable during installation
- Setup mutation endpoints (`POST /api/setup/automate`, `POST /api/setup/routing`, `POST /api/setup/complete`) now require an authenticated admin even before setup completion
- `/auth/*` and `/api/auth/*` stay reachable during installation so the bootstrap admin can sign in before running mutating setup actions

Additional protections:
- Error responses are sanitized to avoid leaking sensitive details.
- Slug validation now requires auth to avoid leaking draft IDs.
- Invite flow uses Supabase admin invites (no temporary passwords returned).
- Password change and MFA-factor removal now require `aal2` when `auth.mfa.enabled=true` and the user has a verified MFA factor.

## App Middleware

The middleware sets standard security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- HSTS when running over HTTPS
- Content Security Policy (CSP) allows inline scripts for Astro island hydration; `script-src-attr 'none'` blocks inline event handlers.

API responses use `Cache-Control: no-store` and strip `x-supabase-api-version`.

## SSRF and XSS Hardening

Link preview endpoint:
- Only allows `http`/`https`
- Blocks private IP/localhost targets
- Adds timeouts and caps response parsing

Migration UI:
- Escapes all dynamic HTML for summaries, issues, and errors

## Deployment Checklist (Vercel/Netlify)

Required:
- Set real domain in `astro.config.mjs` (`site` field) for the deployment you ship.
- Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`.
- Set `SITE_URL` (recommended) to your canonical domain.
- Keep `SUPABASE_SECRET_KEY` server-only (never `PUBLIC_`).

Recommended:
- Keep `vercel.json` and `netlify.toml` aligned for baseline security headers and API no-store caching.
- Add edge rate limiting and bot mitigation for `/api/auth/*`, `/api/setup/*`, and `/api/admin/*`.
- Add a CSP header if you remove inline scripts.
- Enable SSL enforcement and network restrictions in Supabase.
- Review Vercel Firewall / Attack Challenge or Netlify edge controls for public deployments.

## Supabase Auth Hardening

Configure in Supabase Dashboard:
- Auth rate limits (login, OTP, password reset)
- Email confirmation required
- OTP expiration and length
- CAPTCHA (Turnstile or reCAPTCHA)
- TOTP/authenticator-app MFA when you want optional user enrollment
- Social providers only after redirect allow-lists are correct

Azure / Microsoft provider notes:
- Use Supabase provider `azure`.
- Register `https://<project-ref>.supabase.co/auth/v1/callback` as the provider callback in Microsoft Entra.
- AdAstro adds the required `email` scope on the Azure login entrypoint.
- Use the provider's optional tenant URL in Supabase for single-tenant mode; leave `common` for consumer/multi-tenant mode.
- Microsoft Entra can return unverified email addresses. Prefer adding the `xms_edov` claim and `email` claim in the Entra application so email-based linking decisions are not made on an unverified address alone.

MFA notes:
- AdAstro v1.4.0 keeps MFA optional behind `auth.mfa.enabled`.
- Users can enroll, verify, view, and remove TOTP factors from `/profile`.
- Only sensitive account actions step up to `aal2` today; routine profile/content flows stay unchanged for users who have not enrolled.

Automation:
- `infra/supabase/scripts/update-auth-rate-limits.js` can update auth rate limits via the Management API.
  - Requires `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` (or `SUPABASE_URL`).

## App-Side Rate Limiting

AdAstro keeps a minimal in-process limiter on selected auth endpoints (`login`, `forgot-password`, MFA verify).

This helps against naive brute-force traffic, but it is not a substitute for:
- Supabase Auth rate limits
- CAPTCHA / Turnstile
- Vercel or Netlify edge-layer protections
- WAF / network-layer filtering

Treat the app-side limiter as best-effort only, especially on horizontally scaled or serverless deployments.
On Vercel and Netlify, AdAstro trusts the platform-specific client-IP headers that those platforms pin. On custom/self-hosted proxy chains, set `TRUSTED_PROXY_IP_HEADERS` explicitly if you want app-side throttles to key off a proxy-provided client IP.

## Hosted Redirect Origins

- `SITE_URL` should be treated as mandatory on hosted deployments for auth callbacks, invite links, and password-reset links.
- AdAstro now fails closed for auth-sensitive redirects unless `SITE_URL` or another trusted configured site URL is available.
- Only local development origins such as `http://127.0.0.1:4321` or `http://localhost:4321` may fall back to the request origin.

## Outbound Fetches

- Author link previews and WordPress migration media downloads now validate both the requested hostname and the DNS-resolved IP addresses before fetching.
- Loopback, RFC1918, link-local, metadata, multicast, documentation, and other non-public address ranges are rejected.
- WordPress media downloads now re-validate each redirect hop before following it.

## Secrets and Credentials

Do not commit secrets to the repo.
Rotate any credential that has been committed in the past.

## Operational Practices

- Run periodic security scans (SAST + DAST).
- Review Supabase Security Advisor findings after schema changes.
- Audit admin access logs and rotate keys regularly.
- After applying database migrations, verify helper-function grants and default function ACLs in Supabase so `anon`/`authenticated` do not regain execution on sensitive `SECURITY DEFINER` helpers.
- On hosted Supabase projects, `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin ...` may require the Supabase SQL Editor or another owner-level session. If helper-function migrations run through the app/service-role path, verify `pg_default_acl` afterwards and apply any remaining `supabase_admin` function-default revokes manually.

## Known Limitations

- `service_role` bypasses RLS by design. Only use it in server-side code.
- Storage policies assume uploads live under `uploads/*` in the configured media bucket.
- Azure/Microsoft trust decisions still depend on correct Entra claim configuration outside the app.
