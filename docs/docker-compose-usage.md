# Docker Compose Configuration Options

The `docker-compose.yml` file supports different deployment modes depending on your needs.

## Full Pipeline Mode (Default)

Includes all services: csv2json → RabbitMQ → canonicalizer → PostgreSQL

```powershell
docker-compose up -d
```

**Prerequisites**:

- csv2json repository at `../csv2json/` with Dockerfile
- canonicalizer repository at `../canonicalizer/` with Dockerfile

## Infrastructure Only Mode

If you're running csv2json, canonicalizer, or countries service locally in Go:

```powershell
# Start only PostgreSQL and RabbitMQ
docker-compose up -d postgres rabbitmq
```

Then run services locally:

```powershell
# Terminal 1: Run canonicalizer
cd ..\canonicalizer
go run cmd\canonicalizer\main.go

# Terminal 2: Run countries service
cd modules\reference\countries
go run cmd\countries\main.go

# Terminal 3: Process CSV with csv2json
cd ..\csv2json
go run cmd\csv2json\main.go --input ../axiom/modules/reference/countries/data/countries.csv --domain reference --entity countries
```

## Adjusting Paths

If your csv2json or canonicalizer repos are in different locations, update `docker-compose.yml`:

```yaml
csv2json:
  build:
    context: /path/to/your/csv2json  # Change this
    
canonicalizer:
  build:
    context: /path/to/your/canonicalizer  # Change this
```

Or use environment variables:

```powershell
$env:CSV2JSON_PATH = "C:\projects\csv2json"
$env:CANONICALIZER_PATH = "C:\projects\canonicalizer"
docker-compose up -d
```

## Service Dependencies

```
postgres ← canonicalizer ← countries service
   ↑            ↑
rabbitmq ←── csv2json
```

All services are on a shared `axiom-network` for inter-service communication.
