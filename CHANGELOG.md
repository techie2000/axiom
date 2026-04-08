# Changelog

All notable changes to Axiom are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Replaced automatic patch bumping on `main` with manual semantic-version bumps, using footer build
  metadata (commit SHA + build timestamp) as the canonical test-state identifier.
- Added `scripts/bump-version.ps1` to keep `VERSION` and
  `backend/internal/version/version.go` in sync for manual minor and major version decisions.

## [0.3.0] - 2026-03-09

### Added

- **Branding-first entry flow for frontend routes**:
  - `/` now serves as a branding-only entry page
  - `/home` now serves as the public reference data hub
  - Sign-in success redirects non-bootstrap users to `/dashboard`

- **Branding asset pipeline and alternate theme-ready assets**:
  - Canonical source asset documentation added at [docs/assets/branding/README.md](docs/assets/branding/README.md)
  - Source files now include primary and alternate black/white variants in `docs/assets/branding/`
  - Runtime branding outputs include active assets in `frontend/public/branding/` and prepared alternate assets in
    `frontend/public/branding/alt-bw/`

- **CI/CD automation for environment branches** — addresses IMP-003 and NEG-002 from
  [ADR-0009](docs/adr/adr-0009-git-branching-strategy.md):
  - [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — unified CI pipeline that runs on
    `main`, `dev`, `uat`, and `prod` branches; detects the target deployment environment from the
    branch name and reports it as part of the CI summary (satisfies IMP-003)
  - [`.github/workflows/promote-main-to-dev.yml`](.github/workflows/promote-main-to-dev.yml) —
    nightly scheduled workflow (01:00 UTC daily, before the 02:00 GLEIF LEI full-sync) that opens
    a promotion pull request from `main` → `dev` whenever `main` is ahead; prevents branch drift
    accumulation (satisfies NEG-002 / MIT-002); also supports `workflow_dispatch` with dry-run
  - [`.github/workflows/promote-dev-to-uat.yml`](.github/workflows/promote-dev-to-uat.yml) —
    weekly scheduled workflow (01:00 UTC every Monday) that opens a promotion pull request from
    `dev` → `uat` whenever `dev` is ahead; requires at least one review before merging
  - [`.github/workflows/promote-uat-to-prod.yml`](.github/workflows/promote-uat-to-prod.yml) —
    monthly scheduled workflow (01:00 UTC on the 1st of each month) that opens a promotion pull
    request from `uat` → `prod` whenever `uat` is ahead; requires at least two reviews and
    coordinated team communication before merging
- **Branching strategy documentation** — formal Git branching model adopted (trunk-based with
  environment promotion gates):
  - [ADR-0009](docs/adr/adr-0009-git-branching-strategy.md) records the decision and rationale
  - [docs/contributing/BRANCHING_STRATEGY.md](docs/contributing/BRANCHING_STRATEGY.md) provides
    the day-to-day workflow guide covering branch naming, promotion flow
    (`main → dev → uat → prod`), hotfix procedure, and branch protection settings
  - [`scripts/setup-branches.sh`](scripts/setup-branches.sh) automates creation and protection of
    `dev`, `uat`, and `prod` branches via the GitHub CLI

- **GLEIF Level 2 "who owns whom" data acquisition** — the scheduler now downloads and processes
  two additional GLEIF golden-copy datasets after each successful Level 1 (LEI records) full sync:
  - **Relationship Records (RR)** — directional ownership / consolidation relationships between
    legal entities (e.g. `IS_DIRECTLY_CONSOLIDATED_BY`, `IS_ULTIMATELY_CONSOLIDATED_BY`)
  - **Reporting Exceptions (REPEX)** — cases where an entity cannot disclose its parent, with the
    reason code (e.g. `NO_KNOWN_PERSON`, `NATURAL_PERSONS`)
  - New database tables: `lei_raw.lei_relationship_records` and `lei_raw.lei_reporting_exceptions`
    (migration `000025`)
  - New `LEILevel2Service` interface and implementation for download and upsert processing
  - New `LEILevel2Repository` for persistence with conflict-safe upserts
  - `SchedulerService.RunLevel2Sync()` implements the dependent-job pattern: Level 2 data is
    fetched and loaded only after the Level 1 sync completes successfully, ensuring all LEI codes
    referenced by Level 2 records already exist in the database

- **Explicit job dependency tracking** — the dependency chain between scheduler jobs is now stored
  in the database and used for smart recovery on startup (migration `000026`):
  - New `depends_on_job_type` column in `lei_raw.file_processing_status` records which parent job
    must succeed before a child job can run (`DAILY_FULL → LEVEL2_RR → LEVEL2_REPEX`)
  - Seeded rows for `LEVEL2_RR` and `LEVEL2_REPEX` ensure the full pipeline is visible in the
    status table from the very first migration run — no job rows appear "missing" until first run
  - On startup, `resumeFailedLevel2OnStartup()` inspects status rows and resumes from the earliest
    failed Level 2 step: if only REPEX failed the scheduler restarts from REPEX, skipping a
    redundant Level 1 or RR re-run; if RR failed the scheduler re-runs RR then REPEX
  - A stuck `RUNNING` job (process crashed mid-run) is now correctly reset to `FAILED` rather than
    `IDLE` so the recovery logic can distinguish an interrupted run from a clean stop

### Fixed

- `frontend/app/lei/page.tsx` — LEI sync trigger now reliably sends the stored JWT with normalized Bearer handling,
  preflight token validation, and clearer unauthorized-session handling
- `backend/internal/service/masterdata_service.go` — master data update checks now use real content fingerprinting
  instead of a no-op/stub result
- `docker-compose.main.yml` — backend service now bind-mounts `backend/data/masterdata` to ensure host-side master
  data changes are visible inside the running container
- `backend/internal/service/lei_level2_service_test.go` — added targeted checkpoint persistence unit tests for interval
  boundaries and forced progress updates to prevent regressions in SourceFile progress writes
- `backend/internal/service/masterdata_service_test.go` — added fingerprint stability and update detection tests covering
  unchanged content, modified files, and missing file errors
- `frontend/app/components/SortableHeaderCell.tsx` — sortable header button now sets `type="button"` and exposes
  sort state via `aria-sort` on the header cell for screen-reader compatibility
- `frontend/app/layout.tsx` and `frontend/app/page.tsx` — branding assets now resolve at runtime via committed
  `frontend/public/branding/*` SVG files, preventing favicon and logo 404s
- `frontend/app/home/page.tsx` — restored public `/home` route so landing-page navigation and post-login non-bootstrap
  redirects do not lead to 404

- `.github/workflows/lint.yml` — branch filter corrected from non-existent `develop` to `dev`,
  and extended to also run on `uat` and `prod` pushes and pull requests
- `.github/workflows/security-scan.yml` — branch filter corrected from `develop` to `dev`, `uat`,
  `prod`

### Deprecated

- `GET /api/v1/lei/level2/failures` is deprecated in favor of
  `GET /api/v1/lei/import-failures`.
- The deprecated endpoint remains temporarily available and now returns deprecation metadata headers
  (`Deprecation`, `Sunset`, `Link`, `Warning`) to guide client migration.
- Planned removal target: `v0.5` (tracking issue: `#87`).

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

[Unreleased]: https://github.com/techie2000/axiom/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/techie2000/axiom/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/techie2000/axiom/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/techie2000/axiom/releases/tag/v0.1.0
