# Migration Pipeline Diagram

This diagram focuses on the WordPress migration flow, progress tracking, storage usage, and rollback path.

```mermaid
flowchart TD
  %% UI
  AdminUI["Admin UI /admin/migration"]
  UploadForm["WXR Upload Form"]
  ProgressUI["Progress + Logs UI"]

  %% API
  UploadURL["POST /api/admin/migration/upload-url"]
  ImportAPI["POST /api/admin/migration/import"]
  StatusAPI["GET /api/admin/migration/status"]
  UndoAPI["POST /api/admin/migration/undo"]

  %% Services
  MigrationSvc["WordPressMigrationService"]
  Optimizer["PostMigrationOptimizer"]
  MigrationRepo["MigrationRepository"]
  MediaSvc["MediaManager + CDNManager"]

  %% Supabase
  Auth["Supabase Auth (admin role)"]
  Postgres["Postgres (authors, posts, tags, categories, media_assets)"]
  Jobs["migration_jobs + migration_artifacts"]
  Uploads["Storage: migration bucket (private)"]
  MediaBucket["Storage: media bucket (public)"]

  %% Flow
  AdminUI --> UploadForm --> UploadURL
  UploadURL --> Uploads
  UploadForm --> ImportAPI
  ImportAPI --> Auth
  ImportAPI --> MigrationRepo
  ImportAPI --> MigrationSvc
  MigrationSvc --> Postgres
  MigrationSvc --> MediaSvc
  MediaSvc --> MediaBucket
  MigrationSvc --> Jobs
  MigrationRepo --> Jobs
  ImportAPI --> StatusAPI
  StatusAPI --> ProgressUI
  AdminUI --> UndoAPI
  UndoAPI --> Jobs
  UndoAPI --> Postgres
  UndoAPI --> MediaBucket

  %% Optional cleanup
  MigrationSvc --> Optimizer
  Optimizer --> Postgres
```

Notes
- Large WXR files use a signed upload URL to the configured migration bucket, then `storagePath` is passed to `/import`.
- Progress events are streamed from `/import` and displayed in the UI.
- `migration_artifacts` enables safe undo by tracking imported records per job.
- Service modules: `src/lib/services/wordpress-migration.ts` (orchestrator), `src/lib/services/wordpress-migration/parser.ts`, `src/lib/services/wordpress-migration/media-optimizer.ts`, and `src/lib/services/wordpress-migration/types.ts`.
