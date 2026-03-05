# LEI Data Persistence & Race Condition Fixes

**Date:** February 11, 2026  
**Status:** ✅ Fixed and Implemented

## Issues Discovered

### 1. 🔴 Race Condition Between Full and Delta Sync

#### Problem

Both sync loops use separate status tracking ("DAILY_DELTA" vs "DAILY_FULL") and DON'T check each other. This means:

- Full sync (9 hours) could run while delta sync starts hourly
- Concurrent writes to same LEI records
- Potential database conflicts and data inconsistency

#### Root Cause

```go
// Delta sync only checked DAILY_DELTA status
status, _ := s.leiService.GetProcessingStatus("DAILY_DELTA")
if status.Status == "RUNNING" { return nil }

// Full sync only checked DAILY_FULL status  
status, _ := s.leiService.GetProcessingStatus("DAILY_FULL")
if status.Status == "RUNNING" { return nil }
```

#### Solution Implemented

Both functions now check EACH OTHER'S status before starting:

```go
// Delta sync now checks if full sync is running
fullStatus, _ := s.leiService.GetProcessingStatus("DAILY_FULL")
if fullStatus.Status == "RUNNING" {
    log.Warn().Msg("Full sync is running, skipping delta to prevent race")
    return nil
}

// Full sync now checks if delta sync is running
deltaStatus, _ := s.leiService.GetProcessingStatus("DAILY_DELTA")
if deltaStatus.Status == "RUNNING" {
    log.Warn().Msg("Delta sync is running, skipping full to prevent race")
    return nil
}
```

### 2. 🔴 LEI Data Files Not Persisted (Lost on Container Rebuild)

#### Problem

- Downloaded LEI files stored in `/root/data/lei/` inside container
- NO volume mount = **26GB of data lost on rebuild**
- Files found in container:

  ```text
  /root/data/lei/:
  - lei-FULL-20260211-134938.json.zip (866.9MB)
  - lei-FULL-20260211-134938.json (11.9GB extracted)
  - lei-DELTA-20260211-133011.json.zip (13.1MB)
  ```

- User expected files in `./data/lei` but saw nothing (files are container-only)

#### Solution Implemented

Added Docker volume mount for data persistence:

Configuration in **docker-compose.dev.yml**:

```yaml
backend:
  environment:
    LEI_DATA_DIR: ${LEI_DATA_DIR}  # NEW: Environment variable
  volumes:
    - lei_data_dev:/root/data/lei  # NEW: Volume mount
  
volumes:
  lei_data_dev:  # NEW: Named volume for LEI data
```

> **Note:** Postgres no longer uses a named volume in dev. It uses a bind mount at
> `./data/dev/postgres` on the host, giving you direct filesystem access to the database files.

Environment variable in **.env.dev**:

```env
LEI_DATA_DIR=/root/data/lei
```

Code changes in **backend/cmd/api/main.go**:

```go
// NEW: Read from environment variable with fallback
leiDataDir := os.Getenv("LEI_DATA_DIR")
if leiDataDir == "" {
    leiDataDir = "./data/lei"
}
```

### 3. ✅ Database Persistence (Already Working)

#### Status

Database already has proper persistence. In dev it uses a **bind mount**:

```yaml
volumes:
  - ./data/dev/postgres:/var/lib/postgresql/data
```

Database survives container rebuilds. ✅

## Files Modified

### Code Changes

1. **backend/internal/service/scheduler_service.go**
   - Added cross-check for concurrent sync prevention
   - `RunDailyDeltaSync()`: Check DAILY_FULL status
   - `RunDailyFullSync()`: Check DAILY_DELTA status

2. **backend/cmd/api/main.go**
   - Read `LEI_DATA_DIR` from environment variable
   - Fallback to `./data/lei` if not set

### Configuration Changes (Storage Strategy)

#### Development Environment (Bind Mounts)

1. **docker-compose.dev.yml**

- Added `LEI_DATA_DIR` environment variable
- Changed to `./data/lei:/root/data/lei` **bind mount** (direct filesystem access)
- ✅ Files visible in VS Code and Windows Explorer
- ✅ Easy debugging and inspection

1. **.env.dev**
   - Added `LEI_DATA_DIR=/root/data/lei`

#### UAT/Production Environments (Docker Volumes)

1. **docker-compose.uat.yml**

- Added `LEI_DATA_DIR` environment variable
- Added `lei_data_uat:/root/data/lei` **volume mount** (better performance)
- Created `lei_data_uat` named volume

1. **.env.uat**
   - Added `LEI_DATA_DIR=/root/data/lei`

2. **docker-compose.prod.yml**
   - Added `LEI_DATA_DIR` environment variable
   - Added `lei_data_prod:/root/data/lei` **volume mount** (better performance)
   - Created `lei_data_prod` named volume

3. **.env.prod**
   - Added `LEI_DATA_DIR=/root/data/lei`

### Storage Strategy Summary

| Environment | Storage Type   | Location                     | Rationale                                     |
| ----------- | -------------- | ---------------------------- | --------------------------------------------- |
| **dev**     | Bind Mount     | `./data/dev/postgres` on host | Direct filesystem access for easy inspection  |
| **dev LEI** | Bind Mount     | `./data/lei` on host         | Easy debugging, file inspection in VS Code    |
| **uat**     | Docker Volume  | Docker-managed               | Better performance, production-like           |
| **prod**    | Docker Volume  | Docker-managed               | Best performance, isolation, reliability      |

## Testing & Verification

### Current Status

- **Full sync in progress:** 39,657+ records processed (out of 3.2M)
- **Files persisted in volume:** `lei_data_dev` Docker volume
- **Database persisted:** `./data/dev/postgres` bind mount (host directory)

