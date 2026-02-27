# AdAstro Security Guide

This document summarizes the security features built into the Adastro CMS and the
recommended configuration steps for production deployments.

Last updated: 2026-02-23

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

Migrations:
- `infra/supabase/migrations/000_core.sql`
  - Core schema includes the current baseline RLS policies and auth/storage security setup.

### Helper Functions
Auth helper functions are restricted to `authenticated` and `service_role`, not `PUBLIC`.

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

Additional protections:
- Error responses are sanitized to avoid leaking sensitive details.
- Slug validation now requires auth to avoid leaking draft IDs.
- Invite flow uses Supabase admin invites (no temporary passwords returned).

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
- Use `vercel.json` headers for baseline security headers and API no-store caching.
- Add edge rate limiting for `/api/auth/*` and `/api/admin/*`.
- Add a CSP header if you remove inline scripts.
- Enable SSL enforcement and network restrictions in Supabase.

## Supabase Auth Hardening

Configure in Supabase Dashboard:
- Auth rate limits (login, OTP, password reset)
- Email confirmation required
- OTP expiration and length
- CAPTCHA (Turnstile or reCAPTCHA)
- MFA for org users

Automation:
- `infra/supabase/scripts/update-auth-rate-limits.js` can update auth rate limits via the Management API.
  - Requires `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` (or `SUPABASE_URL`).

## Secrets and Credentials

Do not commit secrets to the repo.
Rotate any credential that has been committed in the past.

## Operational Practices

- Run periodic security scans (SAST + DAST).
- Review Supabase Security Advisor findings after schema changes.
- Audit admin access logs and rotate keys regularly.

## Known Limitations

- `service_role` bypasses RLS by design. Only use it in server-side code.
- Storage policies assume uploads live under `uploads/*` in the configured media bucket.
