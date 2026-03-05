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

Added bind mounts for direct host-filesystem access (dev and main environments):

Configuration in **docker-compose.dev.yml** and **docker-compose.main.yml**:

```yaml
# docker-compose.dev.yml
backend:
  environment:
    LEI_DATADIR: ${LEI_DATADIR}  # Loaded from .env.dev; maps to cfg.LEI.DataDir
  volumes:
    - ./data/dev/lei:/root/data/lei      # Bind mount for LEI files (dev)
    - ./data/dev/postgres:/var/lib/postgresql/data  # Bind mount for Postgres (dev)

# docker-compose.main.yml
backend:
  environment:
    LEI_DATADIR: ${LEI_DATADIR}  # Loaded from .env.main; maps to cfg.LEI.DataDir
  volumes:
    - ./data/main/lei:/root/data/lei     # Bind mount for LEI files (main)
    - ./data/main/postgres:/var/lib/postgresql/data  # Bind mount for Postgres (main)
```

> **Note:** Neither dev nor main uses Docker named volumes for LEI data or Postgres. Both use
> host bind mounts so files are directly accessible in your file explorer, VS Code, and Windows Explorer.

Environment variable in **.env.dev** / **.env.main**:

```env
LEI_DATADIR=/root/data/lei  # Inside container, mapped to ./data/<env>/lei on host
```

Code in **backend/internal/config/config.go** reads the env var via viper:

```go
viper.SetDefault("lei.datadir", "./data/lei")
// LEI_DATADIR environment variable is automatically mapped to cfg.LEI.DataDir
```

### 3. ✅ Database Persistence (Already Working)

#### Status

Database persistence is handled via bind mounts in both dev and main:

```yaml
# dev
volumes:
  - ./data/dev/postgres:/var/lib/postgresql/data

# main
volumes:
  - ./data/main/postgres:/var/lib/postgresql/data
```

Database survives container rebuilds. ✅

## Files Modified

### Code Changes

1. **backend/internal/service/scheduler_service.go**
   - Added cross-check for concurrent sync prevention
   - `RunDailyDeltaSync()`: Check DAILY_FULL status
   - `RunDailyFullSync()`: Check DAILY_DELTA status

2. **backend/internal/config/config.go**
   - `LEI_DATADIR` environment variable mapped to `cfg.LEI.DataDir` via viper
   - Default: `./data/lei`

### Configuration Changes (Storage Strategy)

#### Development and Main Environments (Bind Mounts)

1. **docker-compose.dev.yml** / **docker-compose.main.yml**

- `LEI_DATADIR` environment variable (loaded from `.env.dev` / `.env.main`)
- `./data/dev/lei:/root/data/lei` bind mount for LEI files (dev)
- `./data/main/lei:/root/data/lei` bind mount for LEI files (main)
- ✅ Files visible in VS Code and Windows Explorer
- ✅ Easy debugging and inspection

2. **.env.dev** / **.env.main**
   - `LEI_DATADIR=/root/data/lei`

#### UAT/Production Environments (Docker Volumes)

1. **docker-compose.uat.yml**

- `LEI_DATADIR` environment variable
- `lei_data_uat:/root/data/lei` **volume mount** (better performance)
- `lei_data_uat` named volume

2. **.env.uat**
   - `LEI_DATADIR=/root/data/lei`

3. **docker-compose.prod.yml**
   - `LEI_DATADIR` environment variable
   - `lei_data_prod:/root/data/lei` **volume mount** (better performance)
   - `lei_data_prod` named volume

4. **.env.prod**
   - `LEI_DATADIR=/root/data/lei`

### Storage Strategy Summary

| Environment | Data Type    | Storage Type  | Location                          | Rationale                                    |
| ----------- | ------------ | ------------- | --------------------------------- | -------------------------------------------- |
| **dev**     | Postgres DB  | Bind Mount    | `./data/dev/postgres` on host     | Direct filesystem access for easy inspection |
| **dev**     | LEI files    | Bind Mount    | `./data/dev/lei` on host          | Easy debugging, file inspection in VS Code   |
| **main**    | Postgres DB  | Bind Mount    | `./data/main/postgres` on host    | Direct filesystem access for easy inspection |
| **main**    | LEI files    | Bind Mount    | `./data/main/lei` on host         | Easy debugging, file inspection in VS Code   |
| **uat**     | Postgres DB  | Docker Volume | `postgres_data_uat` (Docker-managed) | Better performance, production-like       |
| **uat**     | LEI files    | Docker Volume | `lei_data_uat` (Docker-managed)      | Better performance, production-like       |
| **prod**    | Postgres DB  | Docker Volume | `postgres_data_prod` (Docker-managed) | Best performance, isolation, reliability |
| **prod**    | LEI files    | Docker Volume | `lei_data_prod` (Docker-managed)      | Best performance, isolation, reliability |

