# Axiom Data Pipeline Architecture

## Overview

```mermaid
flowchart TB
    CSV[CSV Files<br/>countries.csv]
    JSON[csv2json Service<br/>Format Converter]
    MQ[RabbitMQ<br/>Message Queue]
    CANON[canonicalizer Service<br/>Business Rules Engine]
    DB[(PostgreSQL<br/>Axiom Database)]
    API[Countries Service<br/>HTTP API]
    
    CSV -->|raw data| JSON
    JSON -->|JSON messages| MQ
    MQ -->|dequeue| CANON
    CANON -->|standardized data| MQ
    MQ -->|insert| API
    API -->|persist| DB
    
    style CSV fill:#2d3748,stroke:#4a5568,color:#e2e8f0
    style JSON fill:#2c5282,stroke:#3182ce,color:#e2e8f0
    style MQ fill:#553c9a,stroke:#6b46c1,color:#e2e8f0
    style CANON fill:#2f855a,stroke:#48bb78,color:#e2e8f0
    style DB fill:#744210,stroke:#d69e2e,color:#e2e8f0
    style API fill:#9c4221,stroke:#dd6b20,color:#e2e8f0
```

## Layer Responsibilities

### 1. csv2json (Format Converter)

**Purpose**: Convert CSV files to JSON messages for RabbitMQ

**Does**:

- ✅ Read CSV files
- ✅ Convert rows to JSON objects
- ✅ Wrap in message envelope (domain, entity, timestamp)
- ✅ Publish to RabbitMQ exchange

**Does NOT**:

- ❌ Transform data values
- ❌ Validate data
- ❌ Apply business rules
- ❌ Clean or normalize data

**Input**:

```csv
English short name,French short name,Alpha-2 code,Alpha-3 code,Numeric
Afghanistan,Afghanistan (l'),AF,AFG,4
```

**Output** (exactly as received):

```json
{
  "domain": "reference",
  "entity": "countries",
  "timestamp": "2026-01-26T10:30:00Z",
  "source": "csv2json",
  "payload": {
    "English short name": "Afghanistan",
    "French short name": "Afghanistan (l')",
    "Alpha-2 code": "AF",
    "Alpha-3 code": "AFG",
    "Numeric": "4"
  }
}
```

**Note**: Numeric is `"4"` (as in CSV), not `"004"`

---

### 2. RabbitMQ (Message Queue)

**Purpose**: Decouple csv2json from canonicalizer

**Does**:

- ✅ Queue messages for processing
- ✅ Handle backpressure
- ✅ Provide delivery guarantees
- ✅ Dead-letter queue for failures

**Does NOT**:

- ❌ Modify messages
- ❌ Validate data
- ❌ Transform content

---

### 3. canonicalizer (Business Rules Engine)

**Purpose**: Apply ALL data transformations and business rules

**Does**:

- ✅ **Pad numeric codes**: `"4"` → `"004"`
- ✅ **Normalize case**: `"us"` → `"US"`
- ✅ **Trim whitespace**: `" France "` → `"France"`
- ✅ **Transform aliases**: `"officially assigned"` → `"officially_assigned"` (space to underscore)
- ✅ **Validate data**: Check required fields, formats, constraints
- ✅ **Reject invalid data**: Missing required fields → reject record
- ✅ **Map field names**: `"Alpha-2 code"` → `"alpha2"`
- ✅ **Standardize data**: Ensure consistency across all sources

**Does NOT**:

- ❌ Just pass data through
- ❌ Trust incoming data is correct

**Input** (from csv2json):

```json
{
  "Numeric": "4",
  "Alpha-2 code": "af"
}
```

**Output** (standardized):

```json
{
  "numeric": "004",
  "alpha2": "AF"
}
```

**Critical**: This is the **ONLY** place business rules are applied. All transformation logic lives here.

---

### 4. PostgreSQL (Data Persistence + Safety Net)

**Purpose**: Store canonical data and enforce final constraints

**Does**:

- ✅ Store validated data
- ✅ Enforce database constraints (safety net)
- ✅ Provide ACID guarantees
- ✅ Reject invalid data that bypasses canonicalizer

**Does NOT**:

- ❌ Transform data (that's canonicalizer's job)
- ❌ Should rarely reject data (canonicalizer validates first)

**Constraints**:

```sql
CONSTRAINT numeric_format CHECK (numeric ~ '^[0-9]{3}$')
```

If canonicalizer works correctly, this should never fail in production.

---

## Data Flow Example

