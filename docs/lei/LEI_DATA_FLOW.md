# LEI Data Acquisition Flow

This document visualizes the complete flow of LEI (Legal Entity Identifier) data acquisition,
from scheduling through to storage.

## High-Level Flow Diagram

```mermaid
flowchart TD
    Start([Backend Startup]) --> Init[Initialize Scheduler Service]
    Init --> CheckDB{Database<br/>Empty?}

    CheckDB -->|Yes - First Run| FullSync[Trigger Full Sync Job]
    CheckDB -->|No - Has Data| DeltaSync[Trigger Delta Sync Job]

    FullSync --> GLEIFRefSyncFull[Pre-step: Sync GLEIF Reference Code Lists<br/>Registration Authorities<br/>Entity Legal Forms<br/>Organizational Roles<br/>Legal Jurisdictions]
    DeltaSync --> GLEIFRefSyncDelta[Pre-step: Sync GLEIF Reference Code Lists]

    GLEIFRefSyncFull -->|Success| DownloadFull[Download Full File<br/>~900MB, 3.2M records]
    GLEIFRefSyncFull -->|Failure| AbortFull([Abort: mark FAILED])

    GLEIFRefSyncDelta -->|Success| DownloadDelta[Download Delta File<br/>~13MB, 58K records]
    GLEIFRefSyncDelta -->|Failure| AbortDelta([Abort: mark FAILED])

    DownloadFull --> SaveFile1[Save to ./data/lei/]
    DownloadDelta --> SaveFile2[Save to ./data/lei/]

    SaveFile1 --> CreateSourceFile1[Create SourceFile Record<br/>Status: PENDING]
    SaveFile2 --> CreateSourceFile2[Create SourceFile Record<br/>Status: PENDING]

    CreateSourceFile1 --> ProcessFile[Process ZIP File]
    CreateSourceFile2 --> ProcessFile

    ProcessFile --> Extract[Extract JSON<br/>JSON Lines format]
    Extract --> ParseLoop{For Each<br/>JSON Record}

    ParseLoop -->|Parse Record| Transform[Transform JSON to<br/>Domain Model]
    Transform --> Validate[Validate LEI Data]
    Validate --> Upsert[Upsert to Database]

    Upsert --> CheckExists{Record<br/>Exists?}

    CheckExists -->|No| CreateNew[Create New Record]
    CheckExists -->|Yes| DetectChanges{Changes<br/>Detected?}

    CreateNew --> CreateAudit1[Create Audit Record<br/>Action: CREATE]
    DetectChanges -->|Yes| UpdateRecord[Update Record]
    DetectChanges -->|No| Skip[Skip - No Changes]

    UpdateRecord --> CreateAudit2[Create Audit Record<br/>Action: UPDATE]

    CreateAudit1 --> UpdateProgress[Update Processing Progress]
    CreateAudit2 --> UpdateProgress
    Skip --> UpdateProgress

    UpdateProgress --> ParseLoop

    ParseLoop -->|All Records Processed| Complete[Mark SourceFile<br/>Status: COMPLETED]
    Complete --> Schedule{Scheduler}

    Schedule -->|Daily: 2 AM| FullSync
```

## Detailed Component Interaction

