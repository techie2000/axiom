# Axiom

Single source of truth for enterprise reference data and operational data.

## Overview

Axiom is a modular data management system built with Go, providing authoritative reference data (countries, currencies, accounts, instruments) and operational data (trades, settlements, allocations) across financial domains.

## Architecture

### Data Ingestion Pipeline

```
CSV files → csv2json → RabbitMQ → canonicalizer → PostgreSQL (Axiom modules)
```

### Domain Structure

```
axiom/
├── modules/
│   ├── reference/          # Reference data (countries, currencies, accounts, instruments)
│   ├── trading/            # Trading operations (trades, allocations, confirmations)
│   └── settlement/         # Settlement operations (instructions, messages, movements)
├── csv2json/              # CSV to JSON conversion utility
└── canonicalizer/         # Data standardization service
```

## Technology Stack

- **Language**: Go 1.21+
- **Database**: PostgreSQL 15+ (schema-based isolation)
- **Message Queue**: RabbitMQ 3.12+
- **Architecture**: Monorepo with Go workspaces

## Getting Started

### Prerequisites

- Go 1.21 or higher
- PostgreSQL 15+
- RabbitMQ 3.12+

### Clone Repository

```bash
git clone https://github.com/techie2000/axiom.git
cd axiom
```

### Build All Modules

```bash
go build ./...
```

### Run Tests

```bash
go test ./...
```

## Module Development

### Current Status

🚧 **In Development**: `modules/reference/countries` (foundation module)

### Dependency Chain

```
countries → currencies → accounts → instruments
```

**Critical**: Always implement modules in dependency order.

### Creating a New Module

1. Create module directory: `modules/[domain]/[entity]/`
2. Initialize Go module: `cd modules/[domain]/[entity] && go mod init`
3. Update workspace: Add to `go.work`
4. Follow structure from `modules/reference/countries/`

## Configuration

All services use environment variables via `.env` files:

- Database connection (PostgreSQL)
- RabbitMQ connection
- Service-specific settings

See `.env.example` in each module directory.

## Documentation

- **Architecture Decisions**: [docs/adrs/](docs/adrs/)
- **AI Agent Instructions**: [.github/copilot-instructions.md](.github/copilot-instructions.md)

## Domain Modules

### Reference Data

- ✅ `countries` - ISO 3166-1 country data (in development)
- 📋 `currencies` - ISO 4217 currency data (planned)
- 📋 `accounts` - Account reference data (planned)
- 📋 `instruments` - Financial instrument data (planned)

### Trading

- 📋 `trades` - Trade capture (planned)
- 📋 `allocations` - Trade allocations (planned)
- 📋 `confirmations` - Trade confirmations (planned)

### Settlement

- 📋 `instructions` - Settlement instructions (planned)
- 📋 `messages` - Settlement messaging (planned)
- 📋 `cashMovements` - Cash movements (planned)
- 📋 `stockMovements` - Stock movements (planned)

## Contributing

1. Check dependency chain before creating modules
2. Follow Go standard project layout
3. Add tests for all business logic
4. Update documentation and ADRs for architectural changes

## License

[Your License Here]
