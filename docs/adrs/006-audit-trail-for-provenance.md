# ADR-006: Audit Trail for Reference Data Provenance

## Status

Accepted

## Date

2026-01-26

## Context

Axiom serves as the **single source of truth** for enterprise reference data used across trading, settlement, and operational systems. For regulatory compliance, operational debugging, and data governance, we need:

1. **Provenance tracking**: Know the source and lineage of every data value
2. **Change history**: Complete audit trail of all modifications
3. **Compliance**: Meet financial regulatory requirements (SOX, MiFID II, GDPR)
4. **Debugging**: Ability to trace when/why data changed
5. **Rollback capability**: Reconstruct historical state if needed
6. **Accountability**: Track which system/user made each change

Key requirements:

- Capture all INSERT, UPDATE, and DELETE operations
- Track source system (csv2json, API, manual entry)
- Record which specific fields changed
- Minimal performance impact on production queries
- Long-term retention (7+ years for compliance)
- Query-friendly for analysis and reporting

## Decision

We will implement a **separate audit table pattern** with automatic triggers for all reference data tables.

### Implementation

For each reference table (e.g., `reference.countries`), create a corresponding audit table (e.g., `reference.countries_audit`) that:

1. **Captures all changes** via database triggers (INSERT, UPDATE, DELETE)
2. **Stores complete snapshots** of the record after each change
3. **Tracks source context** via PostgreSQL session variables
4. **Records change metadata**:
   - Operation type (INSERT/UPDATE/DELETE)
   - Timestamp (when change occurred)
   - Source system (csv2json, api, manual)
   - Source user (service account or username)
   - Changed fields (array of field names that changed)

### Architecture

```text
┌─────────────────────────────────────────────────┐
│     Main Table (reference.countries)            │
│  - Fast queries                                 │
│  - Current data only                            │
│  - Primary key constraints                      │
│  - Updated by applications                      │
└─────────────┬───────────────────────────────────┘
              │
              │ Trigger (automatic)
              │
              ▼
┌─────────────────────────────────────────────────┐
│   Audit Table (reference.countries_audit)       │
│  - Write-only (via triggers)                    │
│  - Complete history                             │
│  - No updates/deletes                           │
│  - Indexed for analysis queries                 │
└─────────────────────────────────────────────────┘
```

### Source Tracking

Applications set PostgreSQL session variables before making changes:

```go
// In application code (e.g., canonicalizer)
repo.SetAuditContext(ctx, "csv2json", "canonicalizer")
```

Triggers capture these values:

```sql
source_system := current_setting('app.source_system', TRUE)
source_user := current_setting('app.source_user', TRUE)
```

## Rationale

### Why Separate Audit Table (vs. is_current Pattern)?

#### Separate Audit Table ✅

- **Performance**: Main table queries unaffected by history
- **Simplicity**: Current state queries remain simple (`SELECT * FROM countries`)
- **Complete history**: Every version preserved, not just current/previous
- **Standard pattern**: Industry standard for financial systems
- **Flexible retention**: Easy to archive old audit records
- **Schema independence**: Can add audit columns without changing main table

#### is_current Pattern ❌

- **Performance**: All queries must filter `WHERE is_current = true`
- **Query complexity**: Every query needs current record logic
- **Limited history**: Only shows current/superseded, not full timeline
- **Index bloat**: Multiple versions per key in same table
- **Hard to archive**: Can't separate old versions easily

### Why Database Triggers (vs. Application-Level Auditing)?

#### Database Triggers ✅

- **Guaranteed capture**: Can't bypass, even with direct SQL
- **Atomic**: Changes and audit in same transaction
- **Consistent**: One implementation for all applications
- **Complete**: Captures manual changes, migrations, scripts
- **Reliable**: No risk of application forgetting to log

#### Application-Level ❌

- **Bypassable**: Direct SQL bypasses application logic
- **Inconsistent**: Each application must implement correctly
- **Error-prone**: Easy to forget to log changes
- **Missing context**: Manual SQL changes not captured

### Why PostgreSQL Session Variables?