```mermaid
sequenceDiagram
    participant S as Scheduler Service
    participant LS as LEI Service
    participant GLEIF as GLEIF API
    participant FS as File System
    participant R as Repository
    participant DB as PostgreSQL

    Note over S: Backend Starts
    S->>R: CountLEIRecords()
    R->>DB: SELECT COUNT(*)
    DB-->>R: count
    R-->>S: record count
    
    alt Database Empty (First Run)
        S->>S: Trigger Full Sync
        S->>LS: RunDailyFullSync()
    else Database Has Records
        S->>S: Trigger Delta Sync
        S->>LS: RunDailyDeltaSync()
    end
    
    LS->>GLEIF: GET /api/v2/golden-copies/publishes/latest
    GLEIF-->>LS: full_url, delta_url, record_counts
    
    alt Full Sync
        LS->>GLEIF: Download full file (900MB)
    else Delta Sync
        LS->>GLEIF: Download delta file (13MB)
    end
    
    GLEIF-->>LS: ZIP file stream
    LS->>FS: Save to ./data/lei/
    LS->>R: CreateSourceFile()
    R->>DB: INSERT source_files (PENDING)
    
    LS->>FS: Extract ZIP
    FS-->>LS: JSON content (JSON Lines)
    
    loop For Each Record (Batch 1000)
        LS->>LS: Parse JSON Line
        LS->>LS: Transform to LEIRecord
        LS->>R: UpsertLEIRecord()
        
        R->>DB: SELECT WHERE lei = ?
        
        alt Record Not Found
            R->>DB: INSERT lei_records
            R->>DB: INSERT lei_records_audit (CREATE)
        else Record Found
            R->>R: Detect Changes
            alt Changes Detected
                R->>DB: UPDATE lei_records
                R->>DB: INSERT lei_records_audit (UPDATE)
            else No Changes
                Note over R: Skip Record
            end
        end
        
        LS->>R: Update SourceFile Progress
        R->>DB: UPDATE source_files<br/>processed_records++
    end
    
    LS->>R: Complete Processing
    R->>DB: UPDATE source_files<br/>Status: COMPLETED
    
    Note over S: Wait 1 Hour
    S->>LS: RunDailyDeltaSync()
```

## Data Storage Structure

```mermaid
graph LR
    subgraph "File System"
        ZIP[ZIP File<br/>lei-FULL-*.json.zip<br/>lei-DELTA-*.json.zip]
        JSON[Extracted JSON<br/>JSON Lines Format]
    end
    
    subgraph "PostgreSQL - lei_raw schema"
        SF[source_files<br/>File metadata<br/>Processing status]
        LR[lei_records<br/>3.2M LEI entities<br/>with addresses]
        AU[lei_records_audit<br/>Complete change history<br/>CREATE/UPDATE/DELETE]
        FP[file_processing_status<br/>Job tracking<br/>DAILY_FULL/DAILY_DELTA]
    end
    
    ZIP --> JSON
    JSON --> LR
    JSON --> SF
    LR --> AU
    SF --> FP
```

## Processing States

```mermaid
stateDiagram-v2
    [*] --> Downloading: API Call to GLEIF
    Downloading --> Downloaded: File Saved
    Downloaded --> Pending: SourceFile Created
    
    Pending --> InProgress: Start Processing
    InProgress --> Processing: Parse & Transform
    
    Processing --> Upserting: For Each Record
    Upserting --> CheckRecord: Lookup in DB
    
    CheckRecord --> Create: Not Found
    CheckRecord --> Compare: Found
    
    Compare --> Update: Changes Detected
    Compare --> Skip: No Changes
    
    Create --> Audit1: Log CREATE
    Update --> Audit2: Log UPDATE
    Skip --> Next: Continue
    
    Audit1 --> ProgressUpdate: Increment Counter
    Audit2 --> ProgressUpdate
    Next --> ProgressUpdate
    
    ProgressUpdate --> Processing: Next Record
    Processing --> Completed: All Records Done
    
    Completed --> [*]
    
    InProgress --> Failed: Error Occurred
    Failed --> Pending: Reset for Retry
```

## Directory Structure

```text
./data/lei/
├── lei-FULL-20260211-132723.json.zip    # Full snapshot (900MB)
├── lei-DELTA-20260211-080000.json.zip   # Delta updates (13MB)
└── extracted/
    ├── lei-FULL-20260211-132723.json    # Extracted JSON Lines
    └── lei-DELTA-20260211-080000.json   # Extracted JSON Lines
```

## Key Features

### 1. Smart First Run Detection

- On first startup with empty database: Downloads **full file** (3.2M records)
- On subsequent runs: Downloads **delta files** (incremental updates only)

### 2. Change Detection

- Compares incoming record with existing database record
- Only updates if actual field changes are detected
- Skips unchanged records to reduce database load

