# Core Library

`src/lib` contains AdAstro's shared domain, server, feature, and integration code. Source exports and tests are the API authority; this file is an orientation map rather than a duplicate API reference.

## Main Areas

| Area | Purpose |
| --- | --- |
| `types/` | Shared content, media, page, taxonomy, and profile types |
| `validation/` | Zod schemas for domain input |
| `database/` | Supabase repositories and database error handling |
| `auth/` | Session, role, OAuth, MFA, and access helpers |
| `features/` | Optional AI, comments, and newsletter modules |
| `services/` | Content, media, settings, migration, and system-page workflows |
| `seo/` | Metadata, structured data, sitemap, and RSS generation |
| `i18n/` | Locale catalogs, routing, and localized content lookup |
| `themes/` | Installed theme manifests, assets, and runtime selection |
| `security/` | Request guards, outbound URL policy, rate limiting, and CAPTCHA |

The public barrel is `src/lib/index.ts`. Import a narrower module when code belongs to a specific server or feature boundary.

## Safety Boundaries

- `supabaseAdmin` and `SUPABASE_SECRET_KEY` are server-only.
- Admin and setup mutations must use the established auth/access helpers.
- Feature code must fail closed when its feature is inactive.
- Database schema changes require an upgrade migration under `infra/supabase/migrations/`.
- Validate external input at the route or service boundary.

## Verification

Run focused Vitest coverage for the changed module, followed by:

```bash
npm run test:run
npm run build
```

Use `npm run verify:full` for changes that cross database, setup, auth, feature, or release boundaries.
