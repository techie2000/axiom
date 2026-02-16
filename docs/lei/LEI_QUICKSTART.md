# LEI Data Acquisition - Quick Start Guide

## Overview

The LEI (Legal Entity Identifier) acquisition system downloads and processes LEI data from GLEIF
(Global Legal Entity Identifier Foundation) automatically. The **scheduler runs as part of the backend service**
(not a separate container) and handles:

- Daily delta file downloads (weekly changes)
- Full golden copy downloads (configurable schedule)
- Automatic change detection and audit trail creation

Downloaded files are stored in `./data/lei/` (excluded from git).

## Prerequisites

- PostgreSQL database
- Go 1.21+
- Axiom backend running
- ~14 MB for delta files, ~900 MB for full golden copy

## Setup

### 1. Run Database Migrations

Apply the LEI schema migration:

```bash
cd backend
# Using golang-migrate
migrate -path ./migrations -database "postgres://user:password@localhost:5432/axiom?sslmode=disable" up

# Or using make (if configured)
make migrate-up
```

This creates the following tables in the `lei_raw` schema:

- `lei_raw.lei_records`
- `lei_raw.lei_records_audit`
- `lei_raw.source_files`
- `lei_raw.file_processing_status`

### 2. Verify Migration

Check that tables were created:

```sql
\c axiom
\dt lei_raw.*
```

Expected output:

```text
             List of relations
  Schema  |         Name          | Type  | Owner
----------+-----------------------+-------+-------
 lei_raw  | file_processing_status| table | axiom
 lei_raw  | lei_records           | table | axiom
 lei_raw  | lei_records_audit     | table | axiom
 lei_raw  | source_files          | table | axiom
```

### 3. Start the Application

The LEI scheduler starts automatically when the backend starts:

```bash
cd backend
go run cmd/api/main.go
```

You should see log messages:

```text
INFO Starting LEI scheduler service
INFO Scheduled next full sync next_run=2026-02-16T02:00:00Z
INFO Starting daily delta sync
```

### 4. Initial Data Load (Optional)

Manually trigger a full sync to download and process the initial dataset:

```bash
# Get JWT token first
TOKEN=$(curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.token')

# Trigger full sync
curl -X POST http://localhost:8080/api/v1/lei/sync/full \
  -H "Authorization: Bearer $TOKEN"
```

Response:

```json
{
  "message": "Full sync triggered"
}
```

### 5. Monitor Processing

Check the processing status:

```bash
curl -X GET http://localhost:8080/api/v1/lei/status/DAILY_FULL \
  -H "Authorization: Bearer $TOKEN" | jq
```

Response:

```json
{
  "id": "...",
  "job_type": "DAILY_FULL",
  "status": "RUNNING",
  "last_run_at": "2026-02-10T14:30:00Z",
  "current_source_file": {
    "id": "...",
    "file_name": "lei-FULL-20260210-143000.json.zip",
    "processing_status": "IN_PROGRESS",
    "total_records": 2500000,
    "processed_records": 150000,
    "failed_records": 12
  }
}
```

## Testing

### Query LEI Records

Get first 10 records:

```bash
curl -X GET "http://localhost:8080/api/v1/lei?limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Get Specific LEI

```bash
curl -X GET http://localhost:8080/api/v1/lei/5493001KJTIIGC8Y1R12 \
  -H "Authorization: Bearer $TOKEN" | jq
```

### View Audit History

```bash
curl -X GET "http://localhost:8080/api/v1/lei/5493001KJTIIGC8Y1R12/audit?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq
```

## Scheduler Configuration

### Default Schedule

- **Delta Sync**: Every hour
- **Full Sync**: Weekly on Sunday at 2:00 AM

### Manual Triggers

Trigger delta sync:

```bash
curl -X POST http://localhost:8080/api/v1/lei/sync/delta \
  -H "Authorization: Bearer $TOKEN"
```

Trigger full sync:

```bash
curl -X POST http://localhost:8080/api/v1/lei/sync/full \
  -H "Authorization: Bearer $TOKEN"