### 3. Complete Audit Trail

- Every CREATE/UPDATE/DELETE logged in `lei_records_audit`
- Includes full record snapshot before and after
- Tracks which source file triggered the change

### 4. Resume Capability

- Tracks `last_processed_lei` in source file
- Can resume from any LEI code if processing is interrupted
- No duplicate processing on resume

### 5. Progress Tracking

- Real-time counters: `processed_records`, `failed_records`
- Progress logs every 1,000 records
- Status visible via API: `/api/v1/lei/status/:jobType`

## Schedule Configuration

All schedules are configurable via environment variables. Defaults shown below:

| Job Type            | Frequency         | Environment Variable      | Default Value | Status       |
|---------------------|-------------------|---------------------------|---------------|--------------|
| File Cleanup        | Midnight daily    | `LEI_CLEANUP_TIME`        | `00:00`       | Active       |
| Master Data Sync    | 1:00 AM daily     | N/A (hardcoded)           | `01:00`       | Active       |
| Full Sync           | 2:00 AM daily     | `LEI_FULL_SYNC_TIME`      | `02:00`       | Active       |
| Delta Sync          | N/A (disabled)    | `LEI_DELTA_SYNC_INTERVAL` | `1h`          | **Disabled** |
| Retain Full Files   | Last 2 files      | `LEI_KEEP_FULL_FILES`     | `2`           | Active       |
| Retain Delta Files  | Last 5 files      | `LEI_KEEP_DELTA_FILES`    | `5`           | Active       |

**Notes**:

- **Delta sync is currently disabled** - Using full sync daily strategy for reliability
- File cleanup runs at midnight (before all syncs) to prevent interference with long-running LEI syncs
- Master data sync runs at 1:00 AM to ensure countries/currencies exist before LEI sync
- Full sync runs daily at 2:00 AM (changed from weekly to ensure fresh data)
- Invalid values fall back to defaults

See [LEI_ACQUISITION.md](LEI_ACQUISITION.md#environment-variables) for detailed format specifications.

## Performance Metrics

| Operation           | Throughput                | Notes                                        |
| ------------------- | ------------------------- | -------------------------------------------- |
| Download Full File  | ~54 seconds               | 900MB over network                           |
| Download Delta File | ~5 seconds                | 13MB over network                            |
| Process Records     | ~1,000 records/10 sec     | Includes parsing, transform, upsert          |
| Database Insert     | ~100 records/sec          | With audit trail creation                    |

## Error Handling

```mermaid
flowchart TD
    Error[Error Occurs] --> LogError[Log Error Details]
    LogError --> MarkFailed[Mark Record as Failed]
    MarkFailed --> IncrementCounter[failed_records++]
    IncrementCounter --> Continue{Continue<br/>Processing?}
    
    Continue -->|Yes| NextRecord[Process Next Record]
    Continue -->|No - Max Failures| MarkSourceFailed[Mark SourceFile FAILED]
    
    MarkSourceFailed --> Retry{Retry<br/>Enabled?}
    Retry -->|Yes| ResetStatus[Reset to PENDING]
    Retry -->|No| ManualIntervention[Requires Manual Check]
```

## Monitoring & Observability

### Logs

- Structured JSON logs with zerolog
- Progress updates every 1,000 records
- Error logs with full context

### Metrics (Available via API)

- `/api/v1/lei` - List LEI records
- `/api/v1/lei/:lei` - Get specific LEI
- `/api/v1/lei/:lei/audit` - View change history
- `/api/v1/lei/status/:jobType` - Check job status

### Database Queries

```sql
-- Check processing status
SELECT file_name, processing_status, 
       processed_records, failed_records, total_records
FROM lei_raw.source_files
ORDER BY downloaded_at DESC;

-- View recent changes
SELECT lei, action, created_at
FROM lei_raw.lei_records_audit
ORDER BY created_at DESC
LIMIT 10;

-- Count total records
SELECT COUNT(*) FROM lei_raw.lei_records;
```
