# Multi-Environment Documentation

This directory contains documentation for Axiom's multi-environment Docker setup, which allows running development,
UAT, and production environments simultaneously on the same machine.

The setup includes four environments: main, dev, uat, and prod.

## Documentation Files

### [Multi-Environment Setup Guide](multi-environment-setup.md)

Comprehensive guide covering:

- Architecture overview with diagram
- Port assignment strategy
- Configuration files and Docker Compose setup
- Usage instructions and workflows
- Troubleshooting and best practices

### [Multi-Environment Quick Start](multi-environment-quickstart.md)

Quick reference guide with:

- Common commands for environment management
- Quick access URLs for all environments
- Port reference table
- Common workflows and examples
- Troubleshooting tips

### [Environment Port Reference](environment-port-reference.md)

Quick reference card containing:

- Port mapping table for all environments
- Quick access URLs
- Container and network naming conventions
- Default credentials (for development only)

## Quick Command Reference

```bash
# Start individual environment
make docker-main-up
make docker-dev-up
make docker-uat-up
make docker-prod-up

# Start all environments
make docker-all-up

# Check status
make docker-all-status

# Run API smoke checks (smoke-enabled environments only: dev, uat, prod)
make smoke-api

# If make is unavailable, use the PowerShell or CMD script variants shown below

# Run API smoke checks for one environment
make smoke-api env=uat

# Makefile: wait longer for API readiness before smoke checks
make smoke-api env=dev startup_wait=120

# PowerShell: wait longer for API readiness before smoke checks
./scripts/smoke-api.ps1 -Environment dev -StartupWaitSec 120

# Validate setup
make validate-env

# Windows (no make): run smoke checks via CMD wrapper
scripts\smoke-api.cmd all
```

## Port Prefixes

- **4xxxx** - Main branch environment
- **1xxxx** - Development environment
- **2xxxx** - UAT environment
- **3xxxx** - Production environment

## Getting Started

1. Start with the [Quick Start Guide](multi-environment-quickstart.md) for immediate usage
2. Read the [Setup Guide](multi-environment-setup.md) for comprehensive understanding
3. Keep the [Port Reference](environment-port-reference.md) handy for quick lookups