## Testing & Verification

### Current Status

- **Full sync in progress:** 39,657+ records processed (out of 3.2M)
- **LEI files persisted:** `./data/dev/lei` bind mount on host (dev); `./data/main/lei` (main)
- **Database persisted:** `./data/dev/postgres` bind mount (dev); `./data/main/postgres` (main)

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

- ✅ Consistent configuration across dev/main/uat/prod
- ✅ Each environment has isolated bind mounts or volumes
- ✅ Environment-specific data directories
- ✅ Production-ready configuration

## Volume Management

Both dev and main use **host bind mounts** for LEI files and Postgres data.
UAT and prod use Docker-managed named volumes for LEI files (Postgres is also a named volume there).

### Viewing Data

**Bash:**

```bash
# Dev — inspect bind-mount directories directly
ls -lh ./data/dev/lei/
ls -lh ./data/dev/postgres/

# Main — inspect bind-mount directories directly
ls -lh ./data/main/lei/
ls -lh ./data/main/postgres/

# UAT/prod — list Docker volumes
docker volume ls | grep axiom
```

**PowerShell:**

```powershell
# Dev — inspect bind-mount directories directly
Get-ChildItem ./data/dev/lei/
Get-ChildItem ./data/dev/postgres/

# Main — inspect bind-mount directories directly
Get-ChildItem ./data/main/lei/
Get-ChildItem ./data/main/postgres/

# UAT/prod — list Docker volumes
docker volume ls | Select-String "axiom"
```

### Backup Data

**Bash:**

```bash
# Backup dev LEI files (bind mount — copy the host directory)
tar czf lei-dev-backup.tar.gz ./data/dev/lei

# Backup dev Postgres (bind mount — copy the host directory)
tar czf postgres-dev-backup.tar.gz ./data/dev/postgres

# Backup main LEI files (bind mount — copy the host directory)
tar czf lei-main-backup.tar.gz ./data/main/lei

# Backup main Postgres (bind mount — copy the host directory)
tar czf postgres-main-backup.tar.gz ./data/main/postgres

# Backup UAT LEI data (Docker volume)
docker run --rm -v axiom-uat_lei_data_uat:/data -v ${PWD}:/backup alpine \
  tar czf /backup/lei-uat-backup.tar.gz /data
```

**PowerShell:**

```powershell
# Backup dev LEI files (bind mount — copy the host directory)
Compress-Archive -Path ./data/dev/lei -DestinationPath lei-dev-backup.zip

# Backup dev Postgres (bind mount — copy the host directory)
Compress-Archive -Path ./data/dev/postgres -DestinationPath postgres-dev-backup.zip

# Backup main LEI files (bind mount — copy the host directory)
Compress-Archive -Path ./data/main/lei -DestinationPath lei-main-backup.zip

# Backup main Postgres (bind mount — copy the host directory)
Compress-Archive -Path ./data/main/postgres -DestinationPath postgres-main-backup.zip

# Backup UAT LEI data (Docker volume)
docker run --rm -v axiom-uat_lei_data_uat:/data -v "${PWD}:/backup" alpine `
  tar czf /backup/lei-uat-backup.tar.gz /data
```

### Restore Data

**Bash:**

```bash
# Restore dev Postgres (bind mount — stop Postgres first, then replace the directory)
docker compose --env-file .env.dev -f docker-compose.dev.yml stop postgres
rm -rf ./data/dev/postgres
tar xzf postgres-dev-backup.tar.gz
docker compose --env-file .env.dev -f docker-compose.dev.yml start postgres

# Restore main Postgres (same pattern)
docker compose --env-file .env.main -f docker-compose.main.yml stop postgres
rm -rf ./data/main/postgres
tar xzf postgres-main-backup.tar.gz
docker compose --env-file .env.main -f docker-compose.main.yml start postgres

# Restore UAT LEI data (Docker volume)
docker run --rm -v axiom-uat_lei_data_uat:/data -v ${PWD}:/backup alpine \
  tar xzf /backup/lei-uat-backup.tar.gz -C /
