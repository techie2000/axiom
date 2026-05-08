# Multi-Environment Docker Setup

This document describes the multi-environment Docker setup for Axiom, which allows running main, development, UAT,
and production environments simultaneously on the same machine.

## Overview

The Axiom project supports four independent environments, each with its own:

- Database instance (PostgreSQL)
- Message queue (RabbitMQ)
- Backend service
- Frontend service
- Network namespace
- Data volumes

This enables side-by-side comparison and testing across environments without conflicts.

## Architecture Diagram

```mermaid
graph TB
    subgraph "Main Environment (Port Prefix: 4)"
        MainFE[Frontend<br/>:43000]
      MainDocs[User Docs<br/>:45173 (optional)]
        MainBE[Backend<br/>:48080]
        MainPG[(PostgreSQL<br/>:45432)]
        MainRMQ[RabbitMQ<br/>:45672/:45673]
        MainFE --> MainBE
      MainDocs -.-> MainFE
        MainBE --> MainPG
        MainBE --> MainRMQ
    end

    subgraph "Development Environment (Port Prefix: 1)"
        DevFE[Frontend<br/>:13000]
      DevDocs[User Docs<br/>:15173 (optional)]
        DevBE[Backend<br/>:18080]
        DevPG[(PostgreSQL<br/>:15432)]
        DevRMQ[RabbitMQ<br/>:15672/:15673]
        DevFE --> DevBE
      DevDocs -.-> DevFE
        DevBE --> DevPG
        DevBE --> DevRMQ
    end

    subgraph "UAT Environment (Port Prefix: 2)"
        UATFE[Frontend<br/>:23000]
        UATBE[Backend<br/>:28080]
        UATPG[(PostgreSQL<br/>:25432)]
        UATRMQ[RabbitMQ<br/>:25672/:25673]
        UATFE --> UATBE
        UATBE --> UATPG
        UATBE --> UATRMQ
    end

    subgraph "Production Environment (Port Prefix: 3)"
        ProdFE[Frontend<br/>:33000]
        ProdBE[Backend<br/>:38080]
        ProdPG[(PostgreSQL<br/>:35432)]
        ProdRMQ[RabbitMQ<br/>:35672/:35673]
        ProdFE --> ProdBE
        ProdBE --> ProdPG
        ProdBE --> ProdRMQ
    end

    User[User/Developer]
    User -.-> MainFE
   User -.-> MainDocs
    User -.-> DevFE
   User -.-> DevDocs
    User -.-> UATFE
    User -.-> ProdFE

    style MainFE fill:#e3f2fd
    style DevFE fill:#e3f2fd
    style MainBE fill:#e3f2fd
    style DevBE fill:#e3f2fd
    style MainPG fill:#e3f2fd
    style DevPG fill:#e3f2fd
    style DevRMQ fill:#e3f2fd
    style MainRMQ fill:#e3f2fd
    style UATFE fill:#fff3e0
    style UATBE fill:#fff3e0
    style UATPG fill:#fff3e0
    style UATRMQ fill:#fff3e0
    style ProdFE fill:#ffebee
    style ProdBE fill:#ffebee
    style ProdPG fill:#ffebee
    style ProdRMQ fill:#ffebee
```

## Port Assignment Strategy

Each environment uses a unique port prefix to avoid conflicts:

### Main Environment (Prefix: 4)

| Service             | Internal Port | External Port |
|---------------------|---------------|---------------|
| Frontend            | 3000          | 43000         |
| User Docs (optional)| 80            | 45173         |
| Backend API         | 8080          | 48080         |
| PostgreSQL          | 5432          | 45432         |
| RabbitMQ AMQP       | 5672          | 45672         |
| RabbitMQ Management | 15672         | 45673         |

### Development Environment (Prefix: 1)

| Service             | Internal Port | External Port |
|---------------------|---------------|---------------|
| Frontend            | 3000          | 13000         |
| User Docs (optional)| 80            | 15173         |
| Backend API         | 8080          | 18080         |
| PostgreSQL          | 5432          | 15432         |
| RabbitMQ AMQP       | 5672          | 15672         |
| RabbitMQ Management | 15672         | 15673         |

### UAT Environment (Prefix: 2)

