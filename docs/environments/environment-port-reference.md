# Environment Port Reference

Quick reference card for Axiom multi-environment port mappings.

## Port Mapping Table

| Service                  | Development | UAT   | Production |
|--------------------------|-------------|-------|------------|
| **Frontend**             | 13000       | 23000 | 33000      |
| **Backend API**          | 18080       | 28080 | 38080      |
| **PostgreSQL**           | 15432       | 25432 | 35432      |
| **RabbitMQ AMQP**        | 15672       | 25672 | 35672      |
| **RabbitMQ Management**  | 15673       | 25673 | 35673      |

## Quick Access URLs

### Development Environment

```bash
Frontend:           http://localhost:13000
Backend API:        http://localhost:18080
API Health:         http://localhost:18080/health
Swagger:            http://localhost:18080/swagger/index.html
RabbitMQ Mgmt:      http://localhost:15673
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

- **1xxxx**: Development environment
- **2xxxx**: UAT environment
- **3xxxx**: Production environment

This allows easy identification of which environment a port belongs to.

## Container Names

Containers follow the pattern: `axiom-{env}-{service}`

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

- axiom-dev-network
- axiom-uat-network
- axiom-prod-network

## Volume Names

- postgres_data_dev
- postgres_data_uat
- postgres_data_prod

## Make Commands Quick Reference

```bash
# Start environments
make docker-dev-up
make docker-uat-up
make docker-prod-up
make docker-all-up

# Stop environments
make docker-dev-down
make docker-uat-down
make docker-prod-down
make docker-all-down

# View status
make docker-all-status

# Migrations
make migrate-dev-up
make migrate-uat-up
make migrate-prod-up
```

## Related Runbooks

- API smoke checks: [docs/environments/README.md](README.md#quick-command-reference)
- Quick-start command guide: [docs/environments/multi-environment-quickstart.md](multi-environment-quickstart.md)

## Default Credentials

**PostgreSQL:**

- Dev: axiom / axiom_dev_pass
- UAT: axiom / axiom_uat_pass
- Prod: axiom / axiom_prod_pass

**RabbitMQ:**

- All environments: guest / guest

⚠️ **Security Note**: Change these credentials for actual production use!
