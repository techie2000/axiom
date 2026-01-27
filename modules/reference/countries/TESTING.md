# Axiom Countries Service - Full Integration Test Guide

This guide walks through testing the complete data pipeline from CSV to PostgreSQL via RabbitMQ.

## Prerequisites

✅ Docker Desktop installed and running
✅ Go 1.21+ installed
✅ curl (for API testing)

## Step 1: Start Infrastructure with Docker

```powershell
# Start PostgreSQL and RabbitMQ
docker-compose up -d

# Verify services are running
docker-compose ps

# Check PostgreSQL is ready
docker exec axiom-postgres pg_isready -U axiom

# Check RabbitMQ is ready
docker exec axiom-rabbitmq rabbitmq-diagnostics ping
```

**Access Points:**

- PostgreSQL: `localhost:5432` (user: axiom, password: changeme)
- RabbitMQ AMQP: `localhost:5672`
- RabbitMQ Management UI: <http://localhost:15672> (user: axiom, password: changeme)

## Step 2: Run Database Migrations

```powershell
cd modules\reference\countries

# Option A: Using psql
docker exec -i axiom-postgres psql -U axiom -d axiom_db < migrations\001_create_countries_table.up.sql

# Option B: Using PowerShell script
$env:PGPASSWORD = "changeme"
psql -h localhost -p 5432 -U axiom -d axiom_db -f migrations\001_create_countries_table.up.sql

# Verify table was created
docker exec axiom-postgres psql -U axiom -d axiom_db -c "\dt reference.*"
```

## Step 3: Build and Configure the Countries Service

```powershell
# Install Go dependencies
go mod tidy

# Create .env file from example
Copy-Item .env.example .env

# Edit .env with Docker service endpoints (already set correctly for docker-compose)
# DB_HOST=localhost
# DB_PASSWORD=changeme
# RABBITMQ_HOST=localhost
# RABBITMQ_PASSWORD=changeme
```

## Step 4: Start the Countries Service

```powershell
# Run the service
go run cmd\countries\main.go

# You should see:
# Starting axiom.reference.countries service
# Database connection established
# RabbitMQ consumer initialized
# HTTP server listening on port 8080
# Service running. Press Ctrl+C to exit.
```

Keep this terminal open - the service will consume messages from RabbitMQ.

## Step 5: Publish Test Data to RabbitMQ

Open a **new terminal** and run:

```powershell
cd modules\reference\countries

# Generate message envelopes
.\scripts\publish-to-rabbitmq.ps1 -RabbitMQPassword "changeme"

# This creates test_messages.json with properly formatted messages
```

### Publishing Messages (Choose One Method)

**Method A: RabbitMQ Management UI (Easiest)**

1. Open <http://localhost:15672>
2. Login: axiom / changeme
3. Go to "Queues" tab → Click "axiom.reference.countries"
4. Scroll to "Publish message"
5. Open `test_messages.json` and copy one message envelope
6. Paste into "Payload" field
7. Click "Publish message"
8. Repeat for a few countries

**Method B: Using rabbitmqadmin CLI**

```powershell
# Download rabbitmqadmin
Invoke-WebRequest -Uri "http://localhost:15672/cli/rabbitmqadmin" -OutFile "rabbitmqadmin"

# Publish first message
$msg = Get-Content test_messages.json | Select-Object -First 1
python rabbitmqadmin publish routing_key="axiom.reference.countries" payload="$msg"
```

**Method C: Direct Database Seed (Bypass Queue)**

```powershell
# For quick testing without the queue
.\scripts\seed-database.ps1 -DbPassword "changeme"
```

## Step 6: Monitor Processing

In the terminal running the countries service, you should see:

```
Processed country: AF (Afghanistan)
Processed country: AL (Albania)
Processed country: DZ (Algeria)
...
```

## Step 7: Verify Data via HTTP API

```powershell
# Check service health
curl http://localhost:8080/health

# Check database readiness
curl http://localhost:8080/ready

# List all countries
curl http://localhost:8080/countries

# Get specific country
curl http://localhost:8080/countries/US
curl http://localhost:8080/countries/AF
```

## Step 8: Verify Data in PostgreSQL

```powershell
# Query the database directly
docker exec -it axiom-postgres psql -U axiom -d axiom_db

# In psql:
SELECT alpha2, alpha3, name_english, status FROM reference.countries ORDER BY name_english;
SELECT COUNT(*) FROM reference.countries;
\q
```

## Troubleshooting

### Service won't start

```powershell
# Check if ports are available
Test-NetConnection -ComputerName localhost -Port 5432
Test-NetConnection -ComputerName localhost -Port 5672
Test-NetConnection -ComputerName localhost -Port 8080

# Check Docker containers
docker-compose logs postgres
docker-compose logs rabbitmq
```

### Messages not processing

```powershell
# Check RabbitMQ queue
# Management UI → Queues → axiom.reference.countries
# Should show messages being consumed

# Check service logs
# Look for errors in the terminal running the service
```

### Database connection failed

```powershell
# Test PostgreSQL connection
docker exec axiom-postgres psql -U axiom -d axiom_db -c "SELECT 1"

# Check if schema exists
docker exec axiom-postgres psql -U axiom -d axiom_db -c "\dn"
```

## Cleanup

```powershell
# Stop the countries service (Ctrl+C in its terminal)

# Stop Docker containers
docker-compose down

# Remove all data (optional)
docker-compose down -v
```

## What's Next?

1. ✅ Add more test data to CSV
2. ✅ Build csv2json utility for automated CSV processing
3. ✅ Build canonicalizer service for data standardization
4. ✅ Add automated tests
5. ✅ Set up CI/CD pipeline

## Architecture Reminder

```
CSV Data → csv2json → RabbitMQ → Countries Service → PostgreSQL
                                         ↓
                                   HTTP API (port 8080)
```

Current test shortcuts:

- We're manually publishing to RabbitMQ (simulating canonicalizer output)
- Full pipeline: csv2json → canonicalizer → RabbitMQ → countries service
