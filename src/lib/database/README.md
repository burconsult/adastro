# Database Integration Layer

This directory contains the Supabase repository layer used by routes and services. The canonical export surface is `src/lib/database/index.ts`.

## Structure

- `connection.ts` wraps Supabase query execution and normalizes database errors.
- `base-repository.ts` provides shared repository behavior.
- `repositories/` contains domain-specific access for posts, pages, authors, taxonomy, media, settings, analytics, migrations, schedules, logs, and profiles.
- Repository tests live beside the implementation in `__tests__/`.

Content repositories also own content-version reads and restores. Editorial activity writes are handled by `src/lib/audit.ts` so the audit policy remains centralized.

## Client Selection

Repositories that accept `useAdmin` default to the RLS-scoped client:

```typescript
const posts = new PostRepository();
const adminPosts = new PostRepository(true);
```

Only authenticated server code may construct an admin repository. Never use the admin client in browser code or as a shortcut around an RLS failure.

## Imports

Use the database barrel for shared repository and error types:

```typescript
import {
  DatabaseError,
  NotFoundError,
  PostRepository
} from '@/lib/database';
```

Use the narrower repository module when it makes ownership clearer.

## Schema Changes

- Existing installations: add an ordered upgrade migration under `infra/supabase/migrations/`.
- Fresh installations: update `infra/supabase/migrations/000_core.sql` when the consolidated baseline must include the change.
- Preserve the `admin`, `author`, and `reader` role model.
- Add or update migration contract tests for auth, RLS, privileged functions, scheduling, versioning, and audit changes.

See `docs/database-sql-layout.md` and `docs/architecture/data-ownership.md` for the canonical schema workflow.