| Service             | Internal Port | External Port |
|---------------------|---------------|---------------|
| Frontend            | 3000          | 23000         |
| Backend API         | 8080          | 28080         |
| PostgreSQL          | 5432          | 25432         |
| RabbitMQ AMQP       | 5672          | 25672         |
| RabbitMQ Management | 15672         | 25673         |

### Production Environment (Prefix: 3)

| Service             | Internal Port | External Port |
|---------------------|---------------|---------------|
| Frontend            | 3000          | 33000         |
| Backend API         | 8080          | 38080         |
| PostgreSQL          | 5432          | 35432         |
| RabbitMQ AMQP       | 5672          | 35672         |
| RabbitMQ Management | 15672         | 35673         |

## Environment Configuration Files

Each environment has its own configuration file:

- `.env.main` - Main environment variables
- `.env.dev` - Development environment variables
- `.env.uat` - UAT environment variables
- `.env.prod` - Production environment variables

### Configuration Variables

Each `.env` file contains:

```bash
# Project identification
COMPOSE_PROJECT_NAME=axiom-{env}
ENVIRONMENT={env}

# Port mappings
POSTGRES_PORT={prefix}5432
RABBITMQ_PORT={prefix}5672
RABBITMQ_MGMT_PORT={prefix}15672
BACKEND_PORT={prefix}8080
FRONTEND_PORT={prefix}3000
DOCS_USER_PORT={prefix}5173  # optional docs profile in main/dev

# Database credentials
POSTGRES_USER=axiom
POSTGRES_PASSWORD=axiom_{env}_pass   # dev/main: change for production environments
POSTGRES_DB=axiom_{env}

# Application configuration
JWT_SECRET=<set-a-long-random-secret-here>   # REQUIRED — never use placeholder in production
SERVER_MODE=debug|release
```

## Docker Compose Files

Each environment has a dedicated Docker Compose file:

- `docker-compose.main.yml` - Main environment
- `docker-compose.dev.yml` - Development environment
- `docker-compose.uat.yml` - UAT environment
- `docker-compose.prod.yml` - Production environment

These files:

- Reference environment variables from corresponding `.env` files
- Create isolated Docker networks
- Use separate volume names for data persistence
- Configure service dependencies and health checks

## Usage

### Starting Environments

```bash
# Start individual environment
make docker-main-up    # Main
make docker-dev-up     # Development
make docker-uat-up     # UAT
make docker-prod-up    # Production

# Start all environments at once
make docker-all-up
```

### Stopping Environments

```bash
# Stop individual environment
make docker-main-down  # Main
make docker-dev-down   # Development
make docker-uat-down   # UAT
make docker-prod-down  # Production

# Stop all environments
make docker-all-down
```

### Viewing Logs

```bash
# View logs for specific environment
make docker-main-logs  # Main
make docker-dev-logs   # Development
make docker-uat-logs   # UAT
make docker-prod-logs  # Production
```

### Checking Status

```bash
# View status of all environments
make docker-all-status
```

### Restarting Services

```bash
# Restart specific environment
make docker-main-restart
make docker-dev-restart
make docker-uat-restart
make docker-prod-restart
```

## Database Migrations

Each environment has its own database, requiring separate migration management:

```bash
# Run migrations
make migrate-main-up   # Main database
make migrate-dev-up    # Development database
make migrate-uat-up    # UAT database
make migrate-prod-up   # Production database

# Rollback migrations
make migrate-main-down # Main database
make migrate-dev-down  # Development database
make migrate-uat-down  # UAT database
make migrate-prod-down # Production database
```

## Accessing Services

### Frontend Applications

- Main: http://localhost:43000
- Development: http://localhost:13000
- UAT: http://localhost:23000
- Production: http://localhost:33000

### User Documentation (Optional Profile)

- Main: http://localhost:45173/docs-user/
- Development: http://localhost:15173/docs-user/

### Backend APIs

- Main: http://localhost:48080
- Development: http://localhost:18080
- UAT: http://localhost:28080
- Production: http://localhost:38080

### Swagger Documentation

- Main: http://localhost:48080/swagger/index.html
- Development: http://localhost:18080/swagger/index.html
- UAT: http://localhost:28080/swagger/index.html
- Production: http://localhost:38080/swagger/index.html

### Database Connections

