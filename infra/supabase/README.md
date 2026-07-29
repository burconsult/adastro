# Database Setup

This directory contains the database schema and optional seed data for the Adastro CMS.

## Quick Start

1. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

2. **Run initial setup**:
   ```bash
   npm run db:full
   ```
3. **Create your admin user** (Supabase Dashboard → Authentication → Users), then run:
   ```sql
   -- infra/supabase/setup-admin-user.sql
   ```

## Local Port Allocation

This repo intentionally uses a non-default local Supabase port block so it can run alongside other local Supabase projects:

- API: `55321`
- DB: `55322`
- Studio: `55323`
- Mailpit: `55324`
- Analytics: `55327`

Use `npm run local:supabase:status` to see the live endpoints for the current workspace.
Run `npm run local:doctor` if you want a quick readiness check for port collisions, runtime drift, and missing local DB bootstrap.

## Files Structure

- `migrations/000_core.sql` - Consolidated schema for initial installs
- `seed.sql` - Optional sample content and locale-aware baseline settings (no auth users created)
- `functions.sql` - Custom database functions
- `README.md` - This file

## Migration Scripts

- `npm run db:setup` - Run the consolidated schema SQL
- `npm run db:seed` - Insert seed data
- `npm run db:full` - Setup + seed (recommended for first time)
- `npm run db:reset` - Reset database (development only)

## Database Schema Overview

### Core Content Tables

- **authors** - Author profiles mapped to Supabase auth users
- **categories** - Hierarchical content categories
- **tags** - Content tags
- **posts** - Locale-aware blog posts
- **post_versions** - Private, server-created snapshots for post version history and restore
- **pages** - Locale-aware editable pages
- **page_sections** - Reusable page-builder sections for pages
- **page_versions** - Private, server-created snapshots for page version history and restore
- **media_assets** - Uploaded files and images

### Supporting Core Tables

- **post_categories** / **post_tags** - Content taxonomy junction tables
- **site_settings** - Runtime/admin settings
- **analytics_events** - Built-in analytics event storage
- **migration_jobs** / **migration_artifacts** - WordPress import tracking + rollback support
- **scheduled_posts** - Scheduled publishing queue
- **system_logs** - System and operational logs
- **audit_events** - Immutable editorial and administrative activity ledger
- **user_profiles** - Per-user feature/profile extension data

### Key Features

- **UUID primary keys** for better scalability
- **Row Level Security (RLS)** for data protection
- **Automatic timestamps** with triggers
- **Automatic scheduled publishing** through a durable queue and one-minute Supabase Cron worker
- **Admin-only audit history** with service-only writes and explicit retention pruning
- **Hierarchical categories** with parent-child relationships
- **JSONB fields** for flexible metadata storage
- **Optimized indexes** for common queries
- **Feature isolation** so comments/newsletter/AI tables stay outside core schema until activated

## Environment Variables

Required environment variables in `.env`:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SECRET_KEY=your_supabase_secret_key
SITE_URL=http://127.0.0.1:4321
```

## Row Level Security

The database uses RLS policies to:

- Allow public read access to published content
- Restrict admin operations to users with `app_metadata.role = 'admin'`
- Treat authenticated users as authors by default (unless role is set to `reader`)

## Storage Policy Migrations

`000_core.sql` includes storage security policies that require a postgres/superuser
connection. If you run the schema via `infra/supabase/scripts/migrate.js`, follow up by
executing the storage policy section manually in the Supabase SQL editor or CLI.

## Storage Buckets
- **`<site-host>-media-assets`** (public by default) – stores uploads under `uploads/*`.
- **`<site-host>-migration-uploads`** (private by default) – stores temporary WXR files during imports.
- Bucket IDs can be overridden with `MEDIA_STORAGE_BUCKET` and `MIGRATION_UPLOADS_BUCKET`.

## Next Steps

After setting up the database:

1. Promote your admin account with `infra/supabase/setup-admin-user.sql`
2. (Optional) run `npm run db:seed` to load the sample posts and default-locale system pages
3. Open `/setup`, choose your default locale + active locales, and let the wizard provision localized system pages
4. Verify your article index path and localized public routes (`/{locale}/...`) before importing or writing content

## Scheduled Publishing

The core schema enables `pg_cron` and registers the
`adastro-publish-scheduled-posts` job. It reconciles due posts every minute
inside Postgres, so the same behavior works on Vercel, Netlify, and local
Supabase without a host-specific cron endpoint or secret.

Existing installations must apply
`migrations/010_scheduled_publishing.sql`. Verify the job in Supabase under
**Integrations → Cron**, or with:

```sql
select jobname, schedule, command, active
from cron.job
where jobname = 'adastro-publish-scheduled-posts';
```

## Editorial Audit Trail

Existing installations must apply `migrations/011_editorial_audit_trail.sql`.
The admin Activity page records core content, settings, and user-management
mutations without storing content bodies or secret values. Audit rows cannot be
updated or deleted directly. Admins should export JSON or CSV before using the
bounded retention action (30–3650 days).
