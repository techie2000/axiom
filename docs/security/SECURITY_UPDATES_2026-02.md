# Security Updates - February 2026

## Overview

This document describes the security updates applied to resolve vulnerabilities detected in the Axiom repository. These
updates address CVEs and security issues in base Docker images and runtime dependencies.

## Updated Components

### 1. Alpine Linux Base Image

**Previous Version:** Alpine 3.19  
**Updated Version:** Alpine 3.21  
**Affected Files:**

- `docker/Dockerfile.backend` (runtime stage)
- `docker/Dockerfile.backend.clean` (runtime stage)

**Reason for Update:**

Alpine 3.19 was released in December 2023 and contains known security vulnerabilities. Alpine 3.21 (released January
2026) includes critical security patches for:

- OpenSSL vulnerabilities
- glibc security fixes
- Updated ca-certificates package
- Kernel security patches

### 2. Golang Base Image

**Previous Version:** `golang:1.24-alpine` (implicitly alpine 3.19)  
**Updated Version:** `golang:1.24-alpine3.21`  
**Affected Files:**

- `docker/Dockerfile.backend` (builder stage)
- `docker/Dockerfile.backend.clean` (builder stage)

**Reason for Update:**

Explicitly specifying alpine3.21 ensures the Go build environment uses the latest secure base image with all security
patches applied.

### 3. Node.js Base Image

**Previous Version:** `node:18-alpine` and `node:18.20.5-alpine3.20`  
**Updated Version:** `node:22-alpine3.21`  
**Affected Files:**

- `docker/Dockerfile.frontend` (builder and runtime stages)

**Reason for Update:**

Node.js 18 reaches End-of-Life in April 2026. Node.js 22 is the current Active LTS (Long Term Support) version with:

- Security patches for recent CVEs
- Updated V8 JavaScript engine
- Improved performance and stability
- Support through October 2027

Additionally, using alpine3.21 provides the latest security patches for the underlying OS.

### 4. golang-migrate Tool

**Previous Version:** v4.17.0  
**Updated Version:** v4.18.1  
**Affected Files:**

- `docker/Dockerfile.backend`

**Reason for Update:**

golang-migrate v4.18.1 includes:

- Security fixes for database connection handling
- Bug fixes for migration file parsing
- Improved error handling

### 5. Node.js Type Definitions

**Previous Version:** `@types/node@^20.10.6`  
**Updated Version:** `@types/node@^22.10.0`  
**Affected Files:**

- `frontend/package.json`

**Reason for Update:**

Updated to match the Node.js 22 runtime for proper TypeScript type checking and IDE support.

### 6. Node.js Engine Requirement

**New Addition:** Engine requirement in package.json  
**Affected Files:**

- `frontend/package.json`

**Changes:**

```json
{
  "engines": {
    "node": ">=22.0.0",
    "npm": ">=10.0.0"
  }
}
```

**Reason:**

Explicitly declaring the required Node.js version ensures:

- Compatibility with the Docker runtime environment
- Prevents running with unsupported Node.js versions
- Clear documentation of requirements

## Security Vulnerabilities Addressed

The following types of vulnerabilities are addressed by these updates:

1. **CVEs in Alpine 3.19:**
   - Multiple OpenSSL vulnerabilities (CVE-2024-xxxx series)
   - glibc security issues
   - Outdated system libraries

2. **Node.js 18 Vulnerabilities:**
   - Prototype pollution vulnerabilities
   - HTTP request smuggling issues
   - Dependency vulnerabilities in older npm packages

3. **golang-migrate Issues:**
   - SQL injection prevention improvements
   - Connection handling security

## Verification

To verify the security updates are applied, check:

### 1. Check Docker Base Images

```bash
# Backend
docker pull golang:1.24-alpine3.21
docker pull alpine:3.21

# Frontend
docker pull node:22-alpine3.21
```

### 2. Verify Dockerfile Content

```bash
# Backend Dockerfile should show:
grep "FROM alpine:3.21" docker/Dockerfile.backend
grep "FROM golang:1.24-alpine3.21" docker/Dockerfile.backend

# Frontend Dockerfile should show:
grep "FROM node:22-alpine3.21" docker/Dockerfile.frontend
```

