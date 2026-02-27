# Auth + RLS Diagram

This diagram captures how Supabase Auth, app metadata roles, and RLS policies gate access to the app.

```mermaid
flowchart TD
  %% Clients
  Browser["Browser (public + admin)"]
  AdminUI["Admin UI"]
  PublicUI["Public UI"]

  %% Astro server
  ApiRoutes["Astro API routes /src/pages/api/**"]
  AuthHelpers["Auth helpers (cookies + app_metadata.role)"]

  %% Supabase
  Auth["Supabase Auth (auth.users)"]
  Trigger["Trigger: handle_new_auth_user"]
  Authors["public.authors (slug, profile)"]
  Posts["public.posts"]
  Media["public.media_assets"]

  %% Roles
  RoleAdmin["role: admin"]
  RoleAuthor["role: author"]
  RoleReader["role: reader"]

  %% RLS policies
  PublicRead["RLS: public read for published content"]
  AuthorWrite["RLS: author owns posts/media"]
  AdminWrite["RLS: admin full access"]

  Browser --> PublicUI --> Posts
  Browser --> AdminUI --> ApiRoutes
  ApiRoutes --> AuthHelpers
  AuthHelpers --> Auth

  Auth --> RoleAdmin
  Auth --> RoleAuthor
  Auth --> RoleReader
  Auth --> Trigger --> Authors

  Posts --> PublicRead
  Media --> PublicRead
  Authors --> PublicRead

  RoleAuthor --> AuthorWrite
  RoleAdmin --> AdminWrite

  AdminWrite --> Posts
  AdminWrite --> Media
  AdminWrite --> Authors

  AuthorWrite --> Posts
  AuthorWrite --> Media
```

Notes
- Roles live in `auth.users.raw_app_meta_data.role` and are read by the backend helpers.
- The `handle_new_auth_user` trigger creates an author profile and slug on user creation.
- Public reads are allowed for published content; write access is controlled by role + ownership.
- Invite and recovery links route through `/auth/callback` and are forced through `/auth/reset-password` before role-specific destinations.
- Role-safe redirects are centralized in `src/lib/auth/access-policy.ts` and enforced by both middleware and login APIs.
