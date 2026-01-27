# End-to-End Pipeline Testing

Complete guide for testing the Axiom data pipeline from CSV to PostgreSQL.

## Pipeline Overview

```
CSV File (countries.csv)
  ↓
csv2json (format converter)
  ↓
RabbitMQ (message queue)
  ↓
canonicalizer (business rules engine)
  ↓
PostgreSQL (canonical data store)
```

## Quick Start

```powershell
# Full automated test
.\scripts\test-e2e-pipeline.ps1

# With clean start
.\scripts\test-e2e-pipeline.ps1 -Clean

# Skip Docker build (faster iterations)
.\scripts\test-e2e-pipeline.ps1 -SkipBuild
```

## What Gets Tested

### 1. Service Build

- ✅ csv2json compiles
- ✅ canonicalizer compiles
- ✅ Docker images build successfully

### 2. Infrastructure

- ✅ PostgreSQL starts and becomes healthy
- ✅ RabbitMQ starts and becomes healthy
- ✅ Database migrations run successfully

### 3. Data Pipeline

- ✅ csv2json reads CSV file
- ✅ Messages published to RabbitMQ
- ✅ canonicalizer consumes messages
- ✅ Data written to PostgreSQL

### 4. Transformation Rules

- ✅ Numeric padding: `"4"` → `"004"`
- ✅ Code uppercase: `"af"` → `"AF"`
- ✅ Status normalization: correctly stored
- ✅ All required fields present

## Manual Testing

### Step 1: Start Infrastructure

```powershell
docker-compose up -d postgres rabbitmq

# Wait for health
docker ps
```

### Step 2: Run Migrations

```powershell
docker exec -i axiom-postgres psql -U axiom -d axiom_db `
  < modules/reference/countries/migrations/001_create_countries_table.up.sql
```

### Step 3: Run csv2json

```powershell
docker-compose build csv2json
docker-compose up csv2json
```

**Expected output:**

```
csv2json starting: /data/countries.csv -> reference.countries
CSV headers: [English short name, French short name, Alpha-2 code, ...]
✓ Successfully processed 25 rows from /data/countries.csv
```

### Step 4: Verify Messages in RabbitMQ

```powershell
# Check queue
docker exec axiom-rabbitmq rabbitmqctl list_queues -p /axiom

# Or use Management UI
# http://localhost:15672 (axiom/changeme)
```

### Step 5: Run canonicalizer

```powershell
docker-compose build canonicalizer
docker-compose up -d canonicalizer

# Watch logs
docker-compose logs -f canonicalizer
```

**Expected output:**

```
Canonicalizer starting...
✓ Connected to PostgreSQL
✓ Connected to RabbitMQ
✓ Queue 'axiom.reference.countries' bound...
✓ Canonicalizer ready - waiting for messages...
✓ Processed: AF (Afghanistan)
✓ Processed: AL (Albania)
...
```

### Step 6: Verify Data in PostgreSQL

```powershell
# Count records
docker exec -i axiom-postgres psql -U axiom -d axiom_db -c `
  "SELECT COUNT(*) FROM reference.countries;"

# View sample data
docker exec -i axiom-postgres psql -U axiom -d axiom_db -c `
  "SELECT alpha2, alpha3, numeric, name_english, status FROM reference.countries LIMIT 5;"

# Check specific transformations
docker exec -i axiom-postgres psql -U axiom -d axiom_db -c `
  "SELECT alpha2, numeric FROM reference.countries WHERE alpha2 = 'AF';"
```

**Expected:**

```
 alpha2 | numeric 
--------+---------
 AF     | 004
```

## Verification Checklist

### ✅ Format Transformation

- [ ] Numeric codes padded to 3 digits (`"4"` → `"004"`)
- [ ] Country codes uppercase (`"af"` → `"AF"`)
- [ ] Whitespace trimmed
- [ ] Status normalized (`"officially assigned"` → `"officially_assigned"`)

