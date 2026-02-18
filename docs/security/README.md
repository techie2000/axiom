# Security Documentation

This directory contains security-related documentation for the Axiom project, including security updates, vulnerability
fixes, and security best practices.

## Documentation Files

### [Security Updates 2026-02](SECURITY_UPDATES_2026-02.md)

Comprehensive security update documentation for February 2026 updates covering:

- Docker base image updates (Alpine 3.19 → 3.21, Node 18 → 22, Go 1.24-alpine3.21)
- Go dependency updates (Gin, golang.org/x/net, and 15+ transitive dependencies)
- CVE resolutions and security impact analysis
- Verification procedures and testing checklist
- Rollback procedures and troubleshooting guide
- Compatibility assessment and migration notes

## Quick Reference

For a high-level summary of security updates, see [SECURITY_UPDATE_SUMMARY.md](SECURITY_UPDATE_SUMMARY.md).

## Related Documentation

- [GitHub Security Scanning Dashboard](https://github.com/techie2000/axiom/security/code-scanning) - Current
vulnerability scan results
- [Docker Best Practices](.github/instructions/containerization-docker-best-practices.instructions.md) - Container
security guidelines
