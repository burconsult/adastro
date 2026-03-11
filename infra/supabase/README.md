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

### Core Tables

- **authors** - Blog authors and users (includes `slug`)
- **categories** - Hierarchical content categories
- **tags** - Content tags (many-to-many with posts)
- **posts** - Blog posts and pages
- **media_assets** - Uploaded files and images

### Junction Tables

- **post_categories** - Links posts to categories
- **post_tags** - Links posts to tags

### Key Features

- **UUID primary keys** for better scalability
- **Row Level Security (RLS)** for data protection
- **Automatic timestamps** with triggers
- **Hierarchical categories** with parent-child relationships
- **JSONB fields** for flexible metadata storage
- **Optimized indexes** for common queries

## Environment Variables

Required environment variables in `.env`:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SECRET_KEY=your_supabase_secret_key
SITE_URL=http://localhost:4321
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
