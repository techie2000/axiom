# ADR-007: Exclude Formerly Used Country Codes from Operational Data

**Status**: Accepted  
**Date**: 2026-01-27

## Context

ISO 3166-1 country codes can be reused over time. For example:
- `GE` was originally assigned to "Gilbert and Ellice Islands" (formerly used)
- `GE` is now assigned to "Georgia" (officially assigned)

Our current schema uses `alpha2` as the PRIMARY KEY, which prevents storing both historical and current assignments of the same code.

ISO 3166-1 defines six status types, each with different field requirements:

| Status | Required Fields | Optional Fields |
| ------ | --------------- | --------------- |
| **officially_assigned** | status, alpha2, alpha3, name_english, name_french | alpha4, numeric, start_date, end_date, remarks |
| **exceptionally_reserved** | status, alpha2, name_english, remarks | start_date, end_date |
| **indeterminately_reserved** | status, alpha2, name_english, remarks | start_date, end_date |
| **transitionally_reserved** | status, alpha2, name_english, remarks | start_date, end_date |
| **formerly_used** | status, alpha2, alpha3, alpha4, numeric, name_english, name_french, start_date, end_date, remarks | - |
| **unassigned** | status, alpha2 | remarks |

**Business Problem**: Operational systems (trading, settlement, compliance) need current, valid country codes for:
- Account domicile validation
- Instrument country-of-issue
- Regulatory reporting (EMIR, MiFID II)
- Sanctions screening

Historical codes like "Gilbert and Ellice Islands" have no operational value in these contexts.

## Decision

**Exclude records with `status = 'formerly_used'` from the `reference.countries` table.**

The canonicalizer will:
1. Validate all records according to status-specific business rules
2. Skip (not insert) any records with `status = 'formerly_used'`
3. Log skipped historical codes for audit purposes

## Rationale

### Why Exclude Formerly Used Codes?

1. **Operational Focus**: Trading systems need current codes, not historical ones
2. **Data Integrity**: Prevents PRIMARY KEY conflicts on `alpha2`
3. **Simpler Schema**: No need for composite keys or temporal columns
4. **Query Performance**: Filters like "active countries" become trivial
5. **ISO Compliance**: We still validate the data; we just don't store historical records

### Why Not Store Historical Codes?

**Alternative 1**: Composite key `(alpha2, start_date, end_date)`
- ❌ Complicates all queries and foreign keys
- ❌ Operational systems don't need this granularity
- ❌ Adds unnecessary complexity to 99% of use cases

**Alternative 2**: Separate `reference.countries_historical` table
- ✅ Clean separation of concerns
- ✅ Can be added later if needed
- ❌ No current business requirement for historical codes
- 💡 **Decision**: Implement if/when historical tracking is required

**Alternative 3**: Add surrogate key, keep alpha2 non-unique
- ❌ Breaks the natural key pattern
- ❌ Complicates lookups (must filter by status)
- ❌ Foreign keys become ambiguous

### Status-Specific Business Rules

The canonicalizer will enforce these validation rules:

```text
status = 'officially_assigned'
  ✅ REQUIRED: alpha2, alpha3, name_english, name_french
  ⚠️  OPTIONAL: alpha4, numeric, start_date, end_date, remarks

status = 'exceptionally_reserved' OR 'indeterminately_reserved'
  ✅ REQUIRED: alpha2, name_english, remarks
  ⚠️  OPTIONAL: start_date, end_date

status = 'transitionally_reserved'
  ✅ REQUIRED: alpha2, name_english, remarks
  ⚠️  OPTIONAL: start_date, end_date

status = 'formerly_used'
  🚫 SKIP: Do not insert into database
  📝 LOG: Record skipped for audit trail

status = 'unassigned'
  ✅ REQUIRED: alpha2
  ⚠️  OPTIONAL: remarks
```

## Consequences

### Positive

- ✅ Simple, clean schema with `alpha2` as PRIMARY KEY
- ✅ No data conflicts from reused codes
- ✅ Fast lookups for operational queries
- ✅ Reduced storage (no historical codes)
- ✅ Validation still performed on all CSV rows
- ✅ Audit trail captures what was skipped

### Negative

- ❌ Cannot query historical code assignments (e.g., "What was GE in 1980?")
- ⚠️  If historical tracking is required later, must implement separate table

### Neutral

- 🔄 CSV may contain formerly_used codes that won't appear in database
- 📊 Monitoring should track skipped row counts

## Implementation Checklist

- [ ] Add `remarks TEXT` column to `reference.countries` table
- [ ] Update schema to make `alpha3` and `numeric` nullable (required only for some statuses)
- [ ] Remove UNIQUE constraints on `alpha3` and `numeric` (multiple unassigned codes may share NULL)
- [ ] Add CHECK constraints for status-specific field requirements
- [ ] Update canonicalizer to validate status-specific rules
- [ ] Update canonicalizer to skip `formerly_used` records
- [ ] Add logging for skipped records (with alpha2, name, reason)
- [ ] Update `country.go` model to include `remarks` field
- [ ] Update tests to cover all six status types
- [ ] Update documentation (README, TESTING.md)

## Notes

- ISO 3166-1 Maintenance Agency publishes updates several times per year
- Reserved codes (exceptionally, transitionally, indeterminately) are actively used:
  - `EU` = European Union (exceptionally reserved for ISO 6166)
  - `UK` = United Kingdom (transitionally reserved, common usage instead of GB)
  - Many others for UN regions, customs unions, etc.
- Unassigned codes exist (e.g., two-letter combinations not yet allocated)

## Related ADRs

- [ADR-002: PostgreSQL for Data Persistence](002-postgresql-for-data-persistence.md)
- [ADR-003: Schema-Based Database Isolation](003-schema-based-database-isolation.md)
- [ADR-006: Audit Trail for Reference Data Provenance](006-audit-trail-for-provenance.md)
