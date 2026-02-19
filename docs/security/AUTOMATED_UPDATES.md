# Automated Security Updates

This document explains the comprehensive automated security update system that handles ALL vulnerable dependencies
(Alpine packages, Go modules, npm packages) while maintaining version pinning for reproducibility.

## Overview

The Axiom project uses a multi-layered approach to security updates:

1. **Security Scan Enhanced Workflow** - Automatically scans for vulnerabilities and creates PRs with fixes
2. **Dependabot** - Monitors base images and dependencies for updates
3. **Version Tracking** - Documents all pinned versions for audit trail
4. **Manual Security Fixes** - Explicitly pins critical security updates in Dockerfiles

## System Components

### 1. Security Scan Enhanced Workflow

**File:** `.github/workflows/security-scan-enhanced.yml`

This workflow is the primary automated security update system that:

- Runs weekly on Mondays at 9 AM UTC
- Can be triggered manually via workflow_dispatch
- Scans Docker images for vulnerabilities using Trivy
- Automatically updates vulnerable packages
- Creates a single consolidated PR with all updates

#### What It Scans

- **Backend Docker Image:** Alpine packages and Go binaries
- **Frontend Docker Image:** Alpine packages and npm packages

#### What It Updates

1. **Alpine Packages** in:
   - `docker/Dockerfile.frontend`
   - `docker/Dockerfile.backend`
   - `docker/Dockerfile.backend.clean`

2. **Go Modules** in:
   - `backend/go.mod`
   - `backend/go.sum`

3. **npm Packages** in:
   - `frontend/package.json`
   - `frontend/package-lock.json`

#### How It Works

```text
1. Build Docker images from current code
   ├─ Backend: docker/Dockerfile.backend
   └─ Frontend: docker/Dockerfile.frontend

2. Run Trivy security scans
   ├─ Output: JSON format for parsing
   └─ Severity: CRITICAL, HIGH, MEDIUM

3. Parse scan results
   ├─ Extract vulnerable packages
   ├─ Group by type (Alpine, Go, npm)
   └─ Filter for packages with fixes available

4. Update dependencies
   ├─ Alpine: Update pinned versions in Dockerfiles
   ├─ Go: Run 'go get package@version' and 'go mod tidy'
   └─ npm: Run 'npm install package@version --legacy-peer-deps'

5. Create consolidated PR
   ├─ Title: "🔒 Automated Security Updates - X Critical, Y High"
   ├─ Body: Detailed table of updates with CVE info
   ├─ Labels: security, dependencies, automated
   └─ Reviewers: techie2000
```

### 2. Dependabot Configuration

**File:** `.github/dependabot.yml`

Dependabot complements the security scan workflow by monitoring base images and creating individual PRs for updates.

#### What It Monitors

- **Docker base images** in `/docker` directory
  - `alpine:3.21`
  - `golang:1.24-alpine3.21`
  - `node:22-alpine3.21`

- **Go modules** in `/backend` directory
  - All dependencies in `go.mod`
  - Groups updates by: security, framework, stdlib

- **npm packages** in `/frontend` directory
  - All dependencies in `package.json`
  - Groups updates by: security, framework, dev dependencies

#### Schedule

- Runs weekly on Mondays at 9 AM UTC
- Creates individual PRs for each update type
- Auto-assigns techie2000 as reviewer
- Adds appropriate labels (dependencies, security, etc.)

#### Grouping Strategy

Dependabot groups related updates together:

- **Security updates** - All security patches grouped
- **Framework updates** - Major frameworks (Gin, GORM, Next.js, React)
- **Standard library** - Go standard library packages
- **Development dependencies** - TypeScript, type definitions

### 3. Version Tracking

**File:** `.github/security-versions.yml`

This file serves as the single source of truth for all pinned versions and documents:

- Current versions of Alpine packages
- Current versions of Go modules
- Current versions of npm packages
- Last update timestamps
- Reason for each version (security, feature, etc.)
- Severity level of addressed vulnerabilities
- Files where each version is used

#### Example Entry

```yaml
alpine_packages:
  libssl3:
    version: "3.3.6-r0"
    reason: "Security fix for CVE vulnerabilities (Alert #117)"
    updated: "2026-02-19"
    severity: "CRITICAL"
    files:
      - docker/Dockerfile.frontend (build & runtime stages)
      - docker/Dockerfile.backend (build & runtime stages)
      - docker/Dockerfile.backend.clean (build & runtime stages)
```