```bash
# Main
psql -h localhost -p 45432 -U axiom -d axiom_main

# Development
psql -h localhost -p 15432 -U axiom -d axiom_dev

# UAT
psql -h localhost -p 25432 -U axiom -d axiom_uat

# Production
psql -h localhost -p 35432 -U axiom -d axiom_prod
```

### RabbitMQ Management UI

- Main: http://localhost:45673 (axiom_main / see `.env.main` for password)
- Development: http://localhost:15673 (axiom_dev / see `.env.dev` for password)
- UAT: http://localhost:25673 (credentials set in `.env.uat` — `CHANGE_ME_REQUIRED`)
- Production: http://localhost:35673 (credentials set in `.env.prod` — `CHANGE_ME_REQUIRED`)

## Container Naming

Containers follow this naming pattern: `axiom-{env}-{service}`

Examples:

- `axiom-main-backend`
- `axiom-dev-backend`
- `axiom-uat-postgres`
- `axiom-prod-frontend`

## Network Isolation

Each environment runs in its own Docker network:

- `axiom-main-network`
- `axiom-dev-network`
- `axiom-uat-network`
- `axiom-prod-network`

This ensures complete isolation between environments.

## Volume Management

Postgres data persistence is environment-specific:

- **main** — bind mount at `./data/main/postgres` on the host (files visible in your file explorer)
- **dev** — bind mount at `./data/dev/postgres` on the host (files visible in your file explorer)
- **uat** — Docker-managed named volume with Compose volume key `postgres_data_uat`
  and actual Docker volume name `${COMPOSE_PROJECT_NAME}_postgres_data_uat`
- **prod** — Docker-managed named volume with Compose volume key `postgres_data_prod`
  and actual Docker volume name `${COMPOSE_PROJECT_NAME}_postgres_data_prod`

This allows each environment to maintain its own persistent data while giving the dev environment
direct filesystem access for easy inspection.

## Common Use Cases

### Testing a Feature Across Environments

```bash
# Start all environments
make docker-all-up

# Deploy feature to dev
# ... build and deploy ...

# Test in dev: http://localhost:13000

# Promote to UAT
# ... build and deploy ...

# Test in UAT: http://localhost:23000

# Compare side-by-side
# Dev: http://localhost:13000
# UAT: http://localhost:23000
```

### Database Comparison

```bash
# Connect to dev database
psql -h localhost -p 15432 -U axiom -d axiom_dev

# In another terminal, connect to UAT database
psql -h localhost -p 25432 -U axiom -d axiom_uat

# Compare schemas, data, etc.
```

### Load Testing Different Environments

```bash
# Run load test against dev
ab -n 1000 -c 10 http://localhost:18080/api/v1/health

# Run load test against UAT
ab -n 1000 -c 10 http://localhost:28080/api/v1/health

# Compare performance metrics
```

## Troubleshooting

### Port Conflicts

If you get port binding errors, check if the ports are already in use:

```bash
# Check if port is in use
lsof -i :18080

# Kill process using the port
kill -9 <PID>
```

### Container Name Conflicts

If you get container name conflicts, ensure you've stopped the previous environment:

```bash
# List all Axiom containers
docker ps -a | grep axiom

# Remove specific container
docker rm -f axiom-dev-backend

# Or stop the entire environment
make docker-dev-down
```

### Volume Issues

If you need to reset an environment's data:

```bash
# Stop the environment
make docker-dev-down

# Remove the bind-mount directory (dev uses a host bind mount, not a Docker volume)
rm -rf ./data/dev/postgres

# Restart the environment
make docker-dev-up

# Run migrations
make migrate-dev-up
```

For UAT or prod (which use Docker-managed volumes):

```bash
# Set the environment: use "uat" or "prod"
ENV=uat

# Stop the environment
make docker-$ENV-down

# Remove the volume
docker volume rm axiom-$ENV_postgres_data_$ENV

# Restart the environment
make docker-$ENV-up

# Run migrations
make migrate-$ENV-up
```

### Viewing All Environment Resources

```bash
# View all containers
docker ps -a | grep axiom

# View all networks
docker network ls | grep axiom

# View dev postgres data (bind mount — host directory)
ls -la ./data/dev/postgres

# View UAT/prod volumes (Docker-managed)
docker volume ls | grep postgres_data
```

## Best Practices

1. **Always use environment-specific commands**: Use `make docker-dev-up` instead of directly calling docker-compose
   to ensure correct configuration
