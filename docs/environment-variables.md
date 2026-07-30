# Environment Variables

Use this as the canonical env var reference for AdAstro.

The install wizard checks the required core vars first. Feature-specific vars are only needed when you activate/configure those features.

## Core (Hosted Deployments)

Set these in Vercel / Netlify project settings:

```bash
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
SITE_URL=https://your-domain.com
```

Notes:
- `SITE_URL` should be treated as required on hosted deployments for canonical URLs, auth callbacks, invite/recovery redirects, sitemap/RSS, and email links.
- If `SITE_URL` is not set, AdAstro now fails closed for auth-sensitive redirects outside local development instead of trusting request-derived hosts.
- Any env var change requires a redeploy on Vercel/Netlify before the app can use it.
- Keep hosted environments isolated. If `www.adastro.no` stays on the existing production Supabase project, give the Netlify site and any Vercel test project their own Supabase-backed env values instead of reusing production secrets.
- Netlify Deploy Previews and branch deploys need the same required core vars plus `SITE_URL` in the relevant preview/branch context if you want hosted smoke tests to exercise auth flows instead of failing closed.
- Azure/Microsoft login and TOTP MFA do not require extra app env vars. Configure those in Supabase Auth and enable the matching app settings in AdAstro.

## Core (Local Development)

Use a project-root `.env` for local testing only:

```bash
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
SITE_URL=http://127.0.0.1:4321
```

Notes:
- Local helper scripts also support `.env.local`.
- Local helper scripts derive Supabase URL/keys from `supabase status -o env`.
- `LOCAL_APP_HOST` / `LOCAL_APP_PORT` let you move the local Astro server without editing package scripts; the default remains `http://127.0.0.1:4321`.
- `LOCAL_SITE_URL` still overrides the derived local app URL when you need an explicit callback origin.
- Providers/hosts do not use `.env` files directly; this is only for local dev/CLI workflows.

## Platform / Runtime Overrides (Advanced, Optional)

Normally not required:

```bash
ASTRO_ADAPTER=                 # optional override: vercel | netlify
MEDIA_STORAGE_BUCKET=
MIGRATION_UPLOADS_BUCKET=
MCP_SERVER_TOKEN=              # enables authenticated /mcp endpoint (remote MCP tools)
TRUSTED_PROXY_IP_HEADERS=      # optional comma-separated allowlist for custom reverse-proxy client IP headers
```

Notes:
- `ASTRO_ADAPTER` is optional because AdAstro auto-detects Vercel/Netlify at runtime/build time.
- Bucket names are auto-derived per instance by setup; override only if you need explicit naming.
- `MCP_SERVER_TOKEN` enables the built-in AdAstro MCP endpoint at `/mcp`. Use a long random secret and rotate if shared.
- `TRUSTED_PROXY_IP_HEADERS` is only for custom/self-hosted reverse proxies. AdAstro now trusts Vercel/Netlify-specific IP headers automatically and otherwise fails closed to `unknown` unless you explicitly allow trusted header names such as `cf-connecting-ip`.
- Do not add Azure client secrets or MFA secrets to AdAstro env. OAuth provider credentials and MFA factor settings belong in Supabase/Auth dashboard configuration.

## Newsletter Feature (Optional)

Only required if the newsletter feature is activated and configured:

### Resend

```bash
RESEND_API_KEY=
```

### Amazon SES (SMTP mode)

```bash
AWS_SES_REGION=
AWS_SES_SMTP_USER=
AWS_SES_SMTP_PASS=
AWS_SES_SMTP_HOST=             # optional override
AWS_SES_SMTP_PORT=587          # optional override
```

Newsletter sending behavior, templates, consent copy, and provider choice are configured in Admin after activation.
AdAstro now emits `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers for newsletter deliveries automatically.
Signed unsubscribe links use `SUPABASE_SECRET_KEY` by default. Set `NEWSLETTER_SIGNING_SECRET` only if you want a dedicated newsletter signing secret:

```bash
NEWSLETTER_SIGNING_SECRET=    # optional override for signed unsubscribe links
```

## AI Feature (Optional)

Only set keys for providers you actually enable:

```bash
AI_GATEWAY_API_KEY=
AI_GATEWAY_BASE_URL=
OPENAI_API_KEY=
GOOGLE_GENAI_API_KEY=
ANTHROPIC_API_KEY=
ELEVENLABS_API_KEY=
```

`AI_GATEWAY_API_KEY` is the default path for text and image generation on new installs.
`AI_GATEWAY_BASE_URL` is optional and only needed if you want to override the default Vercel AI Gateway endpoint.
Provider/model selection, per-modality defaults, and audio voice selection are managed in Admin after the AI feature is activated.

## CDN / Image Delivery (Advanced, Optional)

Default media delivery works without these:

```bash
IMAGE_CDN_PROVIDER=
IMAGE_CDN_BASE_URL=
IMAGE_CDN_API_KEY=
IMAGE_CDN_ZONE_ID=
```

Use these only if you are wiring a custom CDN integration and understand the provider-specific behavior.

`IMAGE_CDN_PROVIDER` accepts `vercel`, `netlify`, `cloudflare`, or `custom`.

On Vercel, AdAstro enables the Vercel image service for Supabase Storage media by default. Custom CDN env vars are only needed when replacing that hosted path.

## Netlify CLI Operations (Optional, Ops Only)

These are not required for app runtime, but they are useful for low-friction Netlify CLI workflows:

```bash
NETLIFY_AUTH_TOKEN=            # optional if you do not want browser-based netlify login
NETLIFY_SITE_ID=               # optional helper for netlify link/deploy commands
```

Notes:
- These values are for the Netlify CLI and deployment operations only.
- Do not treat them as application runtime requirements.

## Host Isolation Recommendation

For multi-host testing, use separate hosting projects with separate env scopes:

- Vercel production: existing `www.adastro.no` Supabase project only
- Netlify site: fresh Supabase project or a dedicated non-production clone
- Vercel test deployment: the same fresh non-production Supabase project used for Netlify, or another isolated staging project

This keeps production content, auth users, storage buckets, and email flows isolated from deployment testing.

## What Not To Use (v1)

- `SUPABASE_ANON_KEY` (legacy)
- `SUPABASE_SERVICE_ROLE_KEY` (legacy naming)
- `PUBLIC_SITE_URL` (deprecated)

Use `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and `SITE_URL`.
