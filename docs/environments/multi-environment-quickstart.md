# Multi-Environment Quick Start Guide

This guide provides quick commands for working with Axiom's multi-environment setup.

## Quick Commands

### Start/Stop Environments

```bash
# Start main environment
make docker-main-up

# Start development environment
make docker-dev-up

# Start UAT environment
make docker-uat-up

# Start production environment
make docker-prod-up

# Start all environments at once
make docker-all-up

# Stop specific environment
make docker-main-down
make docker-dev-down
make docker-uat-down
make docker-prod-down

# Stop all environments
make docker-all-down
```

### View Logs

```bash
# Main logs
make docker-main-logs

# Development logs
make docker-dev-logs

# UAT logs
make docker-uat-logs

# Production logs
make docker-prod-logs
```

### Check Status

```bash
# View all environment status
make docker-all-status
```

### API Smoke Checks

```bash
# Run smoke checks for all environments
make smoke-api

# If make is unavailable, use the Windows CMD wrapper commands below

# Run smoke checks for one environment
make smoke-api env=main
make smoke-api env=uat

# Wait longer for API readiness during startup/migrations
make smoke-api env=dev startup_wait=120

# Include login endpoint check (informational)
make smoke-api env=prod check_login=1

# Windows (no make)
scripts\smoke-api.cmd all
scripts\smoke-api.cmd main
scripts\smoke-api.cmd uat
scripts\smoke-api.cmd prod --check-login
```

### Database Migrations

```bash
# Main
make migrate-main-up

# Development
make migrate-dev-up

# UAT
make migrate-uat-up

# Production
make migrate-prod-up
```

## Access URLs

### Main Environment

- **Frontend**: http://localhost:43000
- **Backend API**: http://localhost:48080/api/v1
- **Swagger UI**: http://localhost:48080/swagger/index.html
- **User Docs (optional profile)**: http://localhost:45173/docs-user/
- **RabbitMQ Management**: http://localhost:45673 (guest/guest)
- **PostgreSQL**: `psql -h localhost -p 45432 -U axiom -d axiom_main`

### Development Environment

- **Frontend**: http://localhost:13000
- **Backend API**: http://localhost:18080/api/v1
- **Swagger UI**: http://localhost:18080/swagger/index.html
- **User Docs (optional profile)**: http://localhost:15173/docs-user/
- **RabbitMQ Management**: http://localhost:15673 (guest/guest)
- **PostgreSQL**: `psql -h localhost -p 15432 -U axiom -d axiom_dev`

### UAT Environment

- **Frontend**: http://localhost:23000
- **Backend API**: http://localhost:28080/api/v1
- **Swagger UI**: http://localhost:28080/swagger/index.html
- **RabbitMQ Management**: http://localhost:25673 (guest/guest)
- **PostgreSQL**: `psql -h localhost -p 25432 -U axiom -d axiom_uat`

### Production Environment

- **Frontend**: http://localhost:33000
- **Backend API**: http://localhost:38080/api/v1
- **Swagger UI**: http://localhost:38080/swagger/index.html
- **RabbitMQ Management**: http://localhost:35673 (guest/guest)
- **PostgreSQL**: `psql -h localhost -p 35432 -U axiom -d axiom_prod`

## Port Reference

| Environment | Frontend | Backend | PostgreSQL | RabbitMQ | RabbitMQ Mgmt | User Docs (optional) |
|-------------|----------|---------|------------|----------|---------------|----------------------|
| Main        | 43000    | 48080   | 45432      | 45672    | 45673         | 45173                |
| Development | 13000    | 18080   | 15432      | 15672    | 15673         | 15173                |
| UAT         | 23000    | 28080   | 25432      | 25672    | 25673         | N/A                  |
| Production  | 33000    | 38080   | 35432      | 35672    | 35673         | N/A                  |

## Common Workflows

### 1. Test a Feature Across Environments

```bash
# Start all environments
make docker-all-up

# Wait for services to be healthy
sleep 30

# Run migrations on all databases
make migrate-dev-up
make migrate-uat-up
make migrate-prod-up

# Access each environment
open http://localhost:43000  # Main
open http://localhost:13000  # Dev
open http://localhost:23000  # UAT
open http://localhost:33000  # Prod
```

### 2. Side-by-Side Comparison

```bash
# Start main and dev
make docker-main-up
make docker-dev-up

# Access both
# Main: http://localhost:43000
# Dev:  http://localhost:13000
```

### 3. Clean Start (Reset Everything)

```bash
# Stop all environments
make docker-all-down

# Remove dev and main postgres data (bind mounts — delete host directories)
rm -rf ./data/dev/postgres
rm -rf ./data/main/postgres

# Remove UAT and prod postgres volumes (Docker-managed; names include COMPOSE_PROJECT_NAME prefix)
docker volume rm axiom-uat_postgres_data_uat axiom-prod_postgres_data_prod

# Start fresh
make docker-all-up
make migrate-main-up
make migrate-dev-up
make migrate-uat-up
make migrate-prod-up
```

### 4. Update Single Environment

```bash
# Rebuild and restart dev
make docker-dev-down
docker-compose --env-file .env.dev -f docker-compose.dev.yml build
make docker-dev-up
```

## Troubleshooting

### Port Already in Use

```bash
# Find what's using the port
lsof -i :18080

# Kill the process
kill -9 <PID>
```

### Container Won't Start

```bash
# Check logs
make docker-dev-logs

# Remove and recreate
make docker-dev-down
docker system prune -f
make docker-dev-up
```

### Database Connection Issues

```bash
# Check if postgres is healthy
docker ps | grep postgres

# Test connection
psql -h localhost -p 15432 -U axiom -d axiom_dev -c "SELECT version();"
```

### Out of Memory

```bash
# Stop unused environments
make docker-uat-down
make docker-prod-down

# Check Docker resource usage
docker stats
```

## Best Practices

1. **Start only what you need**: Don't run all four environments if you only need dev
2. **Stop when done**: Always stop environments when finished to free resources
3. **Use environment-specific commands**: Always use `make docker-dev-up` instead of raw docker-compose commands
4. **Monitor resources**: Running all four environments requires ~8GB RAM
5. **Regular cleanup**: Periodically clean up unused Docker resources with `docker system prune`

## Getting Help

```bash
# View all available make commands
make help

# View docker-compose status
make docker-all-status

# Check container logs
docker logs axiom-dev-backend
docker logs axiom-uat-postgres
docker logs axiom-prod-frontend
```

## Environment Variables

Each environment has its own `.env` file:

- `.env.main` - Main configuration
- `.env.dev` - Development configuration
- `.env.uat` - UAT configuration
- `.env.prod` - Production configuration

**Important**: Never commit `.env` files with real secrets! The files in this repo contain example values only.

For production deployments, copy the `.env.prod` file and update with actual credentials:

```bash
cp .env.prod .env.prod.local
# Edit .env.prod.local with real credentials
# Use with: docker-compose --env-file .env.prod.local -f docker-compose.prod.yml up
```
