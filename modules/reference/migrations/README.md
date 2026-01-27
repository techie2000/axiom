# Database Migrations

This directory contains SQL migration files for the Axiom countries module database schema.

## Migration System

Migrations are tracked in the `reference.schema_migrations` table and managed by the PowerShell migration runner script.

### Running Migrations

```powershell
# Apply all pending migrations
.\scripts\run-migrations.ps1

# Dry run to see what would be applied
.\scripts\run-migrations.ps1 -DryRun

# Connect to remote database
.\scripts\run-migrations.ps1 -DBHost "remote.server" -DBPort 5432
```

### Migration Naming Convention

```
NNN_description_of_change.sql
```

- **NNN**: Three-digit sequence number (001, 002, 003, etc.)
- **description**: Snake_case description of what the migration does
- Include table name in description for clarity

**Examples:**
- `001_create_countries_table.up.sql`
- `006_remove_countries_alpha4_column.sql`
- `008_remove_countries_update_trigger_alpha4_references.sql`

### Creating New Migrations

1. **Determine the next sequence number** by checking existing migrations
2. **Create the migration file** with descriptive name
3. **Write idempotent SQL** when possible (use `IF EXISTS`, `IF NOT EXISTS`)
4. **Test locally** before committing
5. **Document rationale** in comments at top of file

**Migration Template:**

```sql
-- Migration NNN: Brief title
-- Rationale: Why this change is needed
-- Impact: What this affects (tables, triggers, functions, etc.)

-- Your SQL statements here
CREATE TABLE IF NOT EXISTS reference.new_table (
    id SERIAL PRIMARY KEY,
    ...
);
```

### Migration Tracking

The `reference.schema_migrations` table stores:
- `version`: Migration filename (e.g., "008_remove_countries_update_trigger_alpha4_references")
- `description`: Human-readable description
- `installed_by`: Database user who applied it
- `installed_on`: Timestamp of application
- `execution_time_ms`: How long it took to run
- `checksum`: SHA-256 hash for integrity verification

**View applied migrations:**

```sql
SELECT version, description, installed_on, execution_time_ms 
FROM reference.schema_migrations 
ORDER BY version;
```

### Migration Best Practices

#### ✅ DO

- **Make migrations idempotent** - safe to run multiple times
- **Use transactions implicitly** - PostgreSQL wraps DDL in transactions
- **Include rollback migrations** for major changes (.up and .down files)
- **Test migrations** on a copy of production data
- **Keep migrations small** - one logical change per migration
- **Document complex changes** with comments
- **Use explicit schema names** - `reference.countries` not just `countries`

#### ❌ DON'T

- **Don't modify applied migrations** - create a new one to fix issues
- **Don't use dynamic SQL** unless absolutely necessary
- **Don't skip sequence numbers** - maintain order
- **Don't combine unrelated changes** in one migration
- **Don't forget to update triggers** when changing table structure

### Common Migration Patterns

#### Adding a Column

```sql
ALTER TABLE reference.countries 
ADD COLUMN IF NOT EXISTS new_column VARCHAR(100);
```

#### Removing a Column

```sql
-- Migration: 00X_remove_countries_old_column.sql
ALTER TABLE reference.countries 
DROP COLUMN IF EXISTS old_column;

-- Also update related triggers/functions
CREATE OR REPLACE FUNCTION reference.audit_countries_changes()
-- ...remove references to old_column...
```

#### Creating an Index

```sql
CREATE INDEX IF NOT EXISTS idx_countries_new_field 
ON reference.countries(new_field);
```

#### Modifying a Constraint

```sql
-- Drop old constraint
ALTER TABLE reference.countries 
DROP CONSTRAINT IF EXISTS old_constraint_name;

-- Add new constraint
ALTER TABLE reference.countries 
ADD CONSTRAINT new_constraint_name 
CHECK (field_value > 0);
```

## Applied Migrations

| Version | Description | Applied |
|---------|-------------|---------|
| 000 | Create migration tracking table | 2026-01-27 |
| 001 | Create countries table | 2026-01-27 |
| 002 | Create countries audit table | 2026-01-27 |
| 003 | Add remarks column and relax constraints | 2026-01-27 |
| 004 | Add remarks to audit table | 2026-01-27 |
| 005 | Fix exceptionally_reserved validation | 2026-01-27 |
| 006 | Remove alpha4 column from countries table | 2026-01-27 |
| 007 | Remove alpha4 from audit trigger function | 2026-01-27 |
| 008 | Remove alpha4 from update trigger function | 2026-01-27 |

## Troubleshooting

### Migration Failed

If a migration fails:

1. **Check the error message** in the script output
2. **Verify database state** - what was partially applied?
3. **Fix the migration file** or create a new one
4. **Manually clean up** if needed:
   ```sql
   DELETE FROM reference.schema_migrations WHERE version = 'NNN_failed_migration';
   ```
5. **Re-run the migration**

### Migration Already Applied

The runner automatically skips applied migrations. To force re-run:

```sql
DELETE FROM reference.schema_migrations WHERE version = 'NNN_migration_name';
```

Then run the migration script again.

### Check Migration Status

```powershell
# See what's pending
.\scripts\run-migrations.ps1 -DryRun
```

```sql
-- In PostgreSQL
SELECT COUNT(*) as applied_migrations 
FROM reference.schema_migrations;
```

---

**Last Updated:** January 27, 2026
