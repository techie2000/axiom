# Backups Directory

This directory stores local backup artifacts for environment databases and recovery workflows.

## Purpose

- Keep timestamped backups before risky operations (schema upgrades, destructive compose commands, major refactors)
- Provide a simple restore path for local environments
- Separate backup artifacts from source code and runtime data

## Recommended Structure

```text
backups/
└── main/
    └── postgres/
        ├── axiom-main-axiom_main-YYYYMMDD-HHMMSS.dump
        └── ...
```

## Usage

Use the helper script for main Postgres backups:

```bash
./scripts/backup-main-postgres.ps1
```

Optional variants:

```bash
./scripts/backup-main-postgres.ps1 -Format plain
./scripts/backup-main-postgres.ps1 -OutputDir backups/main/postgres
```

## Notes

- Backup files are intentionally not committed to git.
- Keep only the backups you need; large dump files can consume significant disk space.
- Before deleting old backups, ensure at least one known-good recent backup exists.
