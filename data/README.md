# Data Directory

This is the canonical data-persistence guide for environment subfolders (`data/dev` and `data/main`).

This directory contains persisted runtime data used by local Docker environments.

## Purpose

- Store environment-specific data that should survive container restarts
- Keep operational artifacts (for example LEI files, local Postgres data) outside application source folders
- Make local troubleshooting and validation easier

## Structure

```text
data/
├── dev/
│   ├── lei/
│   └── postgres/
└── main/
    ├── lei/
    └── postgres/
```

## Important Safety Rules

- Treat `data/main/` as long-lived local state.
- Avoid destructive commands unless you intentionally want data loss.
- Prefer `docker compose ... down` over `docker compose ... down -v` for persistent environments.

## Worktree/PR Testing

When testing with additional worktrees, use an isolated env file with a unique `COMPOSE_PROJECT_NAME`
so test runs do not collide with your main environment data/volumes.

```bash
./scripts/new-main-test-env.ps1 -Name pr107
docker compose --env-file .env.main.pr107 -f docker-compose.main.yml up -d --build
```