2. **Keep environment variables updated**: If you change passwords or configurations, update the corresponding
   `.env.*` file
3. **Run migrations after environment updates**: Always run migrations when starting a fresh environment or after
   schema changes
4. **Monitor resource usage**: Running multiple environments requires more system resources; monitor CPU and memory
   usage
5. **Clean up unused environments**: Stop environments you're not actively using to free resources
6. **Backup production data**: Even in local development, treat the "prod" environment data as important and back it
   up regularly

## Resource Requirements

Running all four environments simultaneously requires:

- **CPU**: 4+ cores recommended
- **RAM**: 8GB minimum, 16GB recommended
- **Disk**: 10GB+ for Docker images and volumes (note daily raw data file are >1GB, plus database storage)
- **Network**: Each environment uses its own network namespace

## Security Considerations

1. **Change default passwords**: The `.env.*` files contain default passwords; change them for production use
2. **JWT secrets**: Each environment uses a different JWT secret; ensure production secrets are strong and unique
3. **Network isolation**: Environments are isolated by Docker networks; additional firewall rules may be needed for
   production
4. **SSL/TLS**: Consider adding SSL termination for production-like environments

## Secret Management

### Required secrets per environment

| Variable | dev/main | uat/prod |
| --- | --- | --- |
| `JWT_SECRET` | Weak placeholder acceptable | **Must be strong random value (≥ 32 chars)** |
| `DATABASE_PASSWORD` | Weak placeholder acceptable | **Must be strong, unique** |
| `RABBITMQ_DEFAULT_PASS` | Weak placeholder acceptable | **Must be strong, unique** |
| `PLAYWRIGHT_USER_PASSWORD` | Set when `PLAYWRIGHT_SEED_USER=true` | **Must not be set** |

### Rules enforced at startup

The backend **refuses to start** if:

- `JWT_SECRET` is empty
- `DATABASE_PASSWORD` is empty
- `PLAYWRIGHT_SEED_USER=true` and `SERVER_MODE=release` (test fixtures are
  blocked in UAT/prod at the config-validation layer)
- `PLAYWRIGHT_SEED_USER=true` and `PLAYWRIGHT_USER_PASSWORD` is empty

### Rotating secrets

1. Generate a new secret value:

   **Bash:**

   ```bash
   openssl rand -base64 48
   ```

   **PowerShell:**

   ```powershell
   [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(36))
   ```

2. Update the value in your secrets manager or `.env.*` file (never commit real values).

3. Restart the affected service:

   **Bash:**

   ```bash
   docker compose --env-file .env.prod restart backend
   ```

   **PowerShell:**

   ```powershell
   docker compose --env-file .env.prod restart backend
   ```

4. Verify the service starts cleanly by checking logs:

   **Bash:**

   ```bash
   docker compose --env-file .env.prod logs --tail 20 backend
   ```

   **PowerShell:**

   ```powershell
   docker compose --env-file .env.prod logs --tail 20 backend
   ```

### Where to store production secrets

- **Local dev/main**: `.env.dev` / `.env.main` in the repo are acceptable for
  development-grade passwords.
- **UAT/Production**: Do **not** commit real credentials. Inject secrets at
  runtime using one of:
  - A secrets manager (AWS Secrets Manager, HashiCorp Vault, Azure Key Vault)
  - Docker secrets (`docker secret create` + compose `secrets:` stanza)
  - CI/CD environment variables (GitHub Actions encrypted secrets, etc.)

The `.env.uat` and `.env.prod` files in this repo contain `CHANGE_ME_REQUIRED`
placeholders. Real values must be supplied out-of-band before deploying.

### What never to do

- Never commit a real `JWT_SECRET`, `DATABASE_PASSWORD`, or
  `RABBITMQ_DEFAULT_PASS` to git.
- Never set `PLAYWRIGHT_SEED_USER=true` in a UAT or production env file —
  the backend will refuse to start.
- Never share dev credentials with UAT/prod environments.

## Future Enhancements

Potential improvements to the multi-environment setup:

- Add staging environment (prefix 5)
- Implement automated environment synchronization
- Add environment-specific CI/CD pipelines
- Integrate with secrets management (Vault, AWS Secrets Manager)
- Add monitoring and alerting per environment
- Implement blue-green deployment per environment
