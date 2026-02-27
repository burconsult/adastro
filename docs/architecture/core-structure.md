# Core Structure Diagram

> Snapshot reference: for the canonical and maintained map, use `docs/architecture/system-map.md`.

This diagram maps the core stack (public site, admin, API, services, data, infra) and how
optional feature modules plug in without being required for the core to run.

```mermaid
flowchart TD
  %% Routes
  subgraph Routes["Astro Routes"]
    PublicRoutes["Public routes /src/pages/*"]
    AdminRoutes["Admin routes /src/pages/admin/*"]
    ApiRoutes["API routes /src/pages/api/*"]
  end

  %% UI Layers
  subgraph UI["UI Layer"]
    BaseLayout["BaseLayout + Navigation"]
    AdminLayout["AdminLayout + AdminNav"]
    AstroComponents["Astro components /src/components"]
    ReactComponents["React admin components /src/lib/components"]
  end

  %% Core Services
  subgraph Core["Core Services"]
    Settings["SettingsManager + SiteConfig"]
    I18n["Core i18n"]
    Repos["Repositories (posts, pages, media, authors)"]
    Services["Services (auth, media, migration, SEO)"]
  end

  %% Data + Infra
  subgraph Data["Supabase Data"]
    Auth["Supabase Auth"]
    Postgres["Postgres core tables"]
    Storage["Storage buckets"]
  end

  subgraph Infra["Infra"]
    Migrations["infra/supabase/migrations/000_core.sql"]
    Scripts["infra/supabase/scripts/migrate.js"]
  end

  %% Feature modules
  subgraph Features["Optional Feature Modules"]
    FeatureRegistry["Feature registry + loader"]
    FeatureAI["features/ai"]
    FeatureComments["features/comments"]
    FeatureNewsletter["features/newsletter"]
  end

  %% Flows
  PublicRoutes --> BaseLayout
  PublicRoutes --> AstroComponents
  AdminRoutes --> AdminLayout
  AdminRoutes --> ReactComponents
  ApiRoutes --> Services
  AstroComponents --> Services
  ReactComponents --> Services
  Services --> Repos
  Repos --> Postgres
  Services --> Auth
  Services --> Storage
  Settings --> Postgres
  I18n --> AstroComponents
  I18n --> ReactComponents
  Scripts --> Migrations
  Migrations --> Postgres
  Migrations --> Storage
  FeatureRegistry --> Settings
  FeatureAI --> ReactComponents
  FeatureAI --> Services
  FeatureComments --> ReactComponents
  FeatureNewsletter --> Services
```

## Optimization Opportunities
- Use `count` queries + select subsets for list views instead of `getPublishedPosts()` loading full rows for pagination.
- Ensure `content_html` is generated on save for pages to avoid EditorJS serialization at request time.
- Add indexes for category/tag lookups (e.g., `post_categories.category_id`, `post_tags.tag_id`) to speed taxonomy pages.
- Cache site settings and navigation/footer settings with a short TTL to cut repeated DB reads on SSR.
- Keep sitemap and RSS endpoints cacheable with explicit `Cache-Control` + conditional headers.

## Potential Errors / Risks to Verify
- `set:html={post.content}` renders raw HTML; confirm every write path sanitizes content (admin editor, migration, API).
- `000_core.sql` includes storage policy updates that require superuser; confirm `db:setup` handles this or split into a manual step.
- `sitemap.xml.ts` assumes `updatedAt` is a `Date`; confirm repository mapping to avoid runtime `toISOString` errors.
- `authors.auth_user_id` is nullable; if you require strict auth linkage, enforce this in admin flows or schema.