### 4. Manual Security Fixes

In addition to automated scans, critical vulnerabilities are explicitly addressed in Dockerfiles:

#### libssl3 Security Fix (Alert #117)

All Dockerfiles now include explicit libssl3 upgrades:

```dockerfile
# Security: Upgrade libssl3 to address CVE vulnerabilities (Alert #117)
# Version 3.3.6-r0 addresses critical SSL/TLS vulnerabilities
RUN apk update && apk add --no-cache --upgrade libssl3=3.3.6-r0
```

This ensures:
- libssl3 is always upgraded to the secure version
- Clear documentation of why the upgrade is needed
- Version pinning for reproducibility

## Usage

### Automatic Weekly Scans

The security scan runs automatically every Monday at 9 AM UTC. No action required.

### Manual Trigger

To manually trigger a security scan:

1. Navigate to the GitHub Actions tab
2. Select "Security Scan Enhanced" workflow
3. Click "Run workflow" button
4. Select branch (usually `main` or `develop`)
5. Choose whether to create PR (default: true)
6. Click "Run workflow"

### Reviewing Security Updates PR

When a security updates PR is created:

1. **Review the PR description**
   - Check the summary of vulnerabilities
   - Review the list of packages being updated
   - Note the severity levels (Critical, High, Medium)

2. **Verify the changes**
   ```bash
   # Checkout the PR branch
   gh pr checkout <PR-NUMBER>
   
   # Build Docker images
   docker compose --env-file .env.dev -f docker-compose.dev.yml build --no-cache
   
   # Run tests
   cd backend && go test ./... -v
   cd ../frontend && npm test
   
   # Run security scan again to verify fixes
   docker build -f docker/Dockerfile.backend -t axiom-backend:test ./backend
   trivy image --severity CRITICAL,HIGH axiom-backend:test
   ```

3. **Check for breaking changes**
   - Review Go module updates for API changes
   - Check npm package updates for breaking changes
   - Test affected functionality

4. **Approve and merge**
   - If all checks pass, approve the PR
   - Merge using squash merge to keep history clean
   - PR branch will be automatically deleted

## Version Pinning Philosophy

### Why We Pin Versions

1. **Reproducibility** - Identical builds across all environments
2. **Controlled Updates** - Deliberate version updates with testing
3. **Audit Trail** - Clear history of what changed and when
4. **Prevention of Surprises** - No unexpected breaking changes

### How We Balance Security vs Stability

- **Security patches** - Automatically updated with automated testing
- **Minor updates** - Reviewed and tested before merge
- **Major updates** - Planned with comprehensive testing
- **Breaking changes** - Evaluated carefully with migration plan

### Version Format

- **Alpine packages:** `package=X.Y.Z-rN` (e.g., `libssl3=3.3.6-r0`)
- **Go modules:** `vX.Y.Z` (e.g., `v1.11.0`)
- **npm packages:** `^X.Y.Z` or `X.Y.Z` (e.g., `15.2.9`)

## Workflow Integration

### CI/CD Pipeline

```text
On Push to main/develop:
├─ Security Scan Enhanced (if paths changed)
│  ├─ Build Docker images
│  ├─ Scan for vulnerabilities
│  ├─ Update dependencies
│  └─ Create PR if fixes found
│
├─ Existing CI checks
│  ├─ Linting
│  ├─ Tests
│  └─ Build verification
│
└─ Existing security scan
   └─ Upload SARIF to GitHub Security tab

Weekly (Monday 9 AM UTC):
├─ Security Scan Enhanced
│  └─ Create PR with all security updates
│
└─ Dependabot
   └─ Create PRs for base image updates
```

### PR Labels

Security update PRs are labeled with:
- `security` - Security-related changes
- `dependencies` - Dependency updates
- `automated` - Automated by workflow
- `backend` or `frontend` - Affected component
- `critical` or `high` - Based on severity

## Troubleshooting

### Workflow Fails to Create PR

**Symptom:** Workflow runs successfully but no PR is created

**Possible causes:**
1. No fixable vulnerabilities found (expected behavior)
2. PR with same updates already exists
3. GitHub token permissions issue

**Solution:**
```bash
# Check workflow logs for "No fixable vulnerabilities found"
# If token issue, verify workflow permissions in .github/workflows/security-scan-enhanced.yml
permissions:
  contents: write
  pull-requests: write
  security-events: write
```

