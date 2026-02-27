# Environment Variables (v1.0.0)

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
- `SITE_URL` is strongly recommended for canonical URLs, auth callbacks, invite/recovery redirects, sitemap/RSS, and email links.
- If `SITE_URL` is not set, AdAstro can fall back to detected request origin in some flows, but production installs should still set it explicitly.
- Any env var change requires a redeploy on Vercel/Netlify before the app can use it.

## Core (Local Development)

Use a project-root `.env` for local testing only:

```bash
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
SITE_URL=http://localhost:4321
```

Notes:
- Local helper scripts also support `.env.local`.
- Providers/hosts do not use `.env` files directly; this is only for local dev/CLI workflows.

## Platform / Runtime Overrides (Advanced, Optional)

Normally not required:

```bash
ASTRO_ADAPTER=                 # optional override: vercel | netlify
MEDIA_STORAGE_BUCKET=
MIGRATION_UPLOADS_BUCKET=
MCP_SERVER_TOKEN=              # enables authenticated /mcp endpoint (remote MCP tools)
```

Notes:
- `ASTRO_ADAPTER` is optional because AdAstro auto-detects Vercel/Netlify at runtime/build time.
- Bucket names are auto-derived per instance by setup; override only if you need explicit naming.
- `MCP_SERVER_TOKEN` enables the built-in AdAstro MCP endpoint at `/mcp`. Use a long random secret and rotate if shared.

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

## AI Feature (Optional)

Only set keys for providers you actually enable:

```bash
OPENAI_API_KEY=
GOOGLE_GENAI_API_KEY=
ANTHROPIC_API_KEY=
ELEVENLABS_API_KEY=
```

Provider/model selection and capability settings are managed in Admin after the AI feature is activated.

## CDN / Image Delivery (Advanced, Optional)

Default media delivery works without these:

```bash
IMAGE_CDN_PROVIDER=
IMAGE_CDN_BASE_URL=
IMAGE_CDN_API_KEY=
IMAGE_CDN_ZONE_ID=
```

Use these only if you are wiring a custom CDN integration and understand the provider-specific behavior.

## What Not To Use (v1)

- `SUPABASE_ANON_KEY` (legacy)
- `SUPABASE_SERVICE_ROLE_KEY` (legacy naming)
- `PUBLIC_SITE_URL` (deprecated)

Use `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and `SITE_URL`.
