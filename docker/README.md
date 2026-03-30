# Docker Build Configuration

## Overview

This directory contains Dockerfiles for the Axiom application with environment-specific configurations.

Base images and infra images are sourced from the Public ECR Docker library mirror
(`public.ecr.aws/docker/library/*`) to avoid corporate filtering that blocks Docker
Hub blob CDN URLs.

## Files

### Dockerfile.backend

**Purpose:** Local development and main-branch intraday fixes with corporate proxy/firewall workarounds  
**Use in:** `docker-compose.dev.yml`, `docker-compose.main.yml`  
**Features:**

- Disables SSL verification (`git config --global http.sslVerify false`)
- Sets `GOINSECURE="*"` to bypass Go module proxy SSL checks
- Sets `GOPRIVATE="*"` for private module handling

⚠️ **Warning:** This file contains security workarounds for corporate firewalls and should **NEVER** be used in production.

### Dockerfile.backend.clean

**Purpose:** Production/UAT/CI-CD deployments  
**Use in:** `docker-compose.prod.yml`, `docker-compose.uat.yml`, CI/CD pipelines  
**Features:**

- Proper SSL certificate verification
- Standard Go module download via official proxy
- Production-ready security settings

✅ **Use this for all non-local environments**

### Dockerfile.frontend

**Purpose:** Frontend Next.js application for all environments  
**Features:**

- Uses `--legacy-peer-deps` flag to handle React 19 dependency conflicts with older packages
- Multi-stage build for optimized production images
- **Development mode:** Supports hot reload via volume mounts (see `docker-compose.dev.yml`)

**Hot Reload in Development:**
When using `docker-compose.dev.yml`, the frontend runs with:

- Source code mounted as volume (`./frontend:/app`)
- Node modules and .next preserved in container
- `npm run dev` command for Next.js Fast Refresh
- Changes appear instantly without Docker rebuild

**Production Mode:**
Uses `npm start` to run pre-built static assets from multi-stage build.

### Dockerfile.docs-user

**Purpose:** Build and serve static `docs-user/` VitePress documentation  
**Use in:** `docker-compose.dev.yml` with `docs` profile  
**Features:**

- Multi-stage build (`node:22-alpine` -> `nginx:alpine`)
- Deterministic dependency install with `npm ci`
- Ships static output from `docs-user/.vitepress/dist`

**Dev profile usage:**

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml --profile docs up -d docs-user
```

Then open `http://localhost:15173/docs-user/`.

**Main profile usage:**

```bash
docker compose --env-file .env.main -f docker-compose.main.yml --profile docs up -d docs-user
```

Then open `http://localhost:45173/docs-user/`.

## Usage

### Main Branch (intraday development and fixes)

```bash
docker-compose --env-file .env.main -f docker-compose.main.yml up -d
```

Or via Make:

```bash
make docker-main-up
```

To include the docs container in main branch daily workflow:

```bash
docker compose -f docker-compose.main.yml --env-file .env.main --profile docs up -d
```

### Local Development (with corporate proxy)

```bash
docker-compose -f docker-compose.dev.yml --env-file .env.dev up
```

### Local Development with Always-On User Docs

```bash
docker compose -f docker-compose.dev.yml --env-file .env.dev --profile docs up -d
```

This starts the normal dev stack plus a static docs container.

### Production

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.prod up
```

### UAT

```bash
docker-compose -f docker-compose.uat.yml --env-file .env.uat up
```

## Troubleshooting

### Corporate Firewall Issues

If you encounter SSL/TLS certificate errors during local development:

1. **Symptom:** `x509: certificate signed by unknown authority`
2. **Cause:** Corporate HTTPS inspection/proxy
3. **Solution:** The `Dockerfile.backend` (dev version) includes workarounds for this

### Building Without Docker

If Docker builds continue to fail due to corporate restrictions, you can run the infrastructure only:

```bash
docker-compose -f docker-compose.infra.yml --env-file .env.dev up -d
```

Then run backend and frontend locally:

**Backend:**

```bash
cd backend
go run cmd/api/main.go
```

**Frontend:**

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

## Best Practices

1. **Never commit** SSL workarounds to production Dockerfiles
2. **Always use** `.clean` versions in CI/CD pipelines
3. **Document** any environment-specific changes
4. **Test** production builds in environments with proper SSL certificates before deploying

## CI/CD Configuration

When setting up CI/CD pipelines (GitHub Actions, Azure DevOps, etc.), ensure:

- Use `Dockerfile.backend.clean` for builds
- Proper SSL certificates are configured
- No `GOINSECURE` or SSL bypass flags are present
- Build happens in trusted environment with proper network access
