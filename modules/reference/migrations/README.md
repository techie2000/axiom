# Database Migrations

This directory contains SQL migration files for the Axiom reference schema (countries, currencies, etc.).

## Directory Structure

```
migrations/
├── init/                                        # Docker initialization (copies of .up.sql + standalone)
│   ├── 000_create_migration_tracking.sql
│   ├── 001_create_countries_table.up.sql
│   ├── 002_create_countries_audit_table.up.sql
│   └── ...
├── 000_create_migration_tracking.sql            # Source of truth
├── 001_create_countries_table.up.sql            # Forward migration (CREATE)
├── 001_create_countries_table.down.sql          # Rollback migration (DROP)
├── 002_create_countries_audit_table.up.sql
├── 002_create_countries_audit_table.down.sql
└── ...
```

**Key Points:**

- **Parent folder**: Source of truth for all migrations
- **init/ folder**: Hard links to forward migrations for Docker's automatic initialization
  - **Hard links** (not copies) ensure files stay in sync - editing one updates both
  - Only `.up.sql` and standalone `.sql` files are linked (NOT `.down.sql` files)
- **`.up.sql` files**: Forward migrations (apply changes)
- **`.down.sql` files**: Rollback migrations (undo changes) - NOT linked to init/
- **Standalone `.sql` files**: Migrations without rollback versions

## Migration System

Migrations are tracked in the `reference.schema_migrations` table.

### Fresh Database Initialization (Docker)

When PostgreSQL container starts with empty `data/postgres/`:
1. PostgreSQL automatically runs all `.sql` files in `/docker-entrypoint-initdb.d/` (alphabetically)
2. This is mapped to `./modules/reference/migrations/init/` in docker-compose.yml
3. All migrations are applied automatically

**No manual action needed** - just start docker-compose with clean data folder.

### Applying Migrations to Existing Database

For existing databases, apply migrations manually:

```bash
# Apply a single migration
docker exec axiom-postgres psql -U axiom -d axiom_db -f /docker-entrypoint-initdb.d/005_fix_countries_exceptionally_reserved_validation.sql

# Then record it in schema_migrations table
docker exec axiom-postgres psql -U axiom -d axiom_db -c "
INSERT INTO reference.schema_migrations (version, description, installed_by, installed_on, execution_time_ms) 
VALUES ('005_fix_countries_exceptionally_reserved_validation', 'Fix exceptionally_reserved validation', 'axiom', NOW(), 0);"
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
2. **Create the migration file(s)** in the parent migrations/ folder:
   - For reversible changes: Create both `.up.sql` and `.down.sql` files
   - For one-way changes: Create standalone `.sql` file
3. **Write idempotent SQL** when possible (use `IF EXISTS`, `IF NOT EXISTS`)
4. **Create hard link in init/ folder** for Docker initialization:

   ```powershell
   # For .up.sql files
   New-Item -ItemType HardLink -Path ".\modules\reference\migrations\init\NNN_description.up.sql" -Target ".\modules\reference\migrations\NNN_description.up.sql"
   
   # For standalone .sql files
   New-Item -ItemType HardLink -Path ".\modules\reference\migrations\init\NNN_description.sql" -Target ".\modules\reference\migrations\NNN_description.sql"
   
   # DO NOT link .down.sql files - rollbacks not needed for fresh DB initialization
   ```

   **Why hard links?** Changes to either file automatically reflect in both - they're the same file on disk with two directory entries. This prevents files from getting out of sync.

5. **Test locally** before committing
6. **Document rationale** in comments at top of file
7. **Update this README** with the new migration in the Applied Migrations table

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

| Version | Description | Applied | In init/ |
|---------|-------------|---------|----------|
| 000 | Create migration tracking table | 2026-01-27 | ✅ |
| 001 | Create countries table | 2026-01-27 | ✅ |
| 002 | Create countries audit table | 2026-01-27 | ✅ |
| 003 | Add remarks column and relax constraints | 2026-01-27 | ✅ |
| 004 | Add remarks to audit table | 2026-01-27 | ✅ |
| 005 | Fix exceptionally_reserved validation | 2026-01-27 | ✅ |
| 006 | Remove alpha4 column from countries table | 2026-01-27 | ✅ |
| 007 | Remove alpha4 from audit trigger function | 2026-01-27 | ✅ |
| 008 | Remove alpha4 from update trigger function | 2026-01-27 | ✅ |

**Note**: "In init/" indicates the migration is included in Docker's automatic initialization for fresh databases.

## Troubleshooting

### Migration Failed

If a migration fails during Docker initialization:
1. **Check container logs**: `docker logs axiom-postgres`
2. **Fix the migration file** in migrations/ folder
3. **Update init/ folder** with corrected file
4. **Restart with clean database**:
   ```bash
   docker compose down
   Remove-Item -Recurse -Force .\data\postgres\*
   docker compose up -d
   ```

### Manually Apply Migration to Running Database

If you need to apply a migration to an existing database without restarting:

```bash
# 1. Copy migration to init/ if not already there
Copy-Item .\modules\reference\migrations\NNN_migration.sql .\modules\reference\migrations\init\

# 2. Apply the migration
docker exec axiom-postgres psql -U axiom -d axiom_db -f /docker-entrypoint-initdb.d/NNN_migration.sql

# 3. Record in schema_migrations table
docker exec axiom-postgres psql -U axiom -d axiom_db -c "
INSERT INTO reference.schema_migrations (version, description, installed_by, installed_on, execution_time_ms) 
VALUES ('NNN_migration_name', 'Description of change', 'axiom', NOW(), 0);"
```

### Check Migration Status

```sql
-- View all applied migrations
SELECT version, description, installed_on 
FROM reference.schema_migrations 
ORDER BY version;

-- Count applied migrations
SELECT COUNT(*) FROM reference.schema_migrations;
```

### Rollback a Migration

Use the corresponding `.down.sql` file (if it exists):

```bash
# Apply rollback
docker exec axiom-postgres psql -U axiom -d axiom_db -f /path/to/NNN_migration.down.sql

# Remove from tracking
docker exec axiom-postgres psql -U axiom -d axiom_db -c "
DELETE FROM reference.schema_migrations WHERE version = 'NNN_migration_name';"
```

**Note**: Not all migrations have `.down.sql` files - migrations 005-008 are one-way only.

---

**Last Updated:** January 28, 2026
