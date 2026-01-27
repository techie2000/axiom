# Run all tests for the countries module
# This script provides a convenient way to run different test suites

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("unit", "integration", "all", "coverage")]
    [string]$TestType = "all",
    
    [Parameter(Mandatory=$false)]
    [switch]$Verbose,
    
    [Parameter(Mandatory=$false)]
    [switch]$Race
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Fail { Write-Host $args -ForegroundColor Red }

Write-Info "=== Countries Module Test Runner ==="
Write-Info ""

# Change to module directory
$moduleDir = Split-Path -Parent $PSScriptRoot
Set-Location $moduleDir

# Build test command
$testCmd = "go test"
$testArgs = @()

# Add verbose flag
if ($Verbose) {
    $testArgs += "-v"
}

# Add race detector
if ($Race) {
    $testArgs += "-race"
}

# Determine what to test
switch ($TestType) {
    "unit" {
        Write-Info "Running unit tests only (transformation logic)..."
        Write-Info ""
        $testArgs += "./internal/transform"
        $testArgs += "-short"
    }
    
    "integration" {
        Write-Info "Running integration tests (requires PostgreSQL)..."
        Write-Warning "Ensure PostgreSQL is running: docker-compose up -d postgres"
        Write-Info ""
        
        # Check if PostgreSQL is accessible
        $pgCheck = Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet
        if (-not $pgCheck) {
            Write-Fail "ERROR: Cannot connect to PostgreSQL on localhost:5432"
            Write-Fail "Start it with: docker-compose up -d postgres"
            exit 1
        }
        
        $testArgs += "./internal/repository"
    }
    
    "all" {
        Write-Info "Running all tests..."
        Write-Warning "Integration tests require PostgreSQL: docker-compose up -d postgres"
        Write-Info ""
        
        $testArgs += "./..."
    }
    
    "coverage" {
        Write-Info "Running tests with coverage report..."
        Write-Info ""
        
        $testArgs += "./..."
        $testArgs += "-coverprofile=coverage.out"
        $testArgs += "-covermode=atomic"
    }
}

# Run tests
Write-Info "Command: $testCmd $($testArgs -join ' ')"
Write-Info ""

try {
    & $testCmd @testArgs
    $exitCode = $LASTEXITCODE
    
    Write-Info ""
    
    if ($exitCode -eq 0) {
        Write-Success "✓ All tests passed!"
        
        # Generate coverage report if requested
        if ($TestType -eq "coverage" -and (Test-Path "coverage.out")) {
            Write-Info ""
            Write-Info "Generating HTML coverage report..."
            go tool cover -html=coverage.out -o coverage.html
            
            Write-Success "✓ Coverage report saved to coverage.html"
            Write-Info "Opening coverage report in browser..."
            Start-Process coverage.html
        }
    } else {
        Write-Fail "✗ Tests failed with exit code $exitCode"
        exit $exitCode
    }
    
} catch {
    Write-Fail "✗ Error running tests: $_"
    exit 1
}

Write-Info ""
Write-Info "=== Test Summary ==="

# Show test counts
switch ($TestType) {
    "unit" {
        Write-Info "Tests run: Transformation rules (transform package)"
        Write-Info "- Numeric code padding"
        Write-Info "- Status validation"
        Write-Info "- Code normalization"
        Write-Info "- Required field validation"
        Write-Info "- Complete transformation pipeline"
    }
    
    "integration" {
        Write-Info "Tests run: Database operations (repository package)"
        Write-Info "- CRUD operations"
        Write-Info "- Upsert functionality"
        Write-Info "- Database constraints"
        Write-Info "- Active country queries"
    }
    
    "all" {
        Write-Info "Tests run: All packages"
        Write-Info "- Unit tests (transformation logic)"
        Write-Info "- Integration tests (database operations)"
    }
    
    "coverage" {
        Write-Info "Tests run: All packages with coverage analysis"
        Write-Info "Report: coverage.html"
    }
}

Write-Info ""
Write-Success "Done!"
