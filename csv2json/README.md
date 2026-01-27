# csv2json - Format-Only CSV to JSON Converter

## Purpose

Converts CSV files to JSON messages and publishes them to RabbitMQ. This is a **format-only** converter - it performs NO data transformation or validation. All business rules are handled by the canonicalizer service.

## Philosophy

> "Transform the **format**, not the **data**"

csv2json's job is to:

- ✅ Read CSV files
- ✅ Convert rows to JSON objects
- ✅ Wrap in message envelope
- ✅ Publish to RabbitMQ

csv2json does NOT:

- ❌ Validate data
- ❌ Transform values
- ❌ Apply business rules
- ❌ Clean or normalize data

## Usage

### Command Line

```bash
csv2json --input countries.csv --domain reference --entity countries
```

### Docker

```bash
docker build -t csv2json .
docker run csv2json \
  --input /data/countries.csv \
  --domain reference \
  --entity countries \
  --rabbitmq-url "amqp://user:pass@rabbitmq:5672/vhost"
```

### Docker Compose

```yaml
csv2json:
  build: ./csv2json
  volumes:
    - ./data:/data:ro
  command: ["--input", "/data/countries.csv", "--domain", "reference", "--entity", "countries"]
```

## Message Format

### Input CSV

```csv
English short name,French short name,Alpha-2 code,Alpha-3 code,Numeric
Afghanistan,Afghanistan (l'),af,afg,4
```

### Output JSON

```json
{
  "domain": "reference",
  "entity": "countries",
  "timestamp": "2026-01-26T10:30:00Z",
  "source": "csv2json",
  "payload": {
    "English short name": "Afghanistan",
    "French short name": "Afghanistan (l')",
    "Alpha-2 code": "af",
    "Alpha-3 code": "afg",
    "Numeric": "4"
  }
}
```

**Note**: Values are stored **exactly as-is** from CSV:

- `"Alpha-2 code": "af"` (lowercase, not transformed to "AF")
- `"Numeric": "4"` (not padded to "004")

The canonicalizer service handles all transformations.

## Configuration

### Environment Variables

- `RABBITMQ_URL` - RabbitMQ connection URL (default: `amqp://axiom:changeme@localhost:5672/axiom`)
- `RABBITMQ_EXCHANGE` - Exchange name (default: `axiom.data.exchange`)

### Command Line Flags

- `--input, -i` - Input CSV file path (required)
- `--domain, -d` - Domain name (e.g., "reference") (required)
- `--entity, -e` - Entity name (e.g., "countries") (required)
- `--rabbitmq-url` - RabbitMQ connection URL
- `--exchange` - RabbitMQ exchange name

## Building

```bash
go build -o csv2json .
```

## Testing

```bash
# Process local CSV file
./csv2json --input ../modules/reference/countries/data/countries.csv \
  --domain reference \
  --entity countries

# Check messages in RabbitMQ
rabbitmqadmin list queues -f long
```

## Architecture

```mermaid
flowchart TD
    A[CSV File] --> B[csv2json]
    B -->|Format conversion only| C[MessageEnvelope]
    C --> D[RabbitMQ Exchange<br/>axiom.data.exchange]
    D --> E[Queue<br/>axiom.reference.countries]
    E --> F[canonicalizer<br/>applies business rules]
    
    style B fill:#e1f5ff
    style C fill:#fff3e0
    style D fill:#f3e5f5
    style E fill:#f3e5f5
    style F fill:#e8f5e9
```

## Routing

Messages are published with routing key: `{domain}.{entity}`

- Example: `reference.countries`

This allows flexible queue binding based on domain and entity type.

## Error Handling

- Invalid CSV format → Exits with error
- RabbitMQ connection failure → Exits with error
- Publish failure → Exits with error

csv2json is designed to be run as a one-shot job (processes file and exits).

## Extending

To add support for new data sources:

1. Create new CSV file
2. Run csv2json with appropriate domain/entity
3. Canonicalizer will handle transformation based on domain/entity

No changes to csv2json needed!

## Related Services

- **canonicalizer** - Applies transformation rules and business logic
- **countries module** - Contains transformation logic (`internal/transform`)

## License

Part of the Axiom project.
