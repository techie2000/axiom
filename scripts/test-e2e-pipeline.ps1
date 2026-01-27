# End-to-End Pipeline Test
# Tests the complete flow: CSV → csv2json → RabbitMQ → canonicalizer → PostgreSQL

param(
    [Parameter(Mandatory=$false)]
    [switch]$Clean,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Write-Step { Write-Host "==> $args" -ForegroundColor Cyan }
function Write-Success { Write-Host "✓ $args" -ForegroundColor Green }
function Write-Fail { Write-Host "✗ $args" -ForegroundColor Red }
function Write-Info { Write-Host "    $args" -ForegroundColor Gray }

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         Axiom End-to-End Pipeline Test             ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Navigate to project root
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

if ($Clean) {
    Write-Step "Cleaning up previous test run..."
    docker-compose down -v
    Write-Success "Cleaned up"
    Write-Host ""
}

# Step 1: Build services
if (-not $SkipBuild) {
    Write-Step "Step 1: Building services..."
    Write-Info "Building csv2json, canonicalizer..."
    
    docker-compose build csv2json canonicalizer
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Build failed"
        exit 1
    }
    Write-Success "Services built successfully"
    Write-Host ""
}

# Step 2: Start infrastructure
Write-Step "Step 2: Starting infrastructure (PostgreSQL, RabbitMQ)..."
docker-compose up -d postgres rabbitmq

Write-Info "Waiting for services to be healthy..."
$maxWait = 30
$waited = 0
while ($waited -lt $maxWait) {
    $pgHealth = docker inspect axiom-postgres --format='{{.State.Health.Status}}' 2>$null
    $rmqHealth = docker inspect axiom-rabbitmq --format='{{.State.Health.Status}}' 2>$null
    
    if ($pgHealth -eq "healthy" -and $rmqHealth -eq "healthy") {
        break
    }
    
    Start-Sleep 2
    $waited += 2
    Write-Info "Waiting... ($waited/$maxWait seconds)"
}

if ($waited -ge $maxWait) {
    Write-Fail "Services did not become healthy in time"
    docker-compose logs postgres rabbitmq
    exit 1
}

Write-Success "Infrastructure ready"
Write-Host ""

# Step 3: Run migrations
Write-Step "Step 3: Running database migrations..."
Write-Info "Creating schema and tables..."

$migrationFile = "modules/reference/countries/migrations/001_create_countries_table.up.sql"
Get-Content $migrationFile | docker exec -i axiom-postgres psql -U axiom -d axiom_db

if ($LASTEXITCODE -ne 0) {
    Write-Fail "Migration failed"
    exit 1
}

Write-Success "Migrations applied"
Write-Host ""

# Step 4: Run csv2json
Write-Step "Step 4: Running csv2json (CSV → JSON → RabbitMQ)..."
Write-Info "Processing: modules/reference/countries/data/countries.csv"

docker-compose up csv2json

if ($LASTEXITCODE -ne 0) {
    Write-Fail "csv2json failed"
    docker-compose logs csv2json
    exit 1
}

Write-Success "CSV data published to RabbitMQ"
Write-Host ""

# Verify messages in RabbitMQ
Write-Step "Step 4a: Verifying messages in RabbitMQ..."
Start-Sleep 2

$queueInfo = docker exec axiom-rabbitmq rabbitmqctl list_queues -p /axiom name messages 2>$null | Select-String "axiom.reference.countries"
if ($queueInfo) {
    Write-Info $queueInfo
    Write-Success "Messages queued for processing"
} else {
    Write-Fail "No messages found in queue"
    exit 1
}
Write-Host ""

# Step 5: Run canonicalizer
Write-Step "Step 5: Running canonicalizer (RabbitMQ → Transform → PostgreSQL)..."
Write-Info "Applying transformation rules and writing to database..."

docker-compose up -d canonicalizer

# Wait for processing
Write-Info "Waiting for canonicalizer to process messages..."
Start-Sleep 10

Write-Success "Canonicalizer running"
Write-Host ""

# Step 6: Verify data in PostgreSQL
Write-Step "Step 6: Verifying data in PostgreSQL..."

$countryCountRaw = docker exec -i axiom-postgres psql -U axiom -d axiom_db -t -c "SELECT COUNT(*) FROM reference.countries;"
# Extract just the number from the output (handle array or multi-line output)
$countryCount = ($countryCountRaw | Out-String).Trim()

Write-Info "Countries in database: $countryCount"

if ([int]$countryCount -eq 0) {
    Write-Fail "No countries found in database"
    docker-compose logs canonicalizer
    exit 1
}

Write-Success "$countryCount countries loaded"
Write-Host ""

# Step 7: Sample data verification
Write-Step "Step 7: Verifying data transformations..."

# Check Afghanistan (should have padded numeric: "004")
$afghanistan = docker exec -i axiom-postgres psql -U axiom -d axiom_db -t -c "SELECT alpha2, alpha3, numeric, name_english, status FROM reference.countries WHERE alpha2 = 'AF';"

Write-Info "Sample record (Afghanistan):"
Write-Host $afghanistan -ForegroundColor White

# Verify transformations
if ($afghanistan -like "*004*") {
    Write-Success "Numeric padding: '4' → '004' ✓"
} else {
    Write-Fail "Numeric padding failed"
    exit 1
}

if ($afghanistan -like "*AF*" -and $afghanistan -like "*AFG*") {
    Write-Success "Code uppercase: 'af' → 'AF', 'afg' → 'AFG' ✓"
} else {
    Write-Fail "Code uppercase transformation failed"
    exit 1
}

if ($afghanistan -like "*officially_assigned*") {
    Write-Success "Status validation: correctly stored ✓"
} else {
    Write-Fail "Status validation failed"
    exit 1
}

Write-Host ""

# Step 8: Check canonicalizer logs
Write-Step "Step 8: Checking canonicalizer logs..."
$logs = docker-compose logs --tail=20 canonicalizer
$processedCount = ($logs | Select-String "✓ Processed:").Count

Write-Info "Processed messages: $processedCount"
Write-Success "Canonicalizer processing complete"
Write-Host ""

# Summary
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║            End-to-End Test PASSED ✓                ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "Pipeline Verification:" -ForegroundColor Cyan
Write-Success "CSV file processed by csv2json"
Write-Success "Messages published to RabbitMQ"
Write-Success "Canonicalizer applied transformation rules"
Write-Success "$countryCount countries written to PostgreSQL"
Write-Success "All transformations validated"

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Info "- View RabbitMQ Management UI: http://localhost:15672 (axiom/changeme)"
Write-Info "- Query database: docker exec -it axiom-postgres psql -U axiom -d axiom_db"
Write-Info "- View logs: docker-compose logs -f canonicalizer"
Write-Info "- Stop services: docker-compose down"
Write-Host ""
