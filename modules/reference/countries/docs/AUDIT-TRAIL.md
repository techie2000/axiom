# Countries Audit Trail

## Overview

The `reference.countries_audit` table provides complete provenance and compliance tracking for all changes to country reference data.

## Features

- **Complete History**: Every INSERT, UPDATE, and DELETE operation is recorded
- **Source Tracking**: Captures which system and user made each change
- **Change Detection**: Records which specific fields changed on updates
- **Timestamps**: Tracks both operation time and original record timestamps
- **Read-Only**: Audit table is write-only via triggers (no manual edits)

## Audit Table Schema

```sql
CREATE TABLE reference.countries_audit (
    audit_id BIGSERIAL PRIMARY KEY,               -- Unique audit record ID
    operation TEXT NOT NULL,                      -- INSERT, UPDATE, or DELETE
    operated_at TIMESTAMP WITH TIME ZONE,         -- When the change occurred
    
    -- Source tracking
    source_system VARCHAR(50),                    -- e.g., 'csv2json', 'api', 'manual'
    source_user VARCHAR(100),                     -- User or service account
    
    -- Complete record snapshot
    alpha2 CHAR(2) NOT NULL,
    alpha3 CHAR(3) NOT NULL,
    alpha4 CHAR(4),
    numeric CHAR(3) NOT NULL,
    name_english VARCHAR(255) NOT NULL,
    name_french VARCHAR(255) NOT NULL,
    status reference.country_code_status NOT NULL,
    start_date DATE,
    end_date DATE,
    
    -- Original timestamps
    record_created_at TIMESTAMP WITH TIME ZONE,
    record_updated_at TIMESTAMP WITH TIME ZONE,
    
    -- Change tracking
    changed_fields TEXT[]                         -- Fields that changed (UPDATE only)
);
```

## Common Queries

### View Complete History for a Country

```sql
SELECT 
    audit_id,
    operation,
    operated_at,
    source_system,
    source_user,
    alpha3,
    numeric,
    name_english,
    status,
    changed_fields
FROM reference.countries_audit
WHERE alpha2 = 'US'
ORDER BY operated_at DESC;
```

### Find All Changes in Last 30 Days

```sql
SELECT 
    alpha2,
    operation,
    operated_at,
    source_system,
    changed_fields,
    name_english
FROM reference.countries_audit
WHERE operated_at >= NOW() - INTERVAL '30 days'
ORDER BY operated_at DESC;
```

### Track Changes to a Specific Field

```sql
-- Find all records where name_english changed
SELECT 
    alpha2,
    operated_at,
    source_system,
    name_english AS new_name
FROM reference.countries_audit
WHERE 'name_english' = ANY(changed_fields)
ORDER BY operated_at DESC;
```

### Compare Before/After Values

```sql
-- Get previous and current values for a country
WITH audit_history AS (
    SELECT 
        alpha2,
        name_english,
        status,
        operated_at,
        LAG(name_english) OVER (PARTITION BY alpha2 ORDER BY operated_at) AS previous_name,
        LAG(status) OVER (PARTITION BY alpha2 ORDER BY operated_at) AS previous_status
    FROM reference.countries_audit
    WHERE alpha2 = 'GB'
)
SELECT 
    operated_at,
    previous_name,
    name_english AS current_name,
    previous_status,
    status AS current_status
FROM audit_history
WHERE previous_name IS NOT NULL
ORDER BY operated_at DESC;
```

### Audit Report by Source System

```sql
SELECT 
    source_system,
    operation,
    COUNT(*) AS change_count,
    MIN(operated_at) AS first_change,
    MAX(operated_at) AS last_change
FROM reference.countries_audit
GROUP BY source_system, operation
ORDER BY source_system, operation;
```

### Find Records Modified by Specific Source

```sql
SELECT 
    alpha2,
    operation,
    operated_at,
    changed_fields,
    name_english
FROM reference.countries_audit
WHERE source_system = 'csv2json'
  AND operated_at >= '2026-01-01'
ORDER BY operated_at DESC;
```

### Get Full Change Timeline

