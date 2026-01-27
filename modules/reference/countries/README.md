# axiom.reference.countries

Foundational reference data module for country information.

## Overview
This module is the **first priority** in the Axiom reference data hierarchy. It must be implemented before:
- `axiom.reference.currencies` (currencies are associated with countries)
- `axiom.reference.accounts` (accounts have country associations)
- `axiom.reference.instruments` (instruments reference countries and currencies)

## Data Flow
```
RabbitMQ (axiom.reference.countries queue) → Canonicalizer → PostgreSQL (axiom_db.reference.countries)
```

## Database Schema
PostgreSQL schema: `reference`
Table: `countries`

Typical fields:
- `code` (ISO 3166-1 alpha-2): Primary identifier (e.g., "US", "GB")
- `name`: Full country name
- `alpha3` (ISO 3166-1 alpha-3): Three-letter code (e.g., "USA", "GBR")
- `numeric`: ISO numeric code
- `created_at`, `updated_at`: Audit timestamps

## Configuration
Set via environment variables (`.env` file):
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=axiom_db
DB_SCHEMA=reference
DB_USER=axiom
DB_PASSWORD=<secure-password>
DB_SSLMODE=prefer

# RabbitMQ
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=axiom
RABBITMQ_PASSWORD=<secure-password>
RABBITMQ_VHOST=/axiom
RABBITMQ_QUEUE=axiom.reference.countries
```

## Development
```bash
# Run tests
go test ./...

# Build
go build ./cmd/countries

# Run locally
go run ./cmd/countries
```

## Dependencies
- PostgreSQL 15+
- RabbitMQ 3.12+
- Go 1.21+
