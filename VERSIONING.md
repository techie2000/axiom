# Axiom Versioning Strategy

## Overview

Axiom uses **per-component versioning** with centralized build tooling. Each service maintains its own VERSION file while the project tracks an overall version.

## Version Files

| Component | Version File | Current |
|-----------|--------------|---------|
| **Project** (Axiom) | `VERSION` | 0.1.0 |
| **csv2json** | `csv2json/VERSION` | 0.1.0 |
| **canonicalizer** | `canonicalizer/VERSION` | 0.1.0 |

## Semantic Versioning

All components follow semantic versioning (MAJOR.MINOR.PATCH):

- **0.x.x**: Pre-production (alpha/beta) - breaking changes allowed
- **1.0.0**: First production-ready release - semver strictly followed
- **1.x.x**: Production with backward compatibility
- **2.0.0+**: Major version with breaking changes

## Building Services

### Build All Services

```powershell
# Build all services
.\scripts\build-all.ps1

# Build specific service
.\scripts\build-all.ps1 -Service csv2json
.\scripts\build-all.ps1 -Service canonicalizer

# Use git tags for version
.\scripts\build-all.ps1 -UseGitTag

# Build local binaries
.\scripts\build-all.ps1 -Local
```

### Build Individual Services

```powershell
# csv2json
.\scripts\build-csv2json.ps1

# canonicalizer
.\scripts\build-canonicalizer.ps1
```

## Version Injection

Versions are injected at **build time** using Go's `-ldflags`:

1. Build script reads VERSION file
2. Passes to Docker as `--build-arg VERSION=x.x.x`
3. Dockerfile uses `-ldflags "-X main.Version=x.x.x"`
4. Version baked into binary at compile time

## Version Visibility

### csv2json
Version appears in **every message envelope**:

```json
{
  "version": "0.1.0",
  "hostname": "9cac7878e5e4",
  "sourceFile": "countries.csv",
  ...
}
```

### canonicalizer
Version appears in **startup logs**:

```
2026/01/27 16:57:04 Canonicalizer v0.1.0 starting...
```

## Updating Versions

### Coordinated Release (Recommended)

Update all components together for major releases:

```powershell
# Update all VERSION files
"0.2.0" | Out-File -Encoding UTF8 -NoNewline VERSION
"0.2.0" | Out-File -Encoding UTF8 -NoNewline csv2json/VERSION
"0.2.0" | Out-File -Encoding UTF8 -NoNewline canonicalizer/VERSION

# Commit
git add VERSION csv2json/VERSION canonicalizer/VERSION
git commit -m "chore: bump Axiom to v0.2.0"
git tag -a v0.2.0 -m "Release 0.2.0"

# Rebuild all
.\scripts\build-all.ps1
```

### Independent Component Updates

For hotfixes or component-specific changes:

```powershell
# Update single component
"0.1.1" | Out-File -Encoding UTF8 -NoNewline csv2json/VERSION

# Commit
git add csv2json/VERSION
git commit -m "fix(csv2json): handle BOM in UTF-16 files - v0.1.1"

# Rebuild
.\scripts\build-csv2json.ps1
```

## Version Synchronization

| Scenario | Strategy |
|----------|----------|
| **Major features** | Bump all components together (0.1.0 → 0.2.0) |
| **Breaking changes** | Coordinate versions across affected components |
| **Bug fixes** | Independent patch versions (csv2json 0.1.1, others 0.1.0) |
| **Production release** | All components move to 1.0.0 together |

## Git Tagging Convention

```powershell
# Project-wide release
git tag -a v0.2.0 -m "Axiom v0.2.0: Multi-ingress routing"

# Component-specific
git tag -a csv2json-v0.1.1 -m "csv2json v0.1.1: UTF-16 BOM fix"
git tag -a canonicalizer-v0.1.1 -m "canonicalizer v0.1.1: Retry logic"
```

## Best Practices

1. **Pre-1.0**: Keep versions synchronized for simplicity
2. **Post-1.0**: Allow independent versioning for hotfixes
3. **Document changes**: Update CHANGELOG.md per component
4. **Tag releases**: Always tag coordinated releases
5. **Test after bumping**: Run `.\scripts\build-all.ps1` to verify

## Roadmap to 1.0.0

Current state: **0.1.0** (alpha/beta)

Remaining milestones:
- [ ] Complete currencies domain
- [ ] Complete instruments domain  
- [ ] Production-grade error handling
- [ ] Comprehensive test coverage
- [ ] Performance optimization
- [ ] Security hardening
- [ ] Documentation completion

→ **1.0.0**: First production-ready release

## Benefits

✅ **Traceability**: Every message knows which version created it  
✅ **Debugging**: Version visible in logs and data  
✅ **Flexibility**: Independent or coordinated versioning  
✅ **Automation**: Build scripts handle version injection  
✅ **No hardcoded versions**: Maintained in VERSION files

---

*Last updated: January 27, 2026*