```

**PowerShell:**

```powershell
# Restore dev Postgres (bind mount — stop Postgres first, then replace the directory)
docker compose --env-file .env.dev -f docker-compose.dev.yml stop postgres
Remove-Item -Recurse -Force ./data/dev/postgres
Expand-Archive -Path postgres-dev-backup.zip -DestinationPath .
docker compose --env-file .env.dev -f docker-compose.dev.yml start postgres

# Restore main Postgres (same pattern)
docker compose --env-file .env.main -f docker-compose.main.yml stop postgres
Remove-Item -Recurse -Force ./data/main/postgres
Expand-Archive -Path postgres-main-backup.zip -DestinationPath .
docker compose --env-file .env.main -f docker-compose.main.yml start postgres

# Restore UAT LEI data (Docker volume)
docker run --rm -v axiom-uat_lei_data_uat:/data -v "${PWD}:/backup" alpine `
  tar xzf /backup/lei-uat-backup.tar.gz -C /
```

### Clean Up Data

**Bash:**

```bash
# Reset dev data (bind mounts — delete host directories, WARNING: Data loss!)
docker compose --env-file .env.dev -f docker-compose.dev.yml stop postgres
rm -rf ./data/dev/postgres
rm -rf ./data/dev/lei

# Reset main data (bind mounts — delete host directories, WARNING: Data loss!)
docker compose --env-file .env.main -f docker-compose.main.yml stop postgres
rm -rf ./data/main/postgres
rm -rf ./data/main/lei

# Remove UAT/prod Docker volumes (WARNING: Data loss!)
docker volume rm axiom-uat_lei_data_uat axiom-prod_lei_data_prod

# Remove all unused volumes
docker volume prune
```

**PowerShell:**

```powershell
# Reset dev data (bind mounts — delete host directories, WARNING: Data loss!)
docker compose --env-file .env.dev -f docker-compose.dev.yml stop postgres
Remove-Item -Recurse -Force ./data/dev/postgres
Remove-Item -Recurse -Force ./data/dev/lei

# Reset main data (bind mounts — delete host directories, WARNING: Data loss!)
docker compose --env-file .env.main -f docker-compose.main.yml stop postgres
Remove-Item -Recurse -Force ./data/main/postgres
Remove-Item -Recurse -Force ./data/main/lei

# Remove UAT/prod Docker volumes (WARNING: Data loss!)
docker volume rm axiom-uat_lei_data_uat axiom-prod_lei_data_prod

# Remove all unused volumes
docker volume prune
```

## Monitoring

Run the monitoring script anytime:

```powershell
.\monitor-lei-sync.ps1
```

Check for race condition prevention in logs:

**Bash:**

```bash
docker logs axiom-dev-backend 2>&1 | grep "prevent race"
docker logs axiom-main-backend 2>&1 | grep "prevent race"
```

**PowerShell:**

```powershell
docker logs axiom-dev-backend 2>&1 | Select-String "prevent race"
docker logs axiom-main-backend 2>&1 | Select-String "prevent race"
```

## Migration Notes

### Existing Data

If you already have LEI data in containers:

#### Option 1: Let it complete and persist

- Current full sync will complete (~9 hours)
- Data will be saved to the bind-mount directory (`./data/dev/lei` or `./data/main/lei`)
- Future rebuilds will preserve this data

#### Option 2: Start fresh (dev)

**Bash:**

```bash
# Stop containers
docker compose --env-file .env.dev -f docker-compose.dev.yml down

# Remove bind-mount directories (WARNING: Data loss!)
rm -rf ./data/dev/postgres
rm -rf ./data/dev/lei

# Restart (will trigger fresh full sync)
docker compose --env-file .env.dev -f docker-compose.dev.yml up -d
```

**PowerShell:**

```powershell
# Stop containers
docker compose --env-file .env.dev -f docker-compose.dev.yml down

# Remove bind-mount directories (WARNING: Data loss!)
Remove-Item -Recurse -Force ./data/dev/postgres
Remove-Item -Recurse -Force ./data/dev/lei

# Restart (will trigger fresh full sync)
docker compose --env-file .env.dev -f docker-compose.dev.yml up -d
```

#### Option 2: Start fresh (main)

**Bash:**

```bash
docker compose --env-file .env.main -f docker-compose.main.yml down
rm -rf ./data/main/postgres
rm -rf ./data/main/lei
docker compose --env-file .env.main -f docker-compose.main.yml up -d
```

**PowerShell:**

```powershell
docker compose --env-file .env.main -f docker-compose.main.yml down
Remove-Item -Recurse -Force ./data/main/postgres
Remove-Item -Recurse -Force ./data/main/lei
docker compose --env-file .env.main -f docker-compose.main.yml up -d
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
