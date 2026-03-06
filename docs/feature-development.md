# Developing Modular Features

This guide describes the modular feature pattern used by built-in features (`ai`, `comments`, `newsletter`).

Before implementing a new feature, read:
- `docs/architecture/feature-map.md`
- `docs/architecture/contracts.md`
- `docs/architecture/boundaries.md`
- `docs/architecture/data-ownership.md`

## Goals
- Keep core stable and minimal.
- Ship optional functionality as installable/disableable modules.
- Avoid coupling feature runtime to core page logic.

## Required Structure

Create a feature folder under `src/lib/features/<feature-id>/` with:
- `index.ts` (exports `FEATURE_MODULE`)
- `server.ts` (exports `FEATURE_SERVER_MODULE`)
- `settings.ts` (feature-scoped settings keys)
- `feature.json` (metadata for install/export/uninstall workflows)
- optional:
  - `api.ts`
  - `admin/*`
  - `ui/*`
  - `profile/*`
  - `i18n.ts`

Example ids:
- `ai`
- `comments`
- `newsletter`

## Feature Contract

Implement a `FeatureModule` in `index.ts`:
- `id`
- `definition` (`label`, `description`, `settings`)
- optional `admin`, `ui`, `i18n`

Implement a `FeatureServerModule` in `server.ts`:
- `id`
- optional `server` profile extension hooks
- optional `server.mcp` extension hooks (`getTools`) for MCP tool registration
- optional `loadApi` for SSR handlers

Export:
- named module constant (`<FEATURE>_FEATURE_MODULE`)
- `FEATURE_MODULE` alias for installer compatibility
- named server module constant (`<FEATURE>_FEATURE_SERVER_MODULE`)
- `FEATURE_SERVER_MODULE` alias for installer compatibility

## Settings Conventions
- Prefix keys with `features.<id>.*`.
- Default `features.<id>.enabled` to `false` for bundled features.
- Validate inputs (length, options, min/max).

### Reusing Core Settings
- Put shared cross-feature controls under a core prefix (example: `security.recaptcha.*` in `src/lib/settings/core-definitions.ts`).
- Keep per-feature opt-in flags inside the feature namespace (example: `features.comments.recaptcha.enabled`).
- Resolve shared + feature flags server-side in one helper so every feature uses the same decision logic.
- Never read shared security settings directly from client-side feature code.

## API Conventions
- Place handlers in `api.ts`.
- Enforce auth/role checks in each handler.
- Apply rate limits for public submission endpoints.
- Sanitize and validate all user input before DB writes.
- If external providers are involved, keep a single provider/capability catalog file (AI uses `lib/provider-catalog.ts`) to avoid scattered hardcoded provider logic.

## MCP Tool Conventions
- Put feature MCP tool definitions in `mcp.ts` under the feature folder.
- Tool names must start with `<featureId>_` (example: `comments_queue_list`).
- Feature MCP handlers must fail closed when feature settings disable the capability.
- Never reuse core MCP tool names; collisions are skipped during registration.
- Keep MCP tool behavior aligned with feature ownership boundaries (no cross-feature side effects).

## Install/Uninstall Integration
- Register bundled modules in `src/lib/features/manifest.ts`.
- Register bundled server modules in `src/lib/features/server-manifest.ts`.
- External installs use:
  - `infra/features/install.js`
  - `infra/features/uninstall.js`
- External install target path is `src/lib/features/<feature-id>/` (same layout as bundled modules).
- Uninstall supports:
  - deactivate only (keep files),
  - remove feature files (`removeFiles` / `--remove-files`),
  - optional data purge (`purgeData`) with export-first flow in admin UI.
- Include owned table names in `feature.json` (`dataTables`) for safe export/uninstall prompts.

## Security Checklist
- Require admin for moderation/settings mutations.
- Use allowlists for enum-like settings.
- Apply anti-spam controls for public forms:
  - rate limit
  - honeypot
  - minimum submit time
  - blocked terms
- Never trust client-provided user identity; derive from auth context.

## Testing Checklist
- Unit test core feature API handlers.
- Add component tests for feature UI states (enabled/disabled, error, success).
- Verify feature disabled state does not break core pages.

## Release Checklist for New Features
- Feature appears in `/admin/features`.
- Feature can be enabled/disabled via settings.
- Feature APIs return clear errors when disabled.
- Docs updated (`README.md` + this guide if contract changes).