### Scenario: CSV contains `"4"` for Afghanistan's numeric code

```mermaid
flowchart LR
    A[CSV<br/>Numeric: 4]
    B[csv2json<br/>Numeric: 4]
    C[canonicalizer<br/>4 → 004]
    D[PostgreSQL<br/>Numeric: 004]
    
    A -->|format only| B
    B -->|queue| C
    C -->|insert| D
    
    style A fill:#2d3748,stroke:#4a5568,color:#e2e8f0
    style B fill:#2c5282,stroke:#3182ce,color:#e2e8f0
    style C fill:#2f855a,stroke:#48bb78,color:#e2e8f0
    style D fill:#744210,stroke:#d69e2e,color:#e2e8f0
```

**Key Points**:

1. CSV contains raw data: `"4"`
2. csv2json preserves it: `"4"` in JSON
3. **canonicalizer transforms it**: `"4"` → `"004"`
4. PostgreSQL stores canonical form: `"004"`

---

## Why This Architecture?

```mermaid
graph TB
    subgraph "Separation of Concerns"
        C1[csv2json<br/>Format Conversion]
        C2[canonicalizer<br/>Business Rules]
        C3[PostgreSQL<br/>Persistence]
    end
    
    subgraph "Benefits"
        B1[Single Point of Truth<br/>All rules in canonicalizer]
        B2[Flexibility<br/>Any input format]
        B3[Testability<br/>Easy to test each layer]
    end
    
    C1 -.-> B2
    C2 -.-> B1
    C2 -.-> B3
    C3 -.-> B3
    
    style C1 fill:#2c5282,stroke:#3182ce,color:#e2e8f0
    style C2 fill:#2f855a,stroke:#48bb78,color:#e2e8f0
    style C3 fill:#744210,stroke:#d69e2e,color:#e2e8f0
    style B1 fill:#1a365d,stroke:#2c5282,color:#e2e8f0
    style B2 fill:#1a365d,stroke:#2c5282,color:#e2e8f0
    style B3 fill:#1a365d,stroke:#2c5282,color:#e2e8f0
```

## Adding New Rules

```mermaid
flowchart LR
    Q{Need new<br/>transformation?}
    W[❌ Don't modify<br/>csv2json]
    R[✅ Add rule to<br/>canonicalizer]
    D[✅ Document in<br/>canonicalizer-rules.md]
    T[✅ Add test case]
    C[✅ Optional:<br/>DB constraint]
    
    Q --> W
    Q --> R
    R --> D
    D --> T
    T --> C
    
    style Q fill:#553c9a,stroke:#6b46c1,color:#e2e8f0
    style W fill:#742a2a,stroke:#e53e3e,color:#e2e8f0
    style R fill:#2f855a,stroke:#48bb78,color:#e2e8f0
    style D fill:#2f855a,stroke:#48bb78,color:#e2e8f0
    style T fill:#2f855a,stroke:#48bb78,color:#e2e8f0
    style C fill:#2f855a,stroke:#48bb78,color:#e2e8f0
```

**Wrong**: Add transformation to csv2json  
**Right**: Add transformation to canonicalizer + document in `canonicalizer-rules.md`

**Example**: Need to uppercase country codes?

1. ❌ Don't modify csv2json
2. ✅ Add rule to canonicalizer
3. ✅ Document in `docs/canonicalizer-rules.md`
4. ✅ Add test case
5. ✅ (Optional) Add database constraint as safety net

---

### Separation of Concerns

- **csv2json**: One job - format conversion (reusable for any CSV)
- **canonicalizer**: One job - business rules (domain-specific)
- **PostgreSQL**: One job - persistence (data integrity)

### Single Point of Truth

- **All** business rules in canonicalizer
- Easy to find, test, and maintain
- No "which layer handles this?" confusion

### Flexibility

- Can replace csv2json with json2json, xml2json, api2json
- canonicalizer handles all transformations regardless of source
- Business rules independent of input format

### Testability

- csv2json: Test format conversion only
- canonicalizer: Test transformations and business rules
- Database: Test constraints

---

## Adding New Rules

**Wrong**: Add transformation to csv2json
**Right**: Add transformation to canonicalizer + document in `canonicalizer-rules.md`

**Example**: Need to uppercase country codes?

1. ❌ Don't modify csv2json
2. ✅ Add rule to canonicalizer
3. ✅ Document in `docs/canonicalizer-rules.md`
4. ✅ Add test case
5. ✅ (Optional) Add database constraint as safety net
