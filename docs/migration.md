# WordPress Migration Guide

This document is the current source of truth for the migration workflow, pipeline stages, and API behavior.

See the diagram in `docs/architecture/migration-pipeline.md`.

## Pipeline Stages
1. **Parse WXR** – load and validate the XML export.
2. **Authors** – create or map author profiles.
3. **Categories** – create or map categories.
4. **Tags** – create or map tags.
5. **Media** – fetch and upload media into the configured media bucket.
6. **Posts** – create posts and associate taxonomy/media.
7. **Cleanup** – optional post‑migration optimization.

## API Endpoints (Admin)
- `POST /api/admin/migration/upload-url` – signed URL for large WXR uploads.
- `POST /api/admin/migration/import` – start import; streams progress + result.
- `GET /api/admin/migration/status` – fetch job status + summary.
- `POST /api/admin/migration/undo` – remove records created by a job.

## Storage
- **Migration bucket** (private): temporary WXR files (`storage.buckets.migrationUploads`).
- **Media bucket** (public): uploaded/optimized media under `uploads/*` (`storage.buckets.media`).

## Trial Imports + Undo
- Trial import caps the first 10 posts while importing all authors/taxonomy.
- Each import tracks `migration_artifacts` so an undo can cleanly remove imported data.

## Routing Alignment
- Redirect mappings now use the active article routing settings (`content.articleBasePath` + `content.articlePermalinkStyle`) instead of a hardcoded `/blog` target.
- If `Preserve URL structure` is enabled, original WordPress paths are kept when possible.

## Large Files
- Files over the form threshold are sent through a signed storage upload and referenced by `storagePath`.
- The import endpoint cleans up uploaded WXR files after processing.

## Known Constraints
- Missing or unreachable media URLs are skipped with warnings.
- Optimizer runs are optional and can be invoked after the import completes.
- WordPress pages (`post_type=page`) are not imported yet; migrate those via Admin → Pages.
