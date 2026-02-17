# LEI Data Processing - Known Issues

## SuccessorEntity Array Parsing Failure

**Status**: Active Issue  
**Impact**: ~94,000 records fail during processing (~3% of total 3.2M records)  
**Severity**: Medium - Records fail silently but are counted in failed_records

### Issue Description

Some LEI records in the GLEIF dataset have `SuccessorEntity` as an **array** instead of a single object, causing JSON unmarshaling failures.

**Error Message**:
```
json: cannot unmarshal array into Go struct field LEIEntity.Entity.SuccessorEntity of type service.LEISuccessorEntity
```

### Current Behavior

- Records with array-type `SuccessorEntity` fail to parse
- Failed records are counted in `source_files.failed_records`
- No error details stored (only logged)
- Processing continues with remaining records

### Example Failure Log
```json
{
  "level": "error",
  "error": "json: cannot unmarshal array into Go struct field LEIEntity.Entity.SuccessorEntity of type service.LEISuccessorEntity",
  "record_number": 2969543,
  "time": 1771331444,
  "caller": "/app/internal/service/lei_service.go:721",
  "message": "Failed to decode LEI JSON record"
}
```

### Root Cause

**Expected Data Structure (Our Code)**:
```go
type LEIEntity struct {
    SuccessorEntity LEISuccessorEntity `json:"SuccessorEntity"`
    // ... other fields
}

type LEISuccessorEntity struct {
    LEI        string `json:"LEI"`
    EntityName string `json:"EntityName"`
}
```

**Actual GLEIF Data (Some Records)**:
```json
{
  "Entity": {
    "SuccessorEntity": [
      {
        "LEI": "549300ABCDEF1234567890",
        "EntityName": "Successor Company 1"
      },
      {
        "LEI": "549300GHIJK9876543210",
        "EntityName": "Successor Company 2"
      }
    ]
  }
}
```

### Proposed Solution

Update the Go struct to handle both single object and array:

```go
type LEIEntity struct {
    // Change from single struct to pointer to array
    SuccessorEntity []LEISuccessorEntity `json:"SuccessorEntity"`
    // ... other fields
}
```

**Implementation Steps**:
1. Update `LEISuccessorEntity` field to accept array in `internal/service/lei_service.go`
2. Update database schema to store JSON array in `lei_records.successor_entity` (currently VARCHAR)
3. Update parsing logic to handle multiple successors
4. Consider using custom unmarshaler for backward compatibility
5. Add test cases for both single and array successor entities

### Workaround

Current workaround: None - records with array successors are skipped.

**Business Impact**: 
- Entities with multiple successors are not tracked
- Represents ~3% of total LEI database
- Most entities have single or no successors, so impact is limited

### Tracking

- Database query to check failed records:
  ```sql
  SELECT file_name, total_records, processed_records, failed_records 
  FROM lei_raw.source_files 
  WHERE failed_records > 0 
  ORDER BY created_at DESC;
  ```

- Log pattern to search:
  ```bash
  docker logs axiom-dev-backend 2>&1 | grep "SuccessorEntity"
  ```

### Related Code

- **Parsing Logic**: `backend/internal/service/lei_service.go:721`
- **Data Model**: `backend/internal/service/lei_service.go` (LEIEntity struct)
- **Database Table**: `lei_raw.lei_records.successor_entity`

### Last Observed

- **Date**: February 17, 2026
- **File**: `lei-FULL-20260217-114706.json.zip`
- **Total Records**: 2,908,000
- **Failed Records**: 94,340 (~3.2%)
- **Success Rate**: 96.8%

---

**Note**: This issue does not block processing and the system continues to function correctly for 96.8% of records. However, fixing this would provide complete LEI coverage including entities with multiple successors.
