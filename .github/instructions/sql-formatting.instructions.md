# SQL Formatting Guidelines for Axiom

## Core Principles

These rules are enforced by SQLFluff and should be followed when writing SQL code.

## Layout Rules

### Indentation (LT02)
- **NO indentation at root level**: Top-level SQL statements (ALTER, CREATE, DROP, etc.) start at column 1
- **Use 4 spaces** for nested indentation (within parentheses, subqueries, etc.)
- **DO NOT use tabs** - always use spaces
- **Continuation lines in top-level WHERE clauses must also start at column 1** when SQLFluff enforces LT02
- **Inside parenthesized boolean groups**, indent each predicate by exactly **4 spaces**

```sql
-- ✅ GOOD: Top-level WHERE continuation at column 1
CREATE INDEX idx_example_top_level
ON lei_raw.lei_records (BTRIM(entity_legal_form))
WHERE deleted_at IS NULL
AND entity_legal_form IS NOT NULL
AND BTRIM(entity_legal_form) <> '';

-- ✅ GOOD: Nested boolean group uses 4-space indentation
CREATE INDEX idx_example_nested
ON lei_raw.lei_records (legal_name)
WHERE deleted_at IS NULL
AND (
    entity_status IS NULL
    OR BTRIM(entity_status) = ''
    OR UPPER(BTRIM(entity_status)) = 'NULL'
);
```

```sql
-- ❌ BAD: Indented root level
    ALTER TABLE lei_raw.source_files
        ADD COLUMN retry_count INTEGER;

-- ✅ GOOD: No indentation at root level
ALTER TABLE lei_raw.source_files
    ADD COLUMN retry_count INTEGER;

-- ❌ BAD: Indented continuation predicates at top level
CREATE INDEX idx_example
ON lei_raw.lei_records (BTRIM(entity_legal_form))
WHERE deleted_at IS NULL
    AND entity_legal_form IS NOT NULL
    AND BTRIM(entity_legal_form) <> '';

-- ✅ GOOD: Continuation predicates aligned at column 1
CREATE INDEX idx_example
ON lei_raw.lei_records (BTRIM(entity_legal_form))
WHERE deleted_at IS NULL
AND entity_legal_form IS NOT NULL
AND BTRIM(entity_legal_form) <> '';
```

### Trailing Whitespace (LT01)
- **NO trailing whitespace** at end of lines
- SQLFluff will automatically remove them

### Line Length (LT05)
- Maximum 120 characters per line
- Break long lines at natural boundaries (commas, operators)

### Spacing (LT01)
- **Single space** between identifier and opening parenthesis
- **Single space** after commas in lists
- **Touch** before semicolons (no space)
- **Touch** before commas (no space)

```sql
-- ❌ BAD: No space before parenthesis
CREATE INDEX idx_name ON table(column);

-- ✅ GOOD: Single space before parenthesis
CREATE INDEX idx_name ON table (column);
```

## Capitalization Rules

### Keywords (CP01, CP02)
- **UPPERCASE** for all SQL keywords: SELECT, FROM, WHERE, CREATE, ALTER, etc.

```sql
-- ❌ BAD: Lowercase keywords
select * from users where id = 1;

-- ✅ GOOD: Uppercase keywords
SELECT * FROM users WHERE id = 1;
```

### Identifiers (CP01)
- **lowercase** for table names, column names, schema names
- Use underscores for multi-word names: `legal_address_country`

```sql
-- ❌ BAD: Mixed case identifiers
CREATE TABLE UserAccounts (UserID INT);

-- ✅ GOOD: Lowercase identifiers
CREATE TABLE user_accounts (user_id INT);
```

### Functions (CP03)
- **UPPERCASE** for function names: NOW(), GEN_RANDOM_UUID(), COALESCE()

```sql
-- ❌ BAD: Lowercase function
created_at TIMESTAMP NOT NULL DEFAULT now()

-- ✅ GOOD: Uppercase function
created_at TIMESTAMP NOT NULL DEFAULT NOW()
```

### Data Types (CP04)
- **UPPERCASE** for data types: INTEGER, VARCHAR, UUID, TIMESTAMP

```sql
-- ❌ BAD: Lowercase types
id uuid PRIMARY KEY,
name varchar(100)

-- ✅ GOOD: Uppercase types
id UUID PRIMARY KEY,
name VARCHAR(100)
```

### Literals (CP04)
- **UPPERCASE** for NULL, TRUE, FALSE

```sql
-- ❌ BAD: Lowercase literals
WHERE deleted_at IS null

-- ✅ GOOD: Uppercase literals
WHERE deleted_at IS NULL
```