```sql
-- Complete timeline showing what changed when
SELECT 
    audit_id,
    operated_at,
    operation,
    alpha2,
    CASE 
        WHEN operation = 'INSERT' THEN 'New country added'
        WHEN operation = 'UPDATE' THEN 
            'Updated: ' || array_to_string(changed_fields, ', ')
        WHEN operation = 'DELETE' THEN 'Country deleted'
    END AS change_description,
    source_system
FROM reference.countries_audit
ORDER BY operated_at DESC
LIMIT 100;
```

### Detect Suspicious Changes

```sql
-- Find multiple rapid changes (potential data quality issue)
SELECT 
    alpha2,
    COUNT(*) AS change_count,
    MIN(operated_at) AS first_change,
    MAX(operated_at) AS last_change,
    MAX(operated_at) - MIN(operated_at) AS time_span
FROM reference.countries_audit
WHERE operated_at >= NOW() - INTERVAL '1 hour'
GROUP BY alpha2
HAVING COUNT(*) > 3
ORDER BY change_count DESC;
```

## Compliance Queries

### Audit Trail for Regulatory Review

```sql
-- Complete audit report with all details
SELECT 
    audit_id AS "Audit ID",
    operated_at AS "Change Date/Time",
    operation AS "Operation",
    alpha2 AS "Country Code",
    name_english AS "Country Name",
    source_system AS "Source System",
    source_user AS "Changed By",
    array_to_string(changed_fields, ', ') AS "Fields Modified"
FROM reference.countries_audit
WHERE operated_at BETWEEN '2026-01-01' AND '2026-12-31'
ORDER BY operated_at DESC;
```

### Data Lineage Report

```sql
-- Show complete lineage for each country
SELECT 
    c.alpha2,
    c.name_english AS current_name,
    c.updated_at AS current_version_date,
    COUNT(a.audit_id) AS total_changes,
    MIN(a.operated_at) AS first_recorded_change,
    MAX(a.operated_at) AS last_recorded_change
FROM reference.countries c
LEFT JOIN reference.countries_audit a ON c.alpha2 = a.alpha2
GROUP BY c.alpha2, c.name_english, c.updated_at
ORDER BY total_changes DESC;
```

## Maintenance

### Check Audit Table Size

```sql
SELECT 
    pg_size_pretty(pg_total_relation_size('reference.countries_audit')) AS total_size,
    COUNT(*) AS total_records,
    COUNT(*) FILTER (WHERE operation = 'INSERT') AS inserts,
    COUNT(*) FILTER (WHERE operation = 'UPDATE') AS updates,
    COUNT(*) FILTER (WHERE operation = 'DELETE') AS deletes
FROM reference.countries_audit;
```

### Archive Old Audit Records

```sql
-- Archive records older than 7 years (adjust retention policy as needed)
CREATE TABLE reference.countries_audit_archive (
    LIKE reference.countries_audit INCLUDING ALL
);

-- Move old records to archive
INSERT INTO reference.countries_audit_archive
SELECT * FROM reference.countries_audit
WHERE operated_at < NOW() - INTERVAL '7 years';

-- Delete archived records from main table
DELETE FROM reference.countries_audit
WHERE operated_at < NOW() - INTERVAL '7 years';
```

## How Source Tracking Works

The canonicalizer sets PostgreSQL session variables before each operation:

```go
// In canonicalizer/main.go
repo.SetAuditContext(ctx, "csv2json", "canonicalizer")
```

This is captured by the audit trigger:

```sql
source_system := current_setting('app.source_system', TRUE),
source_user := current_setting('app.source_user', TRUE)
```

## Benefits

1. **Compliance**: Complete audit trail for regulatory requirements
2. **Debugging**: Track down when/why data changed
3. **Provenance**: Know the source and lineage of every value
4. **Data Quality**: Detect anomalies and suspicious changes
5. **Rollback**: Reconstruct historical state if needed
6. **Accountability**: Know who/what made each change

## Best Practices

- Query audit table for analysis, never modify it directly
- Set retention policy based on regulatory requirements
- Monitor audit table growth
- Use indexes for efficient querying
- Archive old audit records periodically
- Always set source_system/source_user context before writes
