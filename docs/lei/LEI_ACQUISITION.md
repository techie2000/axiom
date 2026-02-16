# LEI (Legal Entity Identifier) Data Acquisition System

## Overview

This document describes the LEI data acquisition system integrated into Axiom, which automatically downloads and
processes Legal Entity Identifier (LEI) data from GLEIF (Global Legal Entity Identifier Foundation).

## Features

- **Automated Data Acquisition**: Daily downloads of full and delta files from GLEIF
- **Change Detection**: Only records updates when actual data changes occur
- **Full Audit Trail**: Complete history of all changes with pre/post state tracking
- **Resume Capability**: Can resume processing mid-file if interrupted
- **Source Provenance**: Tracks which source file each record came from
- **Scheduled Jobs**: Automatic hourly delta syncs and weekly full syncs

## Architecture

### Components

1. **Domain Models** (`internal/domain/lei_models.go`)
   - `LEIRecord`: Main LEI data entity
   - `LEIRecordAudit`: Full audit history
   - `SourceFile`: Downloaded file metadata and processing status
   - `FileProcessingStatus`: Job status tracking

2. **Repository Layer** (`internal/repository/lei_repository.go`)
   - CRUD operations for LEI records
   - Intelligent upsert with change detection
   - Audit trail creation and management
   - File processing status tracking

3. **Service Layer** (`internal/service/lei_service.go`)
   - File download from GLEIF
   - JSON parsing and processing (JSON Lines format)
   - Change detection logic
   - Resume-from-LEI functionality

4. **Scheduler** (`internal/service/scheduler_service.go`)
   - Hourly delta file synchronization
   - Weekly full file synchronization
   - Automatic retry on failure

5. **HTTP Handlers** (`internal/handler/lei_handler.go`)
   - REST API endpoints for LEI data access
   - Manual trigger endpoints for sync jobs
   - Processing status monitoring

## Database Schema

**Important**: All LEI tables are created in a separate `lei_raw` schema to keep raw GLEIF data distinct from
master data for easier permission management.

### Tables

#### `lei_raw.lei_records`

Main table storing raw LEI data from GLEIF.

Key fields:

- `lei` (VARCHAR(20), UNIQUE): Legal Entity Identifier
- `legal_name`: Entity legal name
- `legal_address_*`: Legal address fields
- `hq_address_*`: Headquarters address fields
- `registration_*`: Registration details
- `entity_status`: Current status of the entity
- `source_file_id`: Reference to source file
- `changed_fields` (JSONB): Last change details
- `created_by`, `updated_by`: System user tracking
- `created_at`, `updated_at`: Timestamps

#### `lei_raw.lei_records_audit`

Complete audit history of all LEI record changes.

Key fields:

- `lei_record_id`: Reference to LEI record
- `lei`: LEI code for easy lookup
- `action`: CREATE, UPDATE, or DELETE
- `record_snapshot` (JSONB): Complete record state
- `changed_fields` (JSONB): What changed
- `source_file_id`: Which file triggered the change
- `changed_by`: System user who made the change
- `created_at`: When the change occurred

#### `lei_raw.source_files`

Tracks downloaded files and their processing status.

Key fields:

- `file_name`: Name of downloaded file
- `file_type`: FULL or DELTA
- `file_url`: Source URL
- `file_hash`: SHA-256 hash for integrity
- `processing_status`: PENDING, IN_PROGRESS, COMPLETED, or FAILED
- `total_records`, `processed_records`, `failed_records`: Progress tracking
- `last_processed_lei`: For resume capability
- `processing_error`: Error details if failed

#### `lei_raw.file_processing_status`

Overall status of scheduled jobs.

Key fields:

- `job_type`: DAILY_FULL or DAILY_DELTA
- `status`: IDLE, RUNNING, COMPLETED, or FAILED
- `last_run_at`, `next_run_at`, `last_success_at`: Job timing
- `current_source_file_id`: Currently processing file
- `error_message`: Last error if any

## API Endpoints

All endpoints require JWT authentication and are under `/api/v1/lei`.

### Query Endpoints

#### `GET /api/v1/lei`

List LEI records with pagination.

Query parameters:

