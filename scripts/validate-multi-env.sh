#!/bin/bash
# Multi-Environment Validation Script
# This script validates the multi-environment setup for Axiom

set -e

echo "=========================================="
echo "Axiom Multi-Environment Validation"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print success
success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Function to print error
error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if required files exist
echo "1. Checking configuration files..."
files=(".env.main" ".env.dev" ".env.uat" ".env.prod" "docker-compose.main.yml" "docker-compose.dev.yml" "docker-compose.uat.yml" "docker-compose.prod.yml")
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        success "$file exists"
    else
        error "$file missing"
        exit 1
    fi
done
echo ""

# Validate docker-compose files
echo "2. Validating docker-compose configurations..."
envs=("main" "dev" "uat" "prod")
for env in "${envs[@]}"; do
    if docker compose --env-file ".env.$env" -f "docker-compose.$env.yml" config > /dev/null 2>&1; then
        success "docker-compose.$env.yml is valid"
    else
        error "docker-compose.$env.yml has errors"
        exit 1
    fi
done
echo ""

# Check port configurations
echo "3. Validating port configurations..."
if grep -q "BACKEND_PORT=48080" .env.main && \
   grep -q "FRONTEND_PORT=43000" .env.main && \
   grep -q "POSTGRES_PORT=45432" .env.main; then
    success "Main branch ports correctly configured (prefix: 4)"
else
    error "Main branch ports incorrectly configured"
    exit 1
fi

if grep -q "BACKEND_PORT=18080" .env.dev && \
   grep -q "FRONTEND_PORT=13000" .env.dev && \
   grep -q "POSTGRES_PORT=15432" .env.dev; then
    success "Development ports correctly configured (prefix: 1)"
else
    error "Development ports incorrectly configured"
    exit 1
fi

if grep -q "BACKEND_PORT=28080" .env.uat && \
   grep -q "FRONTEND_PORT=23000" .env.uat && \
   grep -q "POSTGRES_PORT=25432" .env.uat; then
    success "UAT ports correctly configured (prefix: 2)"
else
    error "UAT ports incorrectly configured"
    exit 1
fi

if grep -q "BACKEND_PORT=38080" .env.prod && \
   grep -q "FRONTEND_PORT=33000" .env.prod && \
   grep -q "POSTGRES_PORT=35432" .env.prod; then
    success "Production ports correctly configured (prefix: 3)"
else
    error "Production ports incorrectly configured"
    exit 1
fi
echo ""

# Check Make targets
echo "4. Validating Makefile targets..."
make_targets=("docker-main-up" "docker-dev-up" "docker-uat-up" "docker-prod-up" "docker-all-up")
for target in "${make_targets[@]}"; do
    if grep -q "^$target:" Makefile; then
        success "Makefile target '$target' exists"
    else
        error "Makefile target '$target' missing"
        exit 1
    fi
done
echo ""

echo "=========================================="
echo -e "${GREEN}All validation checks passed!${NC}"
echo "=========================================="
echo ""
