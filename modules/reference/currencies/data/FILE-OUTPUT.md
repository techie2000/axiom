# File Output Feature - Quick Reference

## Overview

The csv2json service now supports three output modes per route:

| Mode | Description | Use Case |
|------|-------------|----------|
| `queue` | RabbitMQ only | Production domains with immediate canonicalizer processing |
| `file` | JSON file only | Testing/development to inspect transformed data offline |
| `both` | Queue + File | Development of new domains to verify data before canonicalizer |

## Configuration

In [routes.json](../../../csv2json/routes.json):

```json
{
  "output": {
    "type": "both",
    "queueDestination": "axiom.data.exchange",
    "fileDestination": "/app/data/reference/currencies/output",
    "addTimestampSuffix": true
  }
}
```

### Output Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| `type` | ✅ | Output destination: `queue`, `file`, or `both` |
| `queueDestination` | ⚠️ | RabbitMQ exchange name (required if type=queue/both) |
| `fileDestination` | ⚠️ | Absolute output folder path (required if type=file/both) |
| `addTimestampSuffix` | ❌ | Add ISO datetime to filenames (default: false) |

## Output Format

**JSON Array with Pretty-Printing**

```json
[
  {
    "domain": "reference",
    "entity": "currencies",
    "timestamp": "2026-01-27T15:32:29.843752015Z",
    "source": "csv2json",
    "contract": "reference.currencies.csv.v1",
    "payload": {
      "code": "USD",
      "name": "United States Dollar",
      "decimalPlaces": "2"
    }
  },
  {
    "domain": "reference",
    "entity": "currencies",
    ...
  }
]
```

- **Format**: JSON array with comma-separated objects
- **Indentation**: 2 spaces for readability
- **Content**: Complete message envelope (domain, entity, timestamp, source, contract, payload)

## Filename Patterns

**Without Timestamp** (`addTimestampSuffix: false`)

- Input: `countries.csv`
- Output: `countries.json`

**With Timestamp** (`addTimestampSuffix: true`)

- Input: `currencies.csv`
- Output: `currencies_20260127_153229.json`

Timestamp format: `YYYYMMDD_HHMMSS` (ISO 8601 compatible)

## Current Route Configuration

| Route | Type | Timestamp Suffix | Rationale |
|-------|------|------------------|-----------|
| countries | `queue` | No | Production-ready, canonicalizer processes immediately |
| currencies | `both` | **Yes** | Development - inspect raw data while building service |
| instruments | `queue` | No | Future production domain |

## Testing File Output

1. **Create test CSV** in domain's input folder
2. **Wait for processing** (event detection or 60s hybrid poll)
3. **Check output folder** for timestamped JSON file
4. **Verify archived** CSV in archive/processed/ folder
5. **Inspect JSON** to verify message envelope structure

### Example Test

```powershell
# Drop test file
Copy-Item currencies.csv -Destination modules\reference\currencies\data\input\

# Wait for processing (max 60 seconds for hybrid poll)
Start-Sleep -Seconds 65

# Check output
Get-ChildItem modules\reference\currencies\data\output\
# Expected: currencies_YYYYMMDD_HHMMSS.json

# Check archive
Get-ChildItem modules\reference\currencies\data\archive\processed\
# Expected: currencies_YYYYMMDD_HHMMSS.csv
```

## Log Messages

### Stdout/Docker Logs

The processing logs indicate output type:

```text
[currencies] ✓ Processed 5 rows from currencies.csv (output: both)
[countries] ✓ Processed 656 rows from countries.csv (output: queue)
[instruments] ✓ Processed 42 rows from instruments.csv (output: file)
```

### Route-Specific Log Files

When `ENABLE_FILE_LOGGING=true`, each route writes to its own log file in addition to stdout:

**Log Files:**
- `modules/reference/countries/data/logs/countries.log`
- `modules/reference/currencies/data/logs/currencies.log`
- `modules/reference/instruments/data/logs/instruments.log`

**Tailing Logs:**
```powershell
# Watch a specific route's log
Get-Content modules\reference\countries\data\logs\countries.log -Wait -Encoding UTF8

# Or on Linux/Mac
tail -f modules/reference/countries/data/logs/countries.log
```

**Note:** Log files are UTF-8 encoded. Use `-Encoding UTF8` in PowerShell to display checkmark characters (✓) correctly.

**Typical Log Output:**
```text
[countries] 2026/01/27 16:33:07 Processing file: countries.csv
[countries] 2026/01/27 16:33:07 Processed 100 rows...
[countries] 2026/01/27 16:33:07 Processed 200 rows...
[countries] 2026/01/27 16:33:08 ✓ Processed 656 rows from countries.csv (output: queue)
[countries] 2026/01/27 16:33:08 ✓ Successfully processed countries.csv
```

## Benefits

✅ **Visibility**: Inspect exact message format before canonicalizer processing  
✅ **Debugging**: Verify CSV-to-JSON transformation correctness  
✅ **Development**: Build downstream services with known-good test data  
✅ **Auditing**: File-based trail of all ingested records  
✅ **Flexibility**: Per-domain output configuration

## When to Use Each Mode

### Queue Only (`type: "queue"`)

- ✅ Production domains with stable canonicalizer
- ✅ High-volume ingestion (no disk I/O overhead)
- ✅ Real-time processing requirements

### File Only (`type: "file"`)

- ✅ Offline testing without RabbitMQ
- ✅ Manual inspection of transformed data
- ✅ Building canonicalizer for new domain

### Both (`type: "both"`)

- ✅ **Recommended for new domains**
- ✅ Developing canonicalizer logic
- ✅ Validating message contract compliance
- ✅ Transition phase before production

---

*Last updated: January 27, 2026*
