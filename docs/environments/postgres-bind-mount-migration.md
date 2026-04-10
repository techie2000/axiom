# PostgreSQL Bind-Mount Migration Guide

This guide covers migrating existing PostgreSQL data from the former named-volume storage to the
new bind-mount layout introduced for the `main` and `dev` compose environments.

## Background

Earlier versions of `docker-compose.main.yml` and `docker-compose.dev.yml` stored PostgreSQL data
in Docker-managed named volumes:

| Environment | Old named volume      | New bind-mount path    |
| ----------- | --------------------- | ---------------------- |
| `main`      | `postgres_data_main`  | `./data/main/postgres` |
| `dev`       | `postgres_data_dev`   | `./data/dev/postgres`  |

Switching to bind mounts gives developers direct filesystem access to database files without
needing extra Docker commands. However, the old named volume is not read automatically by the new
path. **You must copy the data before starting the stack for the first time with this layout**, or
you will get a fresh, empty database.

## Before You Start

- Stop the running stack for the affected environment.
- Confirm the old named volume still exists.

```bash
# Stop the main environment
docker compose --env-file .env.main -f docker-compose.main.yml down

# Stop the dev environment
docker compose --env-file .env.dev -f docker-compose.dev.yml down

# Confirm old volumes are present
docker volume ls | grep postgres_data
```

## Migration Steps

### Main Environment (`postgres_data_main` → `./data/main/postgres`)

```bash
# 1. Create the target directory
mkdir -p ./data/main/postgres

# 2. Copy data from the old named volume into the bind-mount directory
docker run --rm \
  -v postgres_data_main:/source:ro \
  -v "$(pwd)/data/main/postgres":/target \
  alpine sh -c "cp -a /source/. /target/"

# 3. Verify the copy succeeded (row count should be non-zero)
ls -la ./data/main/postgres/

# 4. Start the stack; it will pick up the existing data
docker compose --env-file .env.main -f docker-compose.main.yml up -d
```

### Dev Environment (`postgres_data_dev` → `./data/dev/postgres`)

```bash
# 1. Create the target directory
mkdir -p ./data/dev/postgres

# 2. Copy data from the old named volume into the bind-mount directory
docker run --rm \
  -v postgres_data_dev:/source:ro \
  -v "$(pwd)/data/dev/postgres":/target \
  alpine sh -c "cp -a /source/. /target/"

# 3. Verify the copy succeeded
ls -la ./data/dev/postgres/

# 4. Start the stack
docker compose --env-file .env.dev -f docker-compose.dev.yml up -d
```

## Rollback Steps

If you need to revert to the old named-volume layout, restore the original volume definition in
the compose file and restart the stack. Your data remains safe in the bind-mount directory, so you
can copy it back if needed.

### Restore to Named Volume (Main)

1. Edit `docker-compose.main.yml` and replace:

   ```yaml
   volumes:
     - ./data/main/postgres:/var/lib/postgresql/data
   ```

   with:

   ```yaml
   volumes:
     - postgres_data_main:/var/lib/postgresql/data
   ```

2. Re-add `postgres_data_main` to the top-level `volumes:` block:

   ```yaml
   volumes:
     postgres_data_main:
     rabbitmq_data_main:
     ...
   ```

3. Optionally copy bind-mount data back into the recreated named volume:

   ```bash
   docker volume create postgres_data_main
   docker run --rm \
     -v "$(pwd)/data/main/postgres":/source:ro \
     -v postgres_data_main:/target \
     alpine sh -c "cp -a /source/. /target/"
   ```

4. Start the stack:

   ```bash
   docker compose --env-file .env.main -f docker-compose.main.yml up -d
   ```

### Restore to Named Volume (Dev)

Follow the same steps as above, substituting `dev` for `main` and `postgres_data_dev` for
`postgres_data_main`.

## Fresh-Start Option

If you do **not** need to preserve existing data, simply start the stack without copying. The
PostgreSQL container will initialize a fresh database in the bind-mount directory.

```bash
# Main
docker compose --env-file .env.main -f docker-compose.main.yml up -d

# Dev
docker compose --env-file .env.dev -f docker-compose.dev.yml up -d
```

Then run the database migrations to build the schema:

```bash
make migrate-main-up   # if a main target exists, otherwise use dev
make migrate-dev-up
```

## Removing the Old Named Volumes

Once you have verified that the bind-mount data is correct and the stack is healthy, you can
safely delete the old named volumes to reclaim disk space:

```bash
docker volume rm postgres_data_main
docker volume rm postgres_data_dev
```

> ⚠️ **This is irreversible.** Only delete the volumes after confirming that all data has been
> successfully migrated to the bind-mount directories.

## Troubleshooting

### PostgreSQL fails to start with "data directory has wrong ownership"

The bind-mount directory must be owned by the `postgres` user inside the container. The copy
command above preserves ownership; if you created the directory manually and copied files with the
wrong ownership, fix it with:

```bash
docker run --rm \
  -v "$(pwd)/data/main/postgres":/var/lib/postgresql/data \
  postgres:17-alpine \
  chown -R postgres:postgres /var/lib/postgresql/data
```

### The database appears empty after migration

Confirm the copy step completed without errors, then check that the files are present:

```bash
ls -la ./data/main/postgres/
```

You should see PostgreSQL data files such as `PG_VERSION`, `base/`, `global/`, etc. If the
directory is empty, re-run the copy step.

### Old volume no longer exists

If the named volume was already deleted before you had a chance to migrate, you will need to
restore from a database backup or start with a fresh schema using `make migrate-main-up`.