### ✅ Data Integrity

- [ ] All required fields present
- [ ] No null values in required columns
- [ ] Enum types correctly stored
- [ ] Timestamps populated

### ✅ Database Constraints

- [ ] Primary key (alpha2) enforced
- [ ] Unique constraints (alpha3, numeric) enforced
- [ ] CHECK constraints pass (uppercase, numeric format)
- [ ] Indexes created

## Troubleshooting

### csv2json Fails

```powershell
# Check CSV file exists
ls modules/reference/countries/data/countries.csv

# Check file format
Get-Content modules/reference/countries/data/countries.csv -Head 5

# Check RabbitMQ connectivity
docker exec axiom-rabbitmq rabbitmq-diagnostics ping
```

### canonicalizer Not Processing

```powershell
# Check logs
docker-compose logs canonicalizer

# Check queue bindings
docker exec axiom-rabbitmq rabbitmqctl list_bindings -p /axiom

# Check if messages are in queue
docker exec axiom-rabbitmq rabbitmqctl list_queues -p /axiom
```

### No Data in PostgreSQL

```powershell
# Check canonicalizer logs for errors
docker-compose logs canonicalizer | Select-String "Failed"

# Check database connection
docker exec -i axiom-postgres psql -U axiom -d axiom_db -c "\dt reference.*"

# Check for rejected messages
docker exec axiom-rabbitmq rabbitmqctl list_queues -p /axiom | Select-String "dlq"
```

### Data Not Transformed

This should not happen! If you see:

- Numeric code `"4"` instead of `"004"`
- Lowercase codes `"af"` instead of `"AF"`

Check:

1. Is canonicalizer using `transform.TransformToCountry()`?
2. Are tests passing? `go test ./internal/transform -v`
3. Are there errors in canonicalizer logs?

## Performance Testing

### Measure Processing Time

```powershell
# Time csv2json
Measure-Command { docker-compose up csv2json }

# Count messages per second (canonicalizer logs)
docker-compose logs canonicalizer | Select-String "Processed:"
```

### Stress Test

```powershell
# Create larger CSV file (repeat countries)
1..100 | ForEach-Object {
    Get-Content modules/reference/countries/data/countries.csv | Select-Object -Skip 1
} | Out-File -FilePath large-test.csv

# Run with larger file
docker-compose run csv2json --input /data/large-test.csv --domain reference --entity countries
```

## CI/CD Integration

The end-to-end test runs automatically on:

- Push to `main` or `develop`
- Pull requests
- Changes to:
  - `modules/reference/countries/**`
  - `csv2json/**`
  - `canonicalizer/**`

See [.github/workflows/test-countries.yml](../.github/workflows/test-countries.yml)

## Test Data

### countries.csv

- 25 ISO 3166-1 countries
- Mix of officially assigned and formerly used
- Various numeric code formats (1-digit, 2-digit, 3-digit)
- Tests all transformation rules

### Custom Test Data

Create your own test CSV:

```csv
English short name,French short name,Alpha-2 code,Alpha-3 code,Numeric,status
Test Country,Pays Test,TS,TST,999,officially_assigned
```

## Clean Up

```powershell
# Stop all services
docker-compose down

# Remove volumes (complete clean)
docker-compose down -v

# Remove images
docker rmi axiom-csv2json axiom-canonicalizer
```

## Next Steps

After successful end-to-end test:

1. Add more countries to CSV
2. Test with invalid data (should be rejected)
3. Add new entities (currencies, accounts)
4. Monitor performance with larger datasets

## Related Documentation

- [csv2json README](../csv2json/README.md) - Format converter details
- [canonicalizer README](../canonicalizer/README.md) - Transformation engine details
- [TEST-SUMMARY.md](../modules/reference/countries/TEST-SUMMARY.md) - Transformation rules
- [docker-compose.yml](../docker-compose.yml) - Infrastructure configuration
