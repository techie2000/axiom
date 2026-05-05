# Security Documentation

This directory contains security-related documentation for the Axiom project, including security updates, vulnerability
fixes, and security best practices.

## Documentation Files

### [Automated Security Updates](AUTOMATED_UPDATES.md)

**NEW:** Comprehensive guide to the automated security update system covering:

- Security Scan Enhanced workflow - automatic vulnerability detection and fixes
- Dependabot configuration for base images and dependencies
- Version tracking and audit trail
- Manual security fixes in Dockerfiles
- Weekly scan schedule and manual trigger instructions
- Troubleshooting and best practices

### [Security Updates 2026-02](SECURITY_UPDATES_2026-02.md)

Comprehensive security update documentation for February 2026 updates covering:

- Docker base image updates (Alpine 3.19 → 3.21, Node 18 → 22, Go 1.24-alpine3.21)
- Go dependency updates (Gin, golang.org/x/net, and 15+ transitive dependencies)
- CVE resolutions and security impact analysis
- Verification procedures and testing checklist
- Rollback procedures and troubleshooting guide
- Compatibility assessment and migration notes

### [Agent Security Access](AGENT_SECURITY_ACCESS.md)

Explains why the Copilot coding agent cannot access Dependabot / code-scanning APIs
directly (the token has no `security_events` scope), and documents three approaches to
bridge this gap: paste-as-context, the weekly `security-report.yml` workflow, and a
fine-grained PAT stored as a repository secret.

### [CodeQL Workflow](../../.github/workflows/codeql-static-analysis.yml)

Advanced CodeQL configuration for this monorepo layout. The Go analysis runs from the
`backend/` module with an explicit build step (`go mod download && go build ./...`)
because GitHub default setup does not correctly process nested Go modules from repo root.

## Quick Reference

For a high-level summary of security updates, see [SECURITY_UPDATE_SUMMARY.md](SECURITY_UPDATE_SUMMARY.md).

## Automated Security System

The project now includes a comprehensive automated security update system:

- **Weekly scans** - Mondays at 9 AM UTC
- **Automatic updates** - Alpine packages, Go modules, npm packages
- **Consolidated PRs** - Single PR with all security fixes
- **Version tracking** - Audit trail in `.github/security-versions.yml`
- **Dependabot integration** - Base image updates
- **CodeQL advanced setup** - Go scanning builds from `backend/` instead of repo root

See [AUTOMATED_UPDATES.md](AUTOMATED_UPDATES.md) for complete documentation.

## Related Documentation

- [GitHub Security Scanning Dashboard](https://github.com/techie2000/axiom/security/code-scanning) - Current
  vulnerability scan results
- [Docker Best Practices](../../.github/instructions/containerization-docker-best-practices.instructions.md) -
  Container security guidelines
- [Security Scan Enhanced Workflow](../../.github/workflows/security-scan-enhanced.yml) - Automated security scanning
- [CodeQL Workflow](../../.github/workflows/codeql-static-analysis.yml) - Advanced CodeQL analysis for Go, JavaScript/TypeScript,
  and GitHub Actions
- [Dependabot Configuration](../../.github/dependabot.yml) - Dependency monitoring
- [Security Version Tracking](../../.github/security-versions.yml) - Pinned versions audit trail
