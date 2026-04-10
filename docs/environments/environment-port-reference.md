# Environment Port Reference

Quick reference card for Axiom multi-environment port mappings.

## Port Mapping Table

| Service                  | Main  | Development | UAT   | Production |
|--------------------------|-------|-------------|-------|------------|
| **Frontend**             | 43000 | 13000       | 23000 | 33000      |
| **Backend API**          | 48080 | 18080       | 28080 | 38080      |
| **PostgreSQL**           | 45432 | 15432       | 25432 | 35432      |
| **RabbitMQ AMQP**        | 45672 | 15672       | 25672 | 35672      |
| **RabbitMQ Management**  | 45673 | 15673       | 25673 | 35673      |
| **User Docs (optional)** | 45173 | 15173       | N/A   | N/A        |

## Quick Access URLs

### Main Environment

```bash
Frontend:           http://localhost:43000
Backend API:        http://localhost:48080
API Health:         http://localhost:48080/health
Swagger:            http://localhost:48080/swagger/index.html
RabbitMQ Mgmt:      http://localhost:45673
User Docs (opt):    http://localhost:45173/docs-user/
Database:           psql -h localhost -p 45432 -U axiom -d axiom_main
```

### Development Environment

```bash
Frontend:           http://localhost:13000
Backend API:        http://localhost:18080
API Health:         http://localhost:18080/health
Swagger:            http://localhost:18080/swagger/index.html
RabbitMQ Mgmt:      http://localhost:15673
User Docs (opt):    http://localhost:15173/docs-user/
Database:           psql -h localhost -p 15432 -U axiom -d axiom_dev
```

### UAT Environment

```bash
Frontend:           http://localhost:23000
Backend API:        http://localhost:28080
API Health:         http://localhost:28080/health
Swagger:            http://localhost:28080/swagger/index.html
RabbitMQ Mgmt:      http://localhost:25673
Database:           psql -h localhost -p 25432 -U axiom -d axiom_uat
```

### Production Environment

```bash
Frontend:           http://localhost:33000
Backend API:        http://localhost:38080
API Health:         http://localhost:38080/health
Swagger:            http://localhost:38080/swagger/index.html
RabbitMQ Mgmt:      http://localhost:35673
Database:           psql -h localhost -p 35432 -U axiom -d axiom_prod
```

## Port Prefix Strategy

- **4xxxx**: Main environment
- **1xxxx**: Development environment
- **2xxxx**: UAT environment
- **3xxxx**: Production environment

This allows easy identification of which environment a port belongs to.

## Container Names

Containers follow the pattern: `axiom-{env}-{service}`

**Main:**

- axiom-main-frontend
- axiom-main-backend
- axiom-main-postgres
- axiom-main-rabbitmq

**Development:**

- axiom-dev-frontend
- axiom-dev-backend
- axiom-dev-postgres
- axiom-dev-rabbitmq

**UAT:**

- axiom-uat-frontend
- axiom-uat-backend
- axiom-uat-postgres
- axiom-uat-rabbitmq

**Production:**

- axiom-prod-frontend
- axiom-prod-backend
- axiom-prod-postgres
- axiom-prod-rabbitmq

## Network Names

- axiom-main-network
- axiom-dev-network
- axiom-uat-network
- axiom-prod-network

## Postgres Data Storage

| Environment | Storage Type  | Location / Key                       |
| ----------- | ------------- | ------------------------------------ |
| main        | Bind mount    | `./data/main/postgres` (host dir)    |
| dev         | Bind mount    | `./data/dev/postgres` (host dir)     |
| uat         | Docker volume | Compose key: `postgres_data_uat`     |
| prod        | Docker volume | Compose key: `postgres_data_prod`    |

Note: Docker Compose prefixes named volumes with the project name.
For example, the `postgres_data_uat` key becomes a volume such as `axiom-uat_postgres_data_uat`.
When running `docker volume ls` or `docker volume rm`, use the prefixed names shown by Docker.

## Make Commands Quick Reference

```bash
# Start environments
make docker-main-up
make docker-dev-up
make docker-uat-up
make docker-prod-up
make docker-all-up

# Stop environments
make docker-main-down
make docker-dev-down
make docker-uat-down
make docker-prod-down
make docker-all-down

# View status
make docker-all-status

# Migrations
make migrate-main-up
make migrate-dev-up
make migrate-uat-up
make migrate-prod-up
```

## Related Runbooks

- API smoke checks: [docs/environments/README.md](README.md#quick-command-reference)
- Quick-start command guide: [docs/environments/multi-environment-quickstart.md](multi-environment-quickstart.md)

## Default Credentials

**PostgreSQL:**

- Main: axiom / axiom_main_pass
- Dev: axiom / axiom_dev_pass
- UAT: axiom / axiom_uat_pass
- Prod: axiom / axiom_prod_pass

**RabbitMQ:**

- All environments: guest / guest

⚠️ **Security Note**: Change these credentials for actual production use!