- `limit` (default: 50, max: 100): Number of records to return
- `offset` (default: 0): Offset for pagination

Response: Array of LEI records

#### `GET /api/v1/lei/:lei`

Get a specific LEI record by its LEI code.

Path parameters:

- `lei`: The LEI code (20 characters)

Response: Single LEI record

#### `GET /api/v1/lei/record/:id`

Get a specific LEI record by its database ID.

Path parameters:

- `id`: UUID of the record

Response: Single LEI record

#### `GET /api/v1/lei/:lei/audit`

Get audit history for a specific LEI.

Path parameters:

- `lei`: The LEI code

Query parameters:

- `limit` (default: 20): Number of audit records to return

Response: Array of audit records showing complete change history

### Sync Control Endpoints

#### `POST /api/v1/lei/sync/full`

Manually trigger a full synchronization.

Response:

```json
{
  "message": "Full sync triggered"
}
```

#### `POST /api/v1/lei/sync/delta`

Manually trigger a delta synchronization.

Response:

```json
{
  "message": "Delta sync triggered"
}
```

### Status Endpoints

#### `GET /api/v1/lei/status/:jobType`

Get processing status for a job type.

Path parameters:

- `jobType`: Either `DAILY_FULL` or `DAILY_DELTA`

Response: Job status including last run time, next scheduled run, and current file being processed

#### `POST /api/v1/lei/source-file/:id/resume`

Resume processing of an interrupted source file.

Path parameters:

- `id`: UUID of the source file

Response:

```json
{
  "message": "Processing resumed"
}
```

## Scheduler Configuration

### Delta Sync

- **Frequency**: Every hour
- **Source**: GLEIF Level 1 Delta files (JSON format)
- **Purpose**: Capture incremental changes
- **Runs immediately on startup**, then hourly

### Full Sync

- **Frequency**: Weekly (Sunday at 2:00 AM)
- **Source**: GLEIF Level 1 Full files (JSON format)
- **Purpose**: Complete refresh of all data
- **First run**: Calculated to next Sunday at 2 AM

## Data Flow

1. **Download Phase**

   - Scheduler triggers download from GLEIF
   - File saved to `data/lei/` directory
   - SHA-256 hash calculated for integrity
   - `SourceFile` record created with PENDING status

2. **Processing Phase**

   - File status updated to IN_PROGRESS
   - ZIP archive extracted to temporary location
   - JSON file parsed and processed line by line (JSON Lines format)
   - For each record:

     - Check if LEI already exists
     - If new: Create record and audit entry (CREATE)
     - If existing: Compare fields for changes
     - If changed: Update record, store change details, create audit entry (UPDATE)
     - If unchanged: Skip (no update)
   - Progress saved every 1000 records
   - `last_processed_lei` updated for resume capability

3. **Completion Phase**

   - File status updated to COMPLETED or FAILED
   - Final statistics recorded
   - Temporary files cleaned up
   - Next run scheduled

## Resume Capability

If processing is interrupted (server restart, crash, etc.):

1. File remains in IN_PROGRESS state
2. `last_processed_lei` field contains the last successfully processed LEI
3. On restart, processing can resume from `last_processed_lei`
4. Already processed records are skipped
5. Processing continues from interruption point

## Change Detection

The system only records updates when actual data changes:

1. **Field-by-Field Comparison**: Each field is compared between old and new records
2. **Skip Metadata Fields**: Internal fields (ID, timestamps, etc.) are not considered changes
3. **JSON Change Log**: Changes stored as JSONB:

   ```json
   {
     "LegalName": {
       "old_value": "Old Company Name Ltd",
       "new_value": "New Company Name Ltd"
     },
     "EntityStatus": {
       "old_value": "ACTIVE",
       "new_value": "LAPSED"
     }
   }
   ```

4. **No Unnecessary Updates**: If no fields changed, no update is performed
5. **Audit Trail**: Every actual change creates an audit record

## Configuration

### Environment Variables

The following environment variables configure LEI data acquisition and scheduling:

#### LEI Data Directory

- `LEI_DATA_DIR` - Directory for storing downloaded LEI files (default: `./data/lei`)

#### Scheduler Configuration