## Structure Rules

### Statement Terminators (LT08)
- **Always end statements** with semicolons
- **No space** before semicolon (touch)

```sql
-- ❌ BAD: No semicolon
CREATE TABLE users (id INTEGER)

-- ✅ GOOD: With semicolon
CREATE TABLE users (id INTEGER);
```

### Comma Placement
- **Trailing commas** (commas at end of line)
- **No space** before comma
- **Single space** after comma

```sql
-- ❌ BAD: Leading commas
CREATE TABLE users (
    id UUID
    , name VARCHAR(100)
    , email VARCHAR(255)
);

-- ✅ GOOD: Trailing commas
CREATE TABLE users (
    id UUID,
    name VARCHAR(100),
    email VARCHAR(255)
);
```

### Multi-line Format
```sql
-- ✅ GOOD: Property formatting for multi-line
ALTER TABLE lei_raw.source_files
    ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN max_retries INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN failure_category VARCHAR(50);
```

## Naming Conventions

### Tables
- Lowercase, plural nouns
- Use underscores for compound names
- Examples: `users`, `lei_records`, `source_files`

### Columns
- Lowercase, descriptive names
- Use underscores for compound names
- Suffix foreign keys with `_id`
- Examples: `user_id`, `legal_name`, `created_at`

### Indexes
- Prefix with `idx_`
- Include table name and column(s)
- Examples: `idx_users_email`, `idx_lei_records_lei`

### Constraints
- Primary keys: Let database auto-name or use `pk_tablename`
- Foreign keys: `fk_table1_table2` or let database auto-name
- Unique: `uq_tablename_column`

## Comments

### Block Comments
```sql
-- Multi-line comment explaining
-- complex logic or business rules
-- that need clarification
```

### Inline Comments
```sql
CREATE TABLE users (
    id UUID,  -- Unique identifier
    created_at TIMESTAMP  -- Record creation time
);
```

### COMMENT Statements
```sql
COMMENT ON COLUMN source_files.retry_count IS 
'Number of times this file processing has been retried';
```

## Quick Reference

| Rule | Requirement | Example |
| ------ | ------------- | --------- |
| LT01 | No trailing whitespace | `WHERE id = 1` (not `WHERE id = 1  `) |
| LT02 | No root-level indentation | `ALTER TABLE` starts at column 1 |
| LT05 | Max 120 chars per line | Break long lines at commas |
| LT08 | End with semicolon | `SELECT 1;` |
| CP01 | Keywords UPPERCASE | `SELECT FROM WHERE` |
| CP01 | Identifiers lowercase | `user_id`, `table_name` |
| CP03 | Functions UPPERCASE | `NOW()`, `UUID()` |
| CP04 | Types UPPERCASE | `INTEGER`, `VARCHAR` |
| CP04 | Literals UPPERCASE | `NULL`, `TRUE`, `FALSE` |
| RF04 | Avoid keyword names | Don't use `user`, `order` as identifiers |

## Required SQL Validation Workflow

When editing any `.sql` file (especially migrations), follow this workflow before commit:

1. **Lint check is mandatory**
    - Run: `sqlfluff lint backend/migrations/*.sql`
    - Or verify no SQLFluff diagnostics remain in VS Code Problems panel.

2. **Fix lint issues in the same change**
    - Prefer deterministic formatting fixes immediately after SQL edits.
    - Do not leave LT02/LT01/LT08 issues for follow-up commits.

3. **Re-check after fixes**
    - Re-run lint/diagnostics and confirm clean output for changed SQL files.

4. **Do not commit SQL with known SQLFluff errors**
    - SQL formatting compliance is part of the definition of done.

## Database Documentation with COMMENT ON

### **MANDATORY**: Every table and column MUST have a COMMENT

**Why This Matters:**
- Database schema serves as living documentation
- SQL tools and ORMs display comments in autocomplete
- DBAs and developers can understand purpose without reading code
- Comments are visible in `psql \d+` and database IDE tools

### Table Comments
Every table MUST have a descriptive comment explaining its purpose:

```sql
CREATE TABLE lei_raw.lei_records (
    id UUID PRIMARY KEY,
    lei VARCHAR(20) NOT NULL UNIQUE
    -- ... columns ...
);

COMMENT ON TABLE lei_raw.lei_records IS 
'Raw LEI (Legal Entity Identifier) data from GLEIF. Contains entity legal names, addresses, registration details, and validation status for all global legal entities.';
```

### Column Comments
Every column MUST have a comment describing:
- **Purpose**: What the column stores
- **Format**: Data format or constraints (if not obvious from type)
- **Source**: Where data comes from (if external)
- **Business Rules**: Any validation rules or special meanings