```

## File Storage

Downloaded files are stored in:

```text
./data/lei/
└── lei-FULL-20260210-143000.xml.zip
└── lei-DELTA-20260210-150000.xml.zip
```

This directory is automatically created and is in `.gitignore`.

## Database Queries

### Check Processing Progress

```sql
SELECT 
    file_name,
    file_type,
    processing_status,
    total_records,
    processed_records,
    failed_records,
    ROUND((processed_records::numeric / NULLIF(total_records, 0) * 100), 2) as progress_pct
FROM source_files
WHERE processing_status = 'IN_PROGRESS'
ORDER BY processing_started_at DESC;
```

### Recent LEI Updates

```sql
SELECT 
    lei,
    legal_name,
    entity_status,
    updated_at,
    updated_by
FROM lei_records
ORDER BY updated_at DESC
LIMIT 10;
```

### LEI Audit Trail

```sql
SELECT 
    a.created_at,
    a.lei,
    a.action,
    l.legal_name,
    a.changed_by
FROM lei_records_audit a
JOIN lei_records l ON l.lei = a.lei
WHERE a.lei = '5493001KJTIIGC8Y1R12'
ORDER BY a.created_at DESC;
```

### File Processing Statistics

```sql
SELECT 
    file_type,
    COUNT(*) as total_files,
    SUM(total_records) as total_records,
    SUM(processed_records) as processed_records,
    SUM(failed_records) as failed_records,
    COUNT(*) FILTER (WHERE processing_status = 'COMPLETED') as completed,
    COUNT(*) FILTER (WHERE processing_status = 'FAILED') as failed
FROM source_files
GROUP BY file_type;
```

## GLEIF API Details

### Discovery Endpoint

The system uses GLEIF's discovery endpoint to get latest file URLs dynamically:

```bash
curl https://goldencopy.gleif.org/api/v2/golden-copies/publishes/latest
```

Response structure:

```json
{
  "data": {
    "lei2": {
      "publish_date": "2026-02-11 08:00:00",
      "full_file": {
        "json": {
          "url": "https://goldencopy.gleif.org/storage/golden-copy-files/...",
          "size": 909033722,
          "record_count": 3209464
        }
      },
      "delta_files": {
        "LastWeek": {
          "json": {
            "url": "https://goldencopy.gleif.org/storage/golden-copy-files/...",
            "size": 13731936,
            "record_count": 58533
          }
        }
      }
    }
  }
}
```

### File Formats

**Bulk Files** (what the system processes):

- Format: `{"records": [{"LEI": {"$": "..."}, "Entity": {...}}]}`
- Values nested in objects with `"$"` property
- Located in: `./data/lei/`

**Single LEI API** (different format, not currently implemented):

- Endpoint: `https://api.gleif.org/api/v1/lei-records/{lei}`
- Different JSON structure without `"$"` nesting
- Use for real-time single LEI lookups if needed

### Data Directory

Downloaded files are stored in `./data/lei/`:

- Compressed files: `lei-FULL-*.json.zip`, `lei-DELTA-*.json.zip`
- Extracted files: `*.json` (auto-cleaned after processing)
- This directory is excluded from git via `.gitignore`

## Troubleshooting

### Scheduler Not Starting

Check logs for errors:

```bash
tail -f backend/logs/app.log | grep LEI
```

### Processing Stuck

Check source file status:

```sql
SELECT * FROM source_files 
WHERE processing_status = 'IN_PROGRESS'
ORDER BY processing_started_at DESC;
```

Resume processing:

```bash
# Get the source file ID from the query above
curl -X POST http://localhost:8080/api/v1/lei/source-file/{FILE_ID}/resume \
  -H "Authorization: Bearer $TOKEN"
```

### Download Failed

Check job status for error details:

```sql
SELECT job_type, status, error_message, last_run_at 
FROM file_processing_status 
WHERE status = 'FAILED';
```

Manually retry:

```bash
curl -X POST http://localhost:8080/api/v1/lei/sync/full \
  -H "Authorization: Bearer $TOKEN"
```

## Next Steps

- Review [LEI_ACQUISITION.md](./LEI_ACQUISITION.md) for detailed documentation
- Set up monitoring and alerting for failed jobs
- Configure backup strategy for downloaded files
- Plan for master data reconciliation with LEI data

## Support

For issues or questions:

1. Check application logs: `backend/logs/app.log`
2. Query database for status details
3. Review GLEIF documentation
4. Create GitHub issue with details
