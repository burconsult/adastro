# Contracts

## 1. Feature Module Contract

Canonical type: `FeatureModule` in `src/lib/features/types.ts`.

Required:
- `id`
- `definition` (`id`, `label`, `description`, `settings`)

Optional:
- `admin`, `ui`, `i18n`

Server runtime contract (`FeatureServerModule`):
- `id`
- optional `server` profile extension hooks
- optional `loadApi` for feature API dispatch

Invariant:
- Settings key `features.<id>.enabled` defines active/inactive gate.

## 2. Setup API Contract

- `GET /api/setup/status`: returns readiness checks, routing info, env requirements.
- `GET /api/setup/sql?template=<core|seed|admin>`: returns SQL templates.
- `POST /api/setup/automate`: applies safe setup automation tasks.
- `POST /api/setup/routing`: saves article route config.
- `POST /api/setup/complete`: validates blockers and sets `setup.completed`.

Invariant:
- `/api/setup/complete` is the only path that should flip setup gate to complete.
- `/setup` availability after completion is controlled by `setup.allowReentry`.

## 3. Settings Contract

Registry composition:
- Core: `src/lib/settings/core-definitions.ts`
- Features: `src/lib/features/*/settings.ts`
- Combined by: `src/lib/settings/registry.ts`

Invariant:
- New setting keys must be registered through definitions, not ad-hoc writes.
- Setup gate settings are registry-managed keys: `setup.completed`, `setup.allowReentry`.

## 3.1 Feature API Dispatch Contract

- `src/pages/api/features/[feature]/[action].ts` is the central dispatcher.
- Dispatcher must enforce inactive-feature guard before invoking handlers.
- Feature handlers should assume dispatcher-level guard exists, but still validate auth/input.

## 3.2 AI Feature API Contract

Actions currently exposed by AI feature module:
- `POST /api/features/ai/seo`
- `POST /api/features/ai/image`
- `POST /api/features/ai/audio`
- `GET /api/features/ai/status`
- `GET /api/features/ai/models`
- `GET /api/features/ai/catalog`
- `GET /api/features/ai/usage`

Invariants:
- Request payloads are schema-validated server-side.
- Provider/model values are allowlisted against registry/catalog.
- Rate limit + usage-cap checks run before provider calls.
- Errors fail closed with generic server messages.

## 3.3 MCP Endpoint Contract

- `ALL /mcp` is served by `src/pages/mcp.ts`.
- Endpoint must fail closed when `MCP_SERVER_TOKEN` is missing (`503`).
- Endpoint must reject unauthorized calls (`401`) unless the bearer token matches.
- Transport is stateless request/response over MCP HTTP streamable transport.

Invariants:
- `MCP_SERVER_TOKEN` is server-only and must never be exposed in client bundles.
- Error responses must stay sanitized and protocol-safe.
- Tool registration is owned by `src/lib/mcp/server.ts`; route only handles auth + transport lifecycle.

## 4. Routing Contract

Content routing settings:
- `content.articleBasePath`
- `content.articlePermalinkStyle`

Consumers:
- `src/lib/site-config.ts`
- `src/lib/routing/articles.ts`
- `src/middleware.ts` (legacy rewrite behavior)

## 5. Theme Contract

Theme modules are registered via `src/lib/themes/manifest.ts` and looked up by id.

Invariant:
- Any new theme must provide valid metadata + CSS and be resolvable by id.

## 6. Media Contract

Media persistence must support both historical and current column representations:
- `dimensions` / `original_dimensions` as object (JSONB) and legacy text JSON.

Primary orchestrator:
- `src/lib/services/media-manager.ts`