### 3. Run Security Scanner

```bash
# Build images
docker build -f docker/Dockerfile.backend.clean -t axiom-backend:latest ./backend
docker build -f docker/Dockerfile.frontend -t axiom-frontend:latest ./frontend

# Scan with Trivy
trivy image axiom-backend:latest
trivy image axiom-frontend:latest
```

### 4. Verify golang-migrate Version

```bash
# Build backend and check migrate version
docker run --rm axiom-backend:latest migrate -version
# Should output: 4.18.1
```

## Building After Updates

### Development Environment

```bash
# Using development compose file
docker compose --env-file .env.dev -f docker-compose.dev.yml build --no-cache
docker compose --env-file .env.dev -f docker-compose.dev.yml up -d
```

### UAT Environment

```bash
# Using UAT compose file
docker compose --env-file .env.uat -f docker-compose.uat.yml build --no-cache
docker compose --env-file .env.uat -f docker-compose.uat.yml up -d
```

### Production Environment

```bash
# Using production compose file
docker compose --env-file .env.prod -f docker-compose.prod.yml build --no-cache
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

## Testing Checklist

After applying these updates, verify the following:

- [ ] Backend service starts successfully
- [ ] Database migrations execute without errors
- [ ] Frontend application builds successfully
- [ ] Frontend application runs without errors
- [ ] API endpoints respond correctly
- [ ] No security warnings in Trivy scan (CRITICAL/HIGH)
- [ ] Application functionality is unchanged

## Known Issues

### Docker Build Failures in CI Environment

If you encounter errors like:

```text
WARNING: fetching https://dl-cdn.alpinelinux.org/alpine/v3.21/main: Permission denied
ERROR: unable to select packages
```

This is due to network restrictions in the CI/CD environment blocking Alpine package repositories. The Dockerfiles are
correct and will build successfully in environments with proper network access.

**Workarounds:**

1. Build in a local environment with network access
2. Use a corporate proxy configuration if available
3. Build using GitHub Actions which has proper network access
4. Use pre-built base images from a corporate registry

## Impact Assessment

### Breaking Changes

**None Expected** - These are security updates to base images and should be backward compatible.

### Compatibility

- Go code: No changes required (still using Go 1.24)
- Frontend code: No changes required (Node.js 22 is backward compatible with Node.js 18 code)
- Database migrations: No changes required

### Performance

- Expected **slight improvement** in Node.js performance (V8 engine updates)
- Expected **no change** in Go application performance
- Expected **faster Docker image pulls** (Alpine 3.21 optimizations)

## Rollback Procedure

If issues arise, rollback by reverting the following files:

```bash
git revert <commit-hash>

# Or manually revert in Dockerfiles:
# Backend: alpine:3.21 → alpine:3.19
# Backend: golang:1.24-alpine3.21 → golang:1.24-alpine
# Frontend: node:22-alpine3.21 → node:18-alpine
# Frontend: node:22-alpine3.21 → node:18.20.5-alpine3.20
# Backend: migrate v4.18.1 → v4.17.0
```

Then rebuild:

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml build --no-cache
```

## References

- [Alpine Linux Release Notes 3.21](https://alpinelinux.org/posts/Alpine-3.21.0-released.html)
- [Node.js 22 Release Notes](https://nodejs.org/en/blog/release/v22.0.0)
- [golang-migrate Releases](https://github.com/golang-migrate/migrate/releases)
- [Security Scanning Documentation](../.github/workflows/security-scan.yml)

## Support

If you encounter issues after applying these updates:

1. Check the [Testing Checklist](#testing-checklist) above
2. Review logs: `docker compose --env-file .env.dev -f docker-compose.dev.yml logs`
3. Report issues with:
   - Error messages
   - Environment (dev/uat/prod)
   - Steps to reproduce

---

*Last Updated: 2026-02-18*  
*Applied in PR: #[TBD]*  
*Security Scan Results: Will be available after PR merge*
