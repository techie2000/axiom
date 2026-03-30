# Axiom - Financial Services Static Data System

[![CI](https://github.com/techie2000/axiom/actions/workflows/ci.yml/badge.svg)](https://github.com/techie2000/axiom/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/techie2000/axiom/branch/main/graph/badge.svg)](https://codecov.io/gh/techie2000/axiom)

A modular monolith financial services static data management system built with Go, Next.js, and PostgreSQL.

## Overview

Axiom is a comprehensive financial services platform for managing static data including countries, currencies,
entities, financial instruments, accounts, and settlement instructions.

## Architecture

Architecture decisions are documented as ADRs in [docs/adr](docs/adr).

Architecture as Code pilot guidance is available in [docs/architecture-as-code](docs/architecture-as-code).

### Tech Stack

**Backend:**

- **Gin Framework** - Fast HTTP web framework for REST APIs
- **Fiber Framework** - Ultra-fast web framework for high-throughput services
- **GORM** - ORM for database operations
- **PostgreSQL** - Primary database
- **RabbitMQ** - Message queue for async operations
- **Beego** - Notification service framework

**Frontend:**

- **Next.js** - React framework for server-rendered applications
- **React** - UI component library
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - React UI components

**Features:**

- JWT Authentication
- CORS Configuration
- CQRS Pattern (Command Query Responsibility Segregation)
- Input Validation
- Error Handling Middleware
- Rate Limiting
- WebSocket Support
- Comprehensive Logging
- Prometheus Metrics
- Swagger API Documentation
- **Master Data Management** - Pre-populated countries, currencies, continents, and languages
- **LEI Data Acquisition** - Automated Legal Entity Identifier data acquisition from GLEIF
- **Daily Synchronization** - Automated daily sync for LEI and master data updates
- **Interrupted Sync Recovery** - Scheduler auto-resumes interrupted full LEI imports on service startup

## Project Structure

```text
axiom/
├── backend/
│   ├── cmd/                 # Application entry points
│   │   ├── api/             # Main API server (Gin)
│   │   ├── worker/          # Background worker (Fiber)
│   │   └── notification/    # Notification service (Beego)
│   ├── internal/            # Private application code
│   │   ├── domain/          # Domain models
│   │   ├── repository/      # Data access layer
│   │   ├── service/         # Business logic
│   │   ├── handler/         # HTTP handlers
│   │   ├── middleware/      # Custom middleware
│   │   ├── cqrs/            # CQRS implementation
│   │   └── config/          # Configuration
│   ├── pkg/                 # Public libraries
│   │   ├── auth/            # JWT authentication
│   │   ├── validator/       # Input validation
│   │   ├── logger/          # Logging utilities
│   │   └── queue/           # RabbitMQ client
│   ├── migrations/          # Database migrations
│   ├── docs/                # Swagger documentation
│   └── tests/               # Integration tests
├── frontend/
│   ├── app/                 # Next.js app directory
│   ├── components/          # React components
│   ├── lib/                 # Utilities
│   └── public/              # Static assets
├── docker/                  # Docker configurations
├── scripts/                 # Build and deployment scripts
└── docs/                    # Documentation
```

## Development Phases

### Phase 1: Data Acquisition and Storage

- Implement domain data models (Countries, Currencies, Entities, Instruments, Accounts, SSI's)
- Set up PostgreSQL schemas and migrations
- Create API endpoints for CRUD operations
- Implement data acquisition from third-party sources (CSV, XML, JSON)
- Set up RabbitMQ for async processing

### Phase 2: Scheduled Updates

- Implement scheduled jobs for data refresh
- Add change detection and tracking
- Create webhook endpoints for real-time updates

### Phase 3: Auditing

- Implement audit logging for all data changes
- Add audit trail UI
- Create reporting endpoints

### Phase 4 and Beyond

- Advanced analytics
- Data visualization
- Export capabilities
- API rate limiting by client
- Multi-tenancy support

## Getting Started

### Prerequisites

- Go 1.21+
- Node.js 18+
- PostgreSQL 17+
- RabbitMQ 4.2+
- Docker & Docker Compose

### Frontend Translation Automation

The frontend i18n workflow now includes automated key extraction and locale completeness validation.

```bash
cd frontend

# Extract keys used in app/**/*.ts(x) into public/locales/en/common.json
npm run i18n:extract

# Report non-English locale gaps against en/common.json (warnings only; English fallback is intentional)
npm run i18n:check

# CI command: extract + check + fail if generated English locale changes were not committed
npm run i18n:verify
```

When adding new `t('...')` keys, run `npm run i18n:extract` and commit the
resulting `en/common.json` changes. Non-English locale files may omit new keys
until translations are approved.

### Multi-Environment Support

Axiom supports running multiple environments simultaneously on the same machine. Each environment uses a unique port
prefix to avoid conflicts:

- **Main**: Port prefix 4 (e.g., 48080, 43000, 45432, 45173 for docs)
- **Development (dev)**: Port prefix 1 (e.g., 18080, 13000, 15432)
- **UAT**: Port prefix 2 (e.g., 28080, 23000, 25432)
- **Production (prod)**: Port prefix 3 (e.g., 38080, 33000, 35432)

#### Starting a Specific Environment

`make docker-dev-up` and `make docker-main-up` automatically run two setup steps before
`docker-compose up -d`:

1. **Bind-mount directory setup** (`scripts/ensure-bind-mounts.sh`) — creates `./data/{env}/postgres`,
   `./data/{env}/lei`, and `./log/{env}` if they do not exist. On Linux hosts the Postgres data
   directory is also `chown`-ed to UID 70:70
   (the `postgres` user inside `postgres:17-alpine`)
   via a temporary Docker container, so no `sudo` is required.
   On macOS and Windows, Docker Desktop manages volume ownership automatically
   and the `chown` step is skipped.
2. **PostgreSQL major-version precheck/upgrade** (`scripts/upgrade-postgres.sh`) —
   if the existing data was created by an older Postgres major version,
   the data is backed up and migrated automatically.

`make docker-dev-restart` and `make docker-main-restart` run the same steps before restarting.
`make docker-uat-up`, `make docker-prod-up`, and their restart counterparts
run only the Postgres upgrade precheck,
as those environments use Docker-managed named volumes (no chown needed).

```bash
# Start development environment
make docker-dev-up

# Start UAT environment
make docker-uat-up

# Start production environment
make docker-prod-up

# Start all environments simultaneously
make docker-all-up
```

### Safe Main-Branch Testing (Isolated Containers, Volumes, Ports, and Logs)

When testing PRs/worktrees against the `main` compose file, avoid reusing `.env.main` across multiple folders.
Use an isolated env file per test stack so each run gets its own container/volume names, host ports, and log
directory. LEI data (`./data/main/lei`) is intentionally shared across stacks so cached data does not have to
be re-downloaded for each test run.

```bash
# Create an isolated env (example: pr107)
./scripts/new-main-test-env.ps1 -Name pr107

# Start isolated main-like stack
docker compose --env-file .env.main.pr107 -f docker-compose.main.yml up -d --build

# Stop isolated stack (non-destructive)
docker compose --env-file .env.main.pr107 -f docker-compose.main.yml down
```

Important:

- Avoid `down -v` on shared/long-lived stacks unless you intentionally want to remove data.
- Keep `.env.main` for your primary main environment; use `.env.main.<suffix>` for temporary test stacks.

### Main PostgreSQL Backup Script

Create a timestamped backup from the running main Postgres container before risky operations:

```bash
# Custom format backup (recommended)
./scripts/backup-main-postgres.ps1

# Plain SQL backup
./scripts/backup-main-postgres.ps1 -Format plain
```

Backups are saved under `backups/main/postgres/` by default.

#### Stopping Environments

```bash
# Stop development environment
make docker-dev-down

# Stop UAT environment
make docker-uat-down

# Stop production environment
make docker-prod-down

# Stop all environments
make docker-all-down
```

#### Checking Environment Status

```bash
# View status of all environments
make docker-all-status

# View logs for specific environment
make docker-dev-logs    # Development
make docker-uat-logs    # UAT
make docker-prod-logs   # Production
```

#### API Smoke Testing

Use the PowerShell smoke test script to quickly validate API health and auth behavior across environments.

If `make` is not installed (common on Windows PowerShell), use `./scripts/smoke-api.ps1` or `scripts\smoke-api.cmd`.

```bash
# Run smoke tests for all environments (dev, uat, prod)
./scripts/smoke-api.ps1

# Same via Makefile shortcut
make smoke-api

# Run only UAT
./scripts/smoke-api.ps1 -Environment uat

# Makefile variant
make smoke-api env=uat

# Include login endpoint check (informational)
./scripts/smoke-api.ps1 -Environment prod -CheckLogin

# Wait longer for API readiness during startup/migrations
./scripts/smoke-api.ps1 -Environment dev -StartupWaitSec 120

# Makefile variant with startup wait override
make smoke-api env=dev startup_wait=120

# Makefile variant
make smoke-api env=prod check_login=1

# Windows CMD wrapper (for environments without make)
scripts\smoke-api.cmd
scripts\smoke-api.cmd uat
scripts\smoke-api.cmd prod --check-login
```

The script validates:

- `GET /health` returns `200` and `healthy`
- `GET /version` returns `200`
- Protected endpoint (`/api/v1/entities`) without token returns `401`
- Protected endpoint (`/api/v1/entities`) with generated JWT is accepted by auth middleware (not `401`/`403`)

The script waits for `/health` before running checks (default max wait: 90 seconds).

#### SSI API Smoke Testing

Use the SSI smoke script to verify the `/api/v1/ssis` response contract used by the SSI page.

```bash
# Contract check only (no data mutation)
./scripts/smoke-ssi.ps1 -Environment dev
make smoke-ssi env=dev

# Full check with temporary smoke rows, then cleanup
./scripts/smoke-ssi.ps1 -Environment dev -SeedSmokeData -CleanupSmokeData
make smoke-ssi env=dev seed=1 cleanup=1

# UAT/PROD endpoint checks
./scripts/smoke-ssi.ps1 -Environment uat
./scripts/smoke-ssi.ps1 -Environment prod

# Windows CMD wrapper
scripts\smoke-ssi.cmd
scripts\smoke-ssi.cmd uat
scripts\smoke-ssi.cmd dev --seed --cleanup
```

The script validates:

- `/api/v1/ssis` returns `200` with JWT auth
- expected UI fields exist:
  `id`, `ssi_reference`, `counterparty_name`, `account_name`, `country_code`, `currency`,
  `bic`, `iban`, `settlement_method`, `status`, `updated_at`
- no `BGC` text appears in `counterparty_name`/`account_name`

#### Translation Stale-Row Cleanup

To keep UI translation rows aligned with active locale keys (cold-start source), run:

```bash
# Preview stale rows without deleting
make cleanup-stale-translations api=http://localhost:18080 token=<ADMIN_JWT> whatif=1

# Delete stale rows
make cleanup-stale-translations api=http://localhost:18080 token=<ADMIN_JWT>
```

PowerShell direct usage:

```powershell
./scripts/cleanup-stale-translations.ps1 -ApiBaseUrl http://localhost:18080 -BearerToken <ADMIN_JWT> -WhatIf
./scripts/cleanup-stale-translations.ps1 -ApiBaseUrl http://localhost:18080 -BearerToken <ADMIN_JWT>
```

Recommended daily automation:

1. Remove obsolete keys from `frontend/public/locales/en/common.json`.
2. Run stale-row cleanup daily (Task Scheduler/cron).
3. Keep locale files in source control as the cold-start key source of truth.

This ensures rows removed from the active locale key set are also removed from `ui_translations`.

#### Environment-Specific URLs

Once started, each environment is accessible at:

**Main Environment:**

- Frontend: http://localhost:43000
- Backend API: http://localhost:48080
- Swagger UI: http://localhost:48080/swagger/index.html
- PostgreSQL: localhost:45432
- RabbitMQ Management: http://localhost:45673
- User Docs (optional profile): http://localhost:45173/docs-user/

**Development Environment:**

- Frontend: http://localhost:13000
- Backend API: http://localhost:18080
- Swagger UI: http://localhost:18080/swagger/index.html
- PostgreSQL: localhost:15432
- RabbitMQ Management: http://localhost:15673
- User Docs (optional profile): http://localhost:15173/docs-user/

**UAT Environment:**

- Frontend: http://localhost:23000
- Backend API: http://localhost:28080
- Swagger UI: http://localhost:28080/swagger/index.html
- PostgreSQL: localhost:25432
- RabbitMQ Management: http://localhost:25673

**Production Environment:**

- Frontend: http://localhost:33000
- Backend API: http://localhost:38080
- Swagger UI: http://localhost:38080/swagger/index.html
- PostgreSQL: localhost:35432
- RabbitMQ Management: http://localhost:35673

### Hot Reload for Frontend Development

The development environment (`docker-compose.dev.yml`) includes hot reload for the frontend:

**Features:**

- ✅ Instant code changes (no rebuild required)
- ✅ Next.js development mode with Fast Refresh
- ✅ Source code mounted as volume
- ✅ Native Next.js development workflow

**Configuration:**

```yaml
volumes:
  - ./frontend:/app          # Mount source code
  - /app/node_modules        # Preserve dependencies
  - /app/.next               # Preserve build cache
command: npm run dev         # Development mode
```

**Benefits:**

- Frontend changes appear instantly in browser
- No 2-3 minute Docker rebuild cycle
- Standard Next.js hot module replacement (HMR)
- Ideal for active frontend development

**Note:** Backend still requires rebuild for Go code changes. For backend hot reload, consider using `air`
(Go live reload tool).

### Local Development with Docker Compose (Legacy)

```bash
# Start all services
docker-compose up -d

# Run migrations
make migrate-up

# Start backend
cd backend
go run cmd/api/main.go

# Start frontend (in another terminal)
cd frontend
npm install
npm run dev
```

### Running Database Migrations

```bash
# Run migrations on development environment
make migrate-dev-up

# Run migrations on UAT environment
make migrate-uat-up

# Run migrations on production environment
make migrate-prod-up

# Rollback migrations on specific environment
make migrate-dev-down
make migrate-uat-down
make migrate-prod-down
```

On Windows (without `make`), use the PowerShell helper:

```powershell
# Run migrations
./scripts/migrate-env.ps1 -Environment dev -Direction up
./scripts/migrate-env.ps1 -Environment uat -Direction up
./scripts/migrate-env.ps1 -Environment prod -Direction up

# Roll back one migration
./scripts/migrate-env.ps1 -Environment dev -Direction down

# Force migration version
./scripts/migrate-env.ps1 -Environment uat -Direction force -ForceVersion 17
```

### Upgrading PostgreSQL

When the PostgreSQL major version changes (e.g. v15 → v17), Docker cannot reuse the existing data volume
as-is — a data migration is required. The `upgrade-postgres` scripts handle this automatically:

1. Detect the PostgreSQL version stored in the existing volume
2. Back up all databases to `./backups/` with a timestamped filename
3. Remove the old volume
4. Start the new PostgreSQL container (which initialises a fresh volume)
5. Restore the backup

**Linux / macOS:**

```bash
# Upgrade development environment
make pg-upgrade-dev

# Or call the script directly
bash scripts/upgrade-postgres.sh dev

# Upgrade without confirmation prompt (CI/CD)
bash scripts/upgrade-postgres.sh prod --yes
```

**Windows (PowerShell):**

```powershell
.\scripts\upgrade-postgres.ps1 -Environment dev
.\scripts\upgrade-postgres.ps1 -Environment prod -Yes
```

If the volume does not exist yet (fresh install) the scripts exit immediately — no action needed.
The backup file is retained in `./backups/` after the migration completes.

### Running Tests

```bash
# Backend tests
cd backend
go test ./...

# Frontend tests
cd frontend
npm test

# Frontend tests with coverage report (enforces ≥ 50% line coverage)
cd frontend
npm run test:coverage
```

Coverage is reported to [Codecov](https://codecov.io/gh/techie2000/axiom) on every CI run.
The coverage badge at the top of this file reflects the latest `main` branch result.

## API Documentation

API documentation is available via Swagger UI at:

- Development: http://localhost:18080/swagger/index.html
- UAT: http://localhost:28080/swagger/index.html
- Production: http://localhost:38080/swagger/index.html
- Legacy/Local: http://localhost:8080/swagger/index.html

TODO: Replace the production Swagger URL with the confirmed production base URL.

### API Deprecation Notice

- Preferred endpoint for import processing failures: `GET /api/v1/lei/import-failures`
- Deprecated endpoint (still available temporarily): `GET /api/v1/lei/level2/failures`
- Legacy endpoint now returns deprecation metadata headers (`Deprecation`, `Sunset`, `Link`, `Warning`)
- Planned removal target: `v0.5` (tracked in GitHub issue `#87`)

## Configuration

Configuration is managed through environment variables and config files:

```yaml
# config/config.yaml
database:
  host: localhost
  port: 5432
  name: axiom
  user: axiom
  password: ${DB_PASSWORD}
  loglevel: warn  # silent, error, warn, info

rabbitmq:
  url: amqp://guest:guest@localhost:5672/

jwt:
  secret: ${JWT_SECRET}
  expiry: 24h

lei:
  datadir: ./data/lei
  deltasyncinterval: 1h      # How often to sync delta files
  fullsyncday: Sunday         # Day for full sync
  fullsynctime: "02:00"       # Time for full sync (HH:MM)
  cleanuptime: "03:00"        # Time for file cleanup (HH:MM)
  keepfullfiles: 2            # Retain last N full files (~1.8GB)
  keepdeltafiles: 5           # Retain last N delta files (~65MB)

server:
  port: 8080
  cors:
    allowed_origins:
      - http://localhost:3000
```

**Environment Variables:** All config values can be set via environment variables using uppercase with underscores
(e.g., `DATABASE_LOGLEVEL`, `LEI_DELTA_SYNC_INTERVAL`).

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `LOG_FILE_PATH` | *(unset)* | Log file path. Unset = stdout only. `.env.*` files set this per environment. |
| `LOG_MAX_SIZE_MB` | `10` | Max log file size in MB before rotation. |
| `LOG_MAX_BACKUPS` | `3` | Max number of rotated log files to retain. |
| `LOG_MAX_AGE_DAYS` | `7` | Max age in days for rotated log files. |
| `LOG_COMPRESS` | `false` | Compress rotated log files with gzip (`true`/`false`). |

Retention defaults apply only when `LOG_FILE_PATH` is set. The `.env.*` files in this repo set
environment-appropriate values (dev: 10 MB / 3 files / 7 days; uat: 25 MB / 5 / 14 days;
prod: 50 MB / 10 files / 30 days).

See [LEI Configuration](docs/lei/LEI_ACQUISITION.md#environment-variables) for detailed scheduler options.

## Performance Optimization

- PostgreSQL caching for frequently accessed data
- Database query optimization with proper indexing
- Connection pooling for database connections
- Horizontal scaling with stateless services
- Request monitoring with Prometheus
- Structured logging with request tracing

## Security

- JWT-based authentication
- CORS configuration
- Input validation on all endpoints
- SQL injection prevention via ORM
- Rate limiting to prevent abuse
- Error messages don't expose sensitive information

## Code Quality & Linting

### Markdown Documentation

All markdown files are validated against style rules to ensure consistency and readability:

```bash
# Check markdown files for linting issues
make lint-docs

# Auto-fix markdown issues (where possible)
make lint-docs-fix

# Run all linters (Go + Markdown)
make lint-all
```

**Git Hooks (pre-commit and pre-push):**

Install git hooks to automatically run quality checks on every commit and push:

```bash
make install-hooks
```

The hooks validate markdown linting, VS Code settings sort order, and more.
See [.githooks/README.md](.githooks/README.md) for the full list of checks and requirements.

### Go Code

```bash
# Lint Go code
make lint

# Format Go code
make fmt
```

## Contributing

Please read [CONTRIBUTING.md](docs/CONTRIBUTING.md) for details on our development workflow and code of conduct.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## User Documentation

End-user and operations documentation is available in [`docs-user/`](docs-user/README.md),
powered by VitePress. This covers workflows, admin tasks, reference data, and troubleshooting
written for non-engineering audiences.

Published site: <https://techie2000.github.io/axiom/docs-user/>

**Getting Started:**

- [Sign In & Access](docs-user/getting-started/sign-in-and-access.md)
- [Navigation Basics](docs-user/getting-started/navigation-basics.md)

**Core Workflows:**

- [LEI Records](docs-user/workflows/lei-records.md)
- [Countries](docs-user/workflows/countries.md)
- [Currencies](docs-user/workflows/currencies.md)
- [Languages](docs-user/workflows/languages.md)
- [Entities](docs-user/workflows/entities.md)
- [Settlement Instructions (SSI)](docs-user/workflows/ssi.md)

**Admin Workflows:**

- [User Approvals](docs-user/admin/user-approvals.md)
- [Translation Review](docs-user/admin/translation-review.md)
- [Sync Triggers](docs-user/admin/sync-triggers.md)

**Reference:**

- [Data Dictionary](docs-user/reference/data-dictionary.md)
- [Statuses & States](docs-user/reference/statuses-and-states.md)
- [Permissions & Roles](docs-user/reference/permissions-and-roles.md)

To preview the user documentation site locally:

```bash
make docs-user-dev
```

To build and validate the site:

```bash
make docs-user-check
```

## Documentation

Detailed documentation is available in the `docs/` directory:

- [Architecture Overview](docs/architecture.md)
- [Architecture Decision Records](docs/adr)
- [API Reference](docs/api-reference.md)
- [Database Schema](docs/database-schema.md)
- [Deployment Guide](docs/deployment.md)
- [Development Workflow](docs/development-workflow.md)

**LEI Operations:**

- [LEI Acquisition Guide](docs/lei/LEI_ACQUISITION.md)
- [LEI Quick Start](docs/lei/LEI_QUICKSTART.md)

Manual LEI sync endpoints (master data, full, delta, Level 2, RR, REPEX) and
their dependency-aware conflict behavior (`202 Accepted` / `409 Conflict`) are
documented in the LEI guides above.

**Multi-Environment Setup:**

- [Multi-Environment Setup Guide](docs/environments/multi-environment-setup.md)
- [Quick Start Guide](docs/environments/multi-environment-quickstart.md)
- [Port Reference](docs/environments/environment-port-reference.md)
