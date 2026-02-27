# Extra Features Architecture

> Snapshot reference: for current lifecycle + boundary rules, use `docs/architecture/feature-map.md` and `docs/architecture/contracts.md`.

Goal
- Keep optional features isolated from core while sharing a consistent toggle + settings experience.

Current registry + settings flow
- Feature manifest: `src/lib/features/manifest.ts`
- Feature server manifest: `src/lib/features/server-manifest.ts`
- Feature loader: `src/lib/features/loader.ts`
- Feature server loader: `src/lib/features/server-loader.ts`
- Feature registry: `src/lib/features/registry.ts`
- Feature definitions/modules: `src/lib/features/<feature>/index.ts`
- Feature server modules: `src/lib/features/<feature>/server.ts`
- Feature settings: `src/lib/features/<feature>/settings.ts`
- Settings registry: `src/lib/settings/registry.ts`
- Core settings: `src/lib/settings/core-definitions.ts`

Feature structure (template)
```
src/lib/features/<feature>/
  index.ts        # FeatureDefinition + FeatureModule export (FEATURE_MODULE)
  server.ts       # FeatureServerModule export (FEATURE_SERVER_MODULE)
  settings.ts     # SettingDefinition[] for all toggles/options
  api.ts          # FeatureApiModule handlers (optional)
  i18n.ts         # Feature-local translation strings (optional)
  admin/          # Admin UI extensions (optional)
  service.ts      # Feature-specific business logic (optional)
  types.ts        # Feature-specific types (optional)
  ui/             # Admin UI modules/components (optional)
  api/            # API helpers/guards (optional)
```

Naming conventions
- Feature id: lowercase slug (`ai`, `comments`, `newsletter`).
- Settings key prefix: `features.<feature>.*`
- Master toggle: `features.<feature>.enabled`
- Capability toggles: `features.<feature>.<capability>` (ex: `features.ai.enableSeo`)
- Category: `extras` (shown as "Extra Features" in settings UI)

Runtime gating rules
- UI: hide buttons/sections if the feature is disabled.
- API: enforce server-side checks before any feature action.
- Jobs/background: skip work when the feature is disabled.

Example (AI)
- Feature definition: `src/lib/features/ai/index.ts`
- Settings: `features.ai.*` in `src/lib/features/ai/settings.ts`
- Admin + API routes read settings to enable/disable AI tools.

Loader/manifest rules
- The manifest is the only place that imports feature modules.
- Remove a feature from the manifest to omit it from the build.
- External feature packages can be referenced directly in the manifest.
- Installers should update the manifest automatically; we call them "features" (not plugins).
- `index.ts` should stay UI/client-safe (`admin`, `ui`, `i18n`).
- Server handlers/profile hooks are declared in `server.ts`.

Feature module contract
```
export const FEATURE_MODULE: FeatureModule = {
  id: 'my-feature',
  definition: {
    id: 'my-feature',
    label: 'My Feature',
    description: 'Short feature summary.',
    settings: [...]
  },
  admin: {
    settingsPanel: MySettingsPanel
  },
  ui: {
    postEditor: {
      sidebarPanel: MySidebarPanel,
      seoActions: MySeoActions,
      editorJsTools: loadEditorJsTools
    },
    mediaLibrary: {
      panel: MyMediaPanel
    },
    profile: {
      panel: MyProfilePanel
    }
  },
  i18n: {
    en: {
      'settings.features.my-feature.title': 'My Feature',
      'settings.features.my-feature.description': '...'
    }
  }
};
```

```ts
export const FEATURE_SERVER_MODULE: FeatureServerModule = {
  id: 'my-feature',
  loadApi: async () => (await import('./api.js')).MY_FEATURE_API
};
```

Internationalization
- Feature modules can include an `i18n` map (locale → key/value strings).
- Core merges feature strings via `src/lib/features/i18n.ts`, so features can ship their own translations.
- Use namespaced keys: `settings.features.<feature>.*` to avoid collisions.

Feature package format
- Each feature package includes a `feature.json` at its root with:
  - `id` (required, lowercase kebab-case)
  - `entry` (optional, default `index.ts`)
  - `serverEntry` (optional, default `server.ts`)
  - `dataTables` (optional, list of tables owned by the feature for export/uninstall)
  - `profileDataKey` (optional, JSON key stored in `user_profiles.data` to export/purge)
  - `migrationsDir` (optional, default `migrations`)
  - `uninstallSql` (optional, path to SQL file for dropping feature tables)
- The entry module must export `FEATURE_MODULE`.
- The server entry module must export `FEATURE_SERVER_MODULE`.
- Package only the feature folder contents; installer copies into `src/lib/features/<id>/`.

Feature install flow
- Command: `npm run feature:install -- <path-to-zip-or-folder>`
- The installer:
  - Unpacks `.zip` archives (requires `unzip` on PATH).
  - Copies the feature into `src/lib/features/<id>/`.
  - Registers the feature in `src/lib/features/manifest.ts`.
  - Registers server hooks in `src/lib/features/server-manifest.ts`.
  - Applies SQL migrations from the feature package if present.
- Admin UI: `/admin/features` supports upload-based installs and settings management.

Feature uninstall flow
- Command: `npm run feature:uninstall -- <feature-id>`
- The uninstaller:
  - Removes manifest entries for the feature module.
  - Optionally removes `src/lib/features/<id>/` when `--remove-files` is supplied.
  - Cleans legacy `src/lib/features/installed/<id>/` folders if present from older installs.
- Admin UI: uninstall can export data first and optionally drop feature tables/settings.

API routing
- Core exposes a dispatcher at `src/pages/api/features/[feature]/[action].ts`.
- Features register handlers in `api.ts` and expose them via `server.ts` `loadApi`.

Best practices
- Keep feature services pure and dependency-injected where possible.
- Default to safe "off" for new sub-features unless product requires "on".
- Prefer feature-local types and helpers; only export what core needs.
- Add feature tests in `src/lib/<area>/__tests__` and keep mocks feature-local.

Implementation checklist
- Add `FeatureDefinition` + `FeatureModule` entries.
- Add the module to `src/lib/features/manifest.ts`.
- Gate UI + API with `features.<feature>.enabled`.
- Provide feature `i18n` strings for any new UI text.
- Document any DB changes in the feature plan doc.