- `LEI_DELTA_SYNC_INTERVAL` - How often to run delta sync (default: `1h`)
  - Format: Go duration (e.g., `30m`, `1h`, `2h`)
  - Example: `LEI_DELTA_SYNC_INTERVAL=2h` for every 2 hours

- `LEI_FULL_SYNC_DAY` - Day of week for full sync (default: `Sunday`)
  - Format: Day name (case-insensitive)
  - Valid: `Sunday`, `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`, `Saturday`
  - Short forms accepted: `Sun`, `Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat`

- `LEI_FULL_SYNC_TIME` - Time of day for full sync (default: `02:00`)
  - Format: `HH:MM` in 24-hour format
  - Example: `LEI_FULL_SYNC_TIME=01:30` for 1:30 AM

- `LEI_CLEANUP_TIME` - Time of day for daily file cleanup (default: `03:00`)
  - Format: `HH:MM` in 24-hour format
  - Example: `LEI_CLEANUP_TIME=04:00` for 4:00 AM

#### File Retention

- `LEI_KEEP_FULL_FILES` - Number of full files to retain (default: `2`)
  - Each full file is ~900MB compressed, ~12GB extracted
  - Keeping 2 files (~1.8GB) allows rollback to previous week

- `LEI_KEEP_DELTA_FILES` - Number of delta files to retain (default: `5`)
  - Each delta file is ~13MB compressed
  - Keeping 5 files (~65MB) covers 5 hours of changes

**Total retained disk space:** ~2GB maximum with defaults

**Validation:** Invalid values fall back to defaults with warning logs. Service continues uninterrupted.

### File Storage

Downloaded files are stored in:

- Location: `./data/lei/`
- Format: `lei-{TYPE}-{TIMESTAMP}.xml.zip`
- Example: `lei-FULL-20260210-143022.xml.zip`
- Note: This directory is in `.gitignore`

## Monitoring

### Check Processing Status

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8080/api/v1/lei/status/DAILY_DELTA
```

### View Recent Audit History

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8080/api/v1/lei/5493001KJTIIGC8Y1R12/audit?limit=10
```

### Query LEI Records

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:8080/api/v1/lei?limit=10&offset=0"
```

## Troubleshooting

### Processing Stuck in IN_PROGRESS

If a file is stuck processing:

1. Check the source file status:

   ```sql
   SELECT * FROM source_files WHERE processing_status = 'IN_PROGRESS';
   ```

2. Check the `last_processed_lei` field to see where it stopped

3. Resume processing:

   ```bash
   curl -X POST -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:8080/api/v1/lei/source-file/{FILE_ID}/resume
   ```

### Failed Downloads

Check the `file_processing_status` table:

```sql
SELECT * FROM file_processing_status WHERE status = 'FAILED';
```

The `error_message` field will contain details about the failure.

### Large File Processing

Full LEI files can be very large (millions of records). Processing may take several hours. This is expected behavior.
The system:

- Saves progress every 1000 records
- Logs progress to console
- Can be safely interrupted and resumed

## Performance Considerations

- **Batch Processing**: Records are processed and committed in batches
- **Index Usage**: All queries use indexed fields for fast lookup
- **JSONB Fields**: Changed fields stored as JSONB for efficient querying
- **Pagination**: API endpoints use pagination to prevent memory issues
- **Connection Pooling**: Database connections are pooled for efficiency

## Future Enhancements

Potential improvements:

- [ ] Support for Level 2 data (relationship data)
- [ ] Real-time change notifications
- [ ] Web UI for monitoring processing status
- [ ] Metrics and analytics dashboard
- [ ] Integration with master data reconciliation
- [x] **Configurable sync schedules** - Implemented via environment variables
  (see [Environment Variables](#environment-variables) section)
- [ ] Webhook notifications on processing completion

## References

- [GLEIF Official Website](https://www.gleif.org/)
- [Level 1 Data Documentation](https://www.gleif.org/en/lei-data/access-and-use-lei-data/level-1-data-who-is-who)
- [Download Golden Copy](https://www.gleif.org/en/lei-data/gleif-golden-copy/download-the-golden-copy)
- [LEI Common Data File Format](https://www.gleif.org/en/about-lei/common-data-file-format)
