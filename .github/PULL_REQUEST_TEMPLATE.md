## Summary
- What changed and why?

## Architecture Impact
- Surfaces touched: (public/admin/api/setup/features/themes)
- Boundaries crossed: (none or list)
- Contracts changed: (none or list)

## Data + Migrations
- Schema changes: (none or list)
- Ownership area: (core or feature id)
- Rollback/uninstall plan: (required for feature schema changes)

## Feature State Safety
- [ ] Inactive features remain hidden and fail closed in APIs
- [ ] Active features work as expected

## Setup/Deploy Safety
- [ ] Setup gate behavior preserved
- [ ] Vercel/Netlify/Supabase setup flow not regressed

## Validation
- [ ] `npm run test:run`
- [ ] `npm run build`
- [ ] Relevant manual smoke checks

## Docs Updated
- [ ] `docs/architecture/system-map.md` (if structure changed)
- [ ] `docs/architecture/contracts.md` (if interface changed)
- [ ] `docs/architecture/data-ownership.md` (if schema ownership changed)
- [ ] `docs/architecture/map.json` (if topology changed)
- [ ] `docs/release-gates.md` (if release criteria changed)
