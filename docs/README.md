# Documentation Guide

Use this page to find the current source of truth and to decide where new documentation belongs.

## Operator Documentation

- `INSTALLATION.md` - canonical hosted installation and setup flow.
- `environment-variables.md` - runtime and feature environment variables.
- `security.md` and `../SECURITY.md` - operating guidance and vulnerability reporting.
- `migration.md` - WordPress migration workflow.
- `mcp-server.md` - remote MCP endpoint and authentication.

## Architecture and Development

- `architecture/README.md` - architecture index and machine-readable map.
- `database-sql-layout.md` - schema baseline, upgrades, feature SQL, and generated SQL boundaries.
- `feature-development.md` - modular feature contract.
- `engineering/local-testing.md` - supported local verification commands.
- `engineering/ai-collab-playbook.md` - current AI-assisted change workflow.
- `engineering/ai-assisted-coding-lessons.md` - historical engineering retrospective, not a current contract.

## Release Documentation

- `../CHANGELOG.md` - durable release history and upgrade notes.
- `release-gates.md` - release policy.
- `release-execution-board.md` - current candidate only; reset for each release.
- `release-smoke-test.md` - hosted functional checklist.
- `performance-release-checklist.md` - Lighthouse and PSI gate.

## Documentation Lifecycle

1. Keep operator instructions and architecture contracts version-independent when possible.
2. Put completed release history in `CHANGELOG.md`, tags, and GitHub releases.
3. Delete obsolete tracked documents when Git history already preserves them.
4. Mark intentional retrospectives as historical so they are not mistaken for current instructions.
5. Update the architecture map when files or ownership boundaries change.

## Local-Only Material

The following ignored directories are not part of the product documentation:

- `external_docs/` - external plans, reference material, and legacy migration notes.
- `local-archive/` - temporary quarantine for files whose value is still being assessed.
- `release/` - generated or working release artifacts.

Do not move an active source of truth into an ignored directory. Never place secrets, production exports, personal data, or customer content in these folders.
