# Contributing to AdAstro

Thanks for your interest in contributing.

AdAstro is maintained by a solo developer, so review bandwidth is limited. Contributions are welcome, but review/merge timing is **best effort**.

## Before You Open a PR

1. Open an issue first for larger changes (features, architecture changes, migrations, UI redesigns).
2. Keep PRs focused and small when possible.
3. Avoid mixing refactors with behavior changes unless necessary.

## Good First Contributions

- bug fixes with clear reproduction steps
- documentation improvements
- tests for existing behavior
- accessibility and UI consistency fixes
- performance improvements with measurable impact

## Development Expectations

- Follow the existing architecture and feature-module boundaries.
- Do not introduce secrets or environment-specific values into commits.
- Prefer incremental, well-scoped changes.
- Update docs when behavior/setup changes.

## Tests and Verification

At minimum, run the checks relevant to your change.

Common commands:

```bash
npm run test:run
npm run build
```

For broader validation (recommended before larger PRs):

```bash
npm run verify:features
npm run verify:full
```

## Security Issues

Do not open public issues for security vulnerabilities.

Use the process in:
- `SECURITY.md`

## Licensing

By contributing, you agree that your contributions are licensed under the repository license.