### Testing After Container Rebuild

To verify persistence works:

```powershell
# 1. Check current record count
docker exec axiom-dev-postgres psql -U axiom -d axiom_dev -c "SELECT COUNT(*) FROM lei_raw.lei_records;"

# 2. Rebuild backend container (volume persists)
docker-compose --env-file .env.dev -f docker-compose.dev.yml up -d --build backend

# 3. Verify records still exist
docker exec axiom-dev-postgres psql -U axiom -d axiom_dev -c "SELECT COUNT(*) FROM lei_raw.lei_records;"

# 4. Verify files persist in volume
docker exec axiom-dev-backend ls -lh /root/data/lei/

# 5. Check logs for race condition prevention
docker logs axiom-dev-backend 2>&1 | Select-String "skipping.*to prevent race"
```

### Race Condition Testing

To test race condition prevention:

```powershell
# 1. Start full sync (will take ~9 hours)
# Already running in your case

# 2. Wait for hourly delta sync to trigger
# Check logs for prevention message:
docker logs axiom-dev-backend 2>&1 | Select-String "Full sync is running, skipping delta"
```

Expected log:

```json
{"level":"warn","message":"Full sync is running, skipping delta sync to prevent race condition"}
```

## Benefits

### Data Persistence

- ✅ Downloaded LEI files survive container rebuilds
- ✅ No need to re-download 909MB files after restart
- ✅ Resume capability preserved (files + database both persist)
- ✅ Development workflow improved (faster restarts)

### Race Condition Prevention

- ✅ No concurrent full/delta sync execution
- ✅ Data consistency maintained
- ✅ Database write conflicts prevented
- ✅ Clear logging when sync is skipped

### Multi-Environment Support

- ✅ Consistent configuration across dev/uat/prod
- ✅ Each environment has isolated volumes
- ✅ Environment-specific data directories
- ✅ Production-ready configuration

## Volume Management

### Viewing Volumes

```powershell
# List all volumes
docker volume ls | Select-String "axiom"

# Inspect volume details
docker volume inspect axiom-dev_lei_data_dev

# Check volume size
docker system df -v | Select-String "lei_data"
```

### Backup Volumes

```powershell
# Backup LEI data volume
docker run --rm -v axiom-dev_lei_data_dev:/data -v ${PWD}:/backup alpine tar czf /backup/lei-data-backup.tar.gz /data

# Backup database (bind mount — just copy the host directory)
tar czf postgres-backup.tar.gz ./data/dev/postgres
```

### Restore Volumes

```powershell
# Restore LEI data volume
docker run --rm -v axiom-dev_lei_data_dev:/data -v ${PWD}:/backup alpine tar xzf /backup/lei-data-backup.tar.gz -C /

# Restore database (bind mount — stop containers first, then replace the directory)
docker compose --env-file .env.dev -f docker-compose.dev.yml stop postgres
rm -rf ./data/dev/postgres
tar xzf postgres-backup.tar.gz
docker compose --env-file .env.dev -f docker-compose.dev.yml start postgres
```

### Clean Up Volumes

```powershell
# Remove LEI data volume (WARNING: Data loss!)
docker volume rm axiom-dev_lei_data_dev

# Reset postgres data (bind mount — delete the host directory, WARNING: Data loss!)
docker compose --env-file .env.dev -f docker-compose.dev.yml stop postgres
rm -rf ./data/dev/postgres

# Remove all unused volumes
docker volume prune
```

## Monitoring

Run the monitoring script anytime:

```powershell
.\monitor-lei-sync.ps1
```

Check for race condition prevention in logs:

```powershell
docker logs axiom-dev-backend 2>&1 | Select-String "prevent race"
```

## Migration Notes

### Existing Data

If you already have LEI data in containers (like now):

#### Option 1: Let it complete and persist

- Current full sync will complete (~9 hours)
- Data will be saved to new `lei_data_dev` volume
- Future rebuilds will preserve this data

#### Option 2: Start fresh

```powershell
# Stop containers
docker compose --env-file .env.dev -f docker-compose.dev.yml down

# Remove postgres bind-mount directory (WARNING: Data loss!)
Remove-Item -Recurse -Force ./data/dev/postgres

# Remove LEI data volume (WARNING: Data loss!)
docker volume rm axiom-dev_lei_data_dev

# Restart (will trigger fresh full sync)
docker compose --env-file .env.dev -f docker-compose.dev.yml up -d
```

## References

- **Architecture:** [docs/architecture.md](../architecture.md)
- **LEI Acquisition:** [docs/lei/LEI_ACQUISITION.md](./LEI_ACQUISITION.md)
- **LEI Data Flow:** [docs/lei/LEI_DATA_FLOW.md](./LEI_DATA_FLOW.md)
- **Multi-Environment Setup:** [docs/environments/multi-environment-setup.md](../environments/multi-environment-setup.md)

## Known Issues & Future Improvements

### Stale Status Cleanup on Restart

**Issue:** When a container stops abruptly (rebuild, crash, manual stop), sync status remains "RUNNING" in database.  
**Impact:** Race condition prevention can incorrectly block new syncs.  
**Workaround:** Manually clean up stale statuses:

```sql
UPDATE lei_raw.file_processing_status 
SET status='COMPLETED', 
    error_message='Interrupted by container restart' 
WHERE status='RUNNING' 
  AND last_run_at < NOW() - INTERVAL '1 hour';
```

**Future Fix:** Add startup logic to auto-clean stale RUNNING statuses older than threshold (e.g., 1 hour).