### Updates Fail to Apply

**Symptom:** Workflow reports errors when updating packages

**Possible causes:**
1. Version conflicts in Go modules
2. Breaking changes in npm packages
3. Alpine package not available in repository

**Solution:**
```bash
# For Go modules
cd backend
go get package@version  # Test manually
go mod tidy

# For npm packages
cd frontend
npm install package@version --legacy-peer-deps

# For Alpine packages
# Check if version exists: https://pkgs.alpinelinux.org/packages
```

### Docker Build Fails After Updates

**Symptom:** Docker build fails after applying security updates

**Possible causes:**
1. Incompatible package versions
2. Missing dependencies
3. API changes in updated libraries

**Solution:**
```bash
# Build with verbose output
docker build --no-cache --progress=plain -f docker/Dockerfile.backend ./backend

# Check logs for specific error
# Roll back problematic update if needed
git revert <commit>

# Report issue in PR comments for manual review
```

### Scan Finds No Vulnerabilities but GitHub Alerts Exist

**Symptom:** GitHub Security tab shows alerts but workflow finds none

**Possible causes:**
1. Alerts for vulnerabilities without fixes yet
2. Alerts in code not scanned by Trivy (source code issues)
3. Workflow scanning different images than production

**Solution:**
1. Check if fixes are available in Alpine/npm/Go repos
2. Review CodeQL alerts separately (not handled by this workflow)
3. Ensure workflow builds from latest code

## Configuration

### Adjusting Scan Schedule

Edit `.github/workflows/security-scan-enhanced.yml`:

```yaml
on:
  schedule:
    # Change to daily at midnight UTC
    - cron: '0 0 * * *'
    # Or bi-weekly on Mondays
    - cron: '0 9 * * 1,15'
```

### Changing Severity Levels

To scan for different severity levels:

```yaml
- name: Run Trivy scan on Backend (JSON output)
  uses: aquasecurity/trivy-action@master
  with:
    severity: 'CRITICAL,HIGH'  # Remove MEDIUM for stricter filtering
```

### Excluding Packages

To exclude specific packages from automated updates, add to workflow:

```bash
# In parse-vulns step
EXCLUDED_PACKAGES="package1 package2"
if echo "$EXCLUDED_PACKAGES" | grep -q "$pkg"; then
  echo "Skipping excluded package: $pkg"
  continue
fi
```

## Best Practices

### Before Merging Security Updates

1. ✅ Review all changes in the PR
2. ✅ Check for breaking changes in changelogs
3. ✅ Run full test suite
4. ✅ Test in dev environment
5. ✅ Verify with fresh Docker build
6. ✅ Check application logs after deployment

### Monitoring Security

1. 📊 Review GitHub Security tab weekly
2. 🔔 Enable notifications for security alerts
3. 📝 Update security-versions.yml when manually updating
4. 🧪 Test security updates in UAT before production
5. 📚 Document security incidents and resolutions

### Emergency Security Updates

For critical vulnerabilities requiring immediate action:

1. **Manual workflow trigger** - Don't wait for weekly scan
2. **Expedited review** - Fast-track PR approval
3. **Direct deployment** - Deploy to production immediately after UAT
4. **Communication** - Notify team of urgent security update

## References

- [Trivy Documentation](https://aquasecurity.github.io/trivy/)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [Alpine Linux Packages](https://pkgs.alpinelinux.org/)
- [Go Modules Documentation](https://go.dev/ref/mod)
- [npm Security Best Practices](https://docs.npmjs.com/packages-and-modules/securing-your-code)

## Related Files

- `.github/workflows/security-scan-enhanced.yml` - Main security scan workflow
- `.github/workflows/security-scan.yml` - Original security scan (issue creation)
- `.github/dependabot.yml` - Dependabot configuration
- `.github/security-versions.yml` - Version tracking document
- `docker/Dockerfile.frontend` - Frontend Docker image with security fixes
- `docker/Dockerfile.backend` - Backend Docker image with security fixes
- `docker/Dockerfile.backend.clean` - Production backend image with security fixes

## Support

For questions or issues with the automated security update system:

1. Check this documentation first
2. Review workflow logs in GitHub Actions
3. Check existing issues and PRs with `security` label
4. Create new issue with label `security` and mention @techie2000