```sql
COMMENT ON COLUMN lei_raw.lei_records.lei IS 
'20-character Legal Entity Identifier code (ISO 17442 standard). Unique global identifier for legal entities.';

COMMENT ON COLUMN lei_raw.lei_records.legal_address_country IS 
'ISO 3166-1 alpha-2 country code (2 letters). Legal registered address country.';

COMMENT ON COLUMN lei_raw.lei_records.entity_status IS 
'Current status of the legal entity: ACTIVE, INACTIVE, MERGED, etc. From GLEIF EntityStatus enumeration.';

COMMENT ON COLUMN lei_raw.lei_records.other_names IS 
'JSONB array of alternate entity names. Each object contains: name, type (PREVIOUS_LEGAL_NAME, TRADING_NAME, etc.), and language code.';

COMMENT ON COLUMN lei_raw.source_files.processing_status IS 
'File processing lifecycle status: PENDING (queued), IN_PROGRESS (actively processing), COMPLETED (success), FAILED (error occurred).';

COMMENT ON COLUMN lei_raw.source_files.failure_category IS 
'Categorized failure reason (only set when processing_status=FAILED): SCHEMA_ERROR, NETWORK_ERROR, FILE_CORRUPTION, FILE_MISSING, TIMEOUT, or UNKNOWN. Empty string for non-failed records.';
```

### When to Write Comments

**In CREATE TABLE migrations:**
```sql
CREATE TABLE example (
    id UUID PRIMARY KEY,
    status VARCHAR(20)
);

-- Add comments immediately after CREATE TABLE
COMMENT ON TABLE example IS 'Description of table purpose';
COMMENT ON COLUMN example.id IS 'Unique identifier (UUID v4)';
COMMENT ON COLUMN example.status IS 'Status values: ACTIVE, PAUSED, DELETED';
```

**In ALTER TABLE migrations:**
```sql
ALTER TABLE example
    ADD COLUMN retry_count INTEGER DEFAULT 0;

-- Add comment for new column
COMMENT ON COLUMN example.retry_count IS 'Number of retry attempts (0-3). Incremented on FAILED status; reset to 0 on success.';
```

### Comment Style Guide

✅ **GOOD Comments:**
- Start with what the field stores
- Include format/constraints
- Mention enumerations or valid values
- Note relationships to other tables
- Explain business rules

❌ **BAD Comments (too vague):**
```sql
COMMENT ON COLUMN users.email IS 'Email';  -- Says nothing useful
COMMENT ON COLUMN lei_records.lei IS 'LEI code';  -- What's an LEI?
```

✅ **GOOD Comments (descriptive):**
```sql
COMMENT ON COLUMN users.email IS 'User email address (RFC 5322 format). Must be unique. Used for login and notifications.';
COMMENT ON COLUMN lei_records.lei IS '20-character Legal Entity Identifier (ISO 17442). Format: 18 alphanumeric + 2-digit checksum. Globally unique.';
```

### Migration Checklist

When creating a migration that adds/modifies schema:

- [ ] Every new table has a COMMENT ON TABLE
- [ ] Every new column has a COMMENT ON COLUMN
- [ ] Comments explain PURPOSE, not just restating the column name
- [ ] Enumerations list all valid values
- [ ] Foreign keys mention the referenced table
- [ ] JSONB columns describe the expected structure
- [ ] Constraints are explained (why this length? why nullable?)

## Auto-Formatting

Always run SQLFluff before committing:

```bash
# Check files
sqlfluff lint backend/migrations/*.sql

# Auto-fix issues
sqlfluff fix backend/migrations/*.sql

# Fix without prompts
sqlfluff fix backend/migrations/*.sql --force
```

## SQLFluff Configuration

The project's `.sqlfluff` file enforces all these rules automatically:
- PostgreSQL dialect
- 4-space indentation
- 120-character line length
- Trailing comma style
- UPPERCASE keywords, functions, types, literals
- lowercase identifiers

## Pre-commit Hook (Recommended)

Add to `.git/hooks/pre-commit`:
```bash
#!/bin/bash
sqlfluff lint backend/migrations/*.sql
if [ $? -ne 0 ]; then
    echo "SQLFluff linting failed. Run: sqlfluff fix backend/migrations/*.sql"
    exit 1
fi
```

---

**Remember**: When writing SQL migration files, always start with:
1. No indentation at root level
2. UPPERCASE keywords/functions/types
3. lowercase identifiers
4. Trailing commas
5. No trailing whitespace
6. Semicolons at end

Run `sqlfluff fix` to auto-correct most issues!
