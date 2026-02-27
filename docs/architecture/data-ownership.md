# Data Ownership

## 1. Core-Owned Tables

Owned by core schema and core repositories/services:
- `site_settings`
- `authors`
- `posts`
- `pages`
- `page_sections`
- `categories`
- `tags`
- `post_categories`
- `post_tags`
- `media_assets`
- `migration_artifacts` (if present in core migration)
- other core operational tables from `000_core.sql`

## 2. Feature-Owned Tables

- Comments feature: `comments`
- Newsletter feature: `newsletter_subscribers`, `newsletter_campaigns`, `newsletter_deliveries`
- AI feature: `ai_usage_events` (usage caps + reporting telemetry)

## 3. Ownership Rules

1. Core code does not directly assume feature tables exist.
2. Feature code may assume own tables after activation/migration.
3. Setup status may probe feature tables, but always as optional checks.

## 4. Schema Change Protocol

For every schema change:
1. Add migration SQL.
2. Add rollback/uninstall strategy (for feature-owned schema).
3. Update setup/readiness checks when prerequisite semantics change.
4. Update this file and `docs/architecture/map.json`.

## 5. Storage Ownership

Buckets:
- Core media bucket: from `getStorageBucketConfig().media`
- Core migration bucket: from `getStorageBucketConfig().migrationUploads`

Rules:
1. Bucket names are instance-specific when possible.
2. Wizard automation creates/validates buckets.
3. Feature-specific storage usage must document required bucket behavior.
