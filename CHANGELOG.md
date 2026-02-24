# Changelog

All notable changes to Axiom are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Branching strategy documentation** — formal Git branching model adopted (trunk-based with
  environment promotion gates):
  - [ADR-0009](docs/adr/adr-0009-git-branching-strategy.md) records the decision and rationale
  - [docs/contributing/BRANCHING_STRATEGY.md](docs/contributing/BRANCHING_STRATEGY.md) provides
    the day-to-day workflow guide covering branch naming, promotion flow
    (`main → dev → uat → prod`), hotfix procedure, and branch protection settings
  - [`scripts/setup-branches.sh`](scripts/setup-branches.sh) automates creation and protection of
    `dev`, `uat`, and `prod` branches via the GitHub CLI

## [0.2.0] - 2026-02-20

### Added

- **Reusable frontend UI components** — five shared components extracted from page-level inline code,
  ensuring consistent presentation across all pages and making colour-scheme changes a single-file
  operation:
  - `Badge` — coloured label/chip with `blue | green | red | yellow | orange | purple | gray`
    variants, `rounded | pill` shapes, and optional monospace font
  - `Alert` — notification banner with `info | warning | error | success` variants
  - `LoadingSpinner` — full-page centred loading indicator with configurable message
  - `StatCard` — metric display card with title, value, and accent colour
  - `PageHeader` — standard page header including back link, title, subtitle, `ThemeToggle`, and
    an `actions` slot for per-page controls
- Documentation for the new reusable components in [`docs/ui-patterns.md`](docs/ui-patterns.md)
- Copilot instructions updated in
  [`.github/instructions/frontend-ui.instructions.md`](.github/instructions/frontend-ui.instructions.md)
  so future pages use shared components rather than inline definitions

### Changed

- All eight frontend pages (`countries`, `currencies`, `code-mappings`, `lei`, `lei-records`,
  `accounts`, `instruments`, `ssi`) migrated to the new shared components — removes ~400 lines of
  duplicated JSX

### Fixed

- `ssi/page.tsx` back-navigation was using a raw `<a>` element; replaced with Next.js `<Link>`

## [0.1.0] - 2026-01-01

### Added

- Initial release of Axiom Financial Services Static Data Management System
- Go/Gin backend with PostgreSQL, GORM, and RabbitMQ
- Next.js/Tailwind CSS frontend with dark mode support
- LEI data acquisition from GLEIF with automated synchronisation
- ISO 3166 countries and ISO 4217 currencies reference data
- Code mappings for cross-system code translation
- Multi-environment Docker Compose deployment (dev, UAT, production)
- JWT authentication framework
- Prometheus metrics and health check endpoints

[Unreleased]: https://github.com/techie2000/axiom/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/techie2000/axiom/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/techie2000/axiom/releases/tag/v0.1.0