- **Clean separation**: Audit logic in database, source tracking in application
- **Transaction-scoped**: Automatic cleanup after transaction
- **Simple API**: Single function call to set context
- **Flexible**: Can add more tracking fields without schema changes

## Consequences

### Positive

- **Compliance**: Full audit trail meets regulatory requirements
- **Debugging**: Can trace exact history of any data value
- **Performance**: Zero impact on main table queries
- **Accountability**: Know who/what made every change
- **Rollback**: Can reconstruct any historical state
- **Data quality**: Detect anomalies and suspicious patterns
- **Provenance**: Complete lineage for every data value

### Negative

- **Storage overhead**: Audit tables grow over time (mitigated by archiving)
- **Write amplification**: Each change triggers audit insert (acceptable for reference data)
- **Additional complexity**: More tables to manage
- **Retention policy needed**: Must define and implement archiving strategy

### Operational Considerations

#### Storage Management

- Audit tables grow continuously (write-only)
- Implement retention policy (e.g., 7 years active + archive)
- Monitor table sizes with `pg_total_relation_size()`
- Archive old records to separate tables/tablespaces

#### Indexing Strategy

```sql
-- Optimize for common audit queries
CREATE INDEX idx_countries_audit_alpha2 ON countries_audit(alpha2);
CREATE INDEX idx_countries_audit_operated_at ON countries_audit(operated_at DESC);
CREATE INDEX idx_countries_audit_source ON countries_audit(source_system, source_user);
```

#### Retention Example

```sql
-- Archive records older than 7 years
INSERT INTO reference.countries_audit_archive
SELECT * FROM reference.countries_audit
WHERE operated_at < NOW() - INTERVAL '7 years';

DELETE FROM reference.countries_audit
WHERE operated_at < NOW() - INTERVAL '7 years';
```

## Implementation Checklist

For each new reference table:

- [ ] Create `*_audit` table with same schema + audit metadata
- [ ] Create audit trigger function
- [ ] Add indexes for audit queries
- [ ] Document audit queries in `AUDIT-TRAIL.md`
- [ ] Update repository with `SetAuditContext()` method
- [ ] Update application to set source context before writes
- [ ] Define retention policy
- [ ] Add monitoring for audit table growth

## Examples

### Query Full History

```sql
SELECT operated_at, operation, name_english, changed_fields
FROM reference.countries_audit
WHERE alpha2 = 'US'
ORDER BY operated_at DESC;
```

### Track Field Changes

```sql
SELECT alpha2, operated_at, name_english
FROM reference.countries_audit
WHERE 'name_english' = ANY(changed_fields)
ORDER BY operated_at DESC;
```

### Compliance Report

```sql
SELECT 
    operated_at AS "Change Date",
    operation AS "Operation",
    alpha2 AS "Country",
    source_system AS "Source",
    source_user AS "User"
FROM reference.countries_audit
WHERE operated_at BETWEEN '2026-01-01' AND '2026-12-31'
ORDER BY operated_at DESC;
```

## Alternatives Considered

### Event Sourcing

- **Rejected**: Too complex for reference data use case
- Store events, reconstruct state by replaying
- Better for systems with complex state transitions
- Overkill for reference data that changes infrequently

### Temporal Tables (SQL:2011)

- **Rejected**: Limited PostgreSQL support (not native)
- Requires extensions or custom implementation
- More complex to query historical state
- Separate audit table is simpler and well-understood

### CDC (Change Data Capture)

- **Rejected**: Requires additional infrastructure
- Tools like Debezium add operational complexity
- Parsing WAL logs is more fragile than triggers
- Triggers are simpler and self-contained

## Future Enhancements

- Automated archiving job (e.g., monthly)
- Audit visualization dashboard
- Anomaly detection on change patterns
- Integration with SIEM systems
- API for querying audit history

## Related ADRs

- [ADR-002: PostgreSQL for Data Persistence](002-postgresql-for-data-persistence.md)
- [ADR-003: Schema-Based Database Isolation](003-schema-based-database-isolation.md)

## References

- [PostgreSQL Triggers Documentation](https://www.postgresql.org/docs/current/triggers.html)
- [Audit Table Pattern](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [SOX Compliance Requirements](https://www.sec.gov/rules/final/33-8238.htm)
