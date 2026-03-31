---
applyTo: '**/VERSION,**/version.go,**/.github/**,**/CHANGELOG.md'
description: 'Version management and release preparation instructions for Axiom project'
---

# Version Management Instructions

## Core Principle
**Version tracking is critical for release management, git tagging, and production deployments.**

## Semantic Versioning (SemVer)

The project follows [Semantic Versioning 2.0.0](https://semver.org/):

**Format:** `MAJOR.MINOR.PATCH`

- **MAJOR**: Incompatible API changes or breaking changes
- **MINOR**: New features, backward-compatible functionality
- **PATCH**: Bug fixes, backward-compatible patches

### Version Increment Guidelines

#### When to Bump MAJOR (X.0.0)
- Breaking changes to CLI arguments or flags
- Incompatible changes to configuration format (.env variables)
- Breaking changes to output JSON structure
- Removal of deprecated features
- Changes that require users to modify their integration

#### When to Bump MINOR (0.X.0)
- New features (new configuration options, output formats)
- New command-line flags (backward compatible)
- Performance improvements (significant)
- New archiving categories or behaviors
- Deprecation notices (without removal)

#### When to Bump PATCH (0.0.X)
- Bug fixes
- Security patches
- Documentation updates (significant)
- Internal refactoring (no external impact)
- Performance improvements (minor)
- Dependency updates

## Version Update Workflow

### Files That MUST Be Updated Together

1. **`VERSION`** (root file)
   - Plain text file containing only the version number
   - Example: `0.1.0`

2. **`internal/version/version.go`**
   - Update the `Version` constant
   - Must match the `VERSION` file exactly
   ```go
   const Version = "0.1.0"
   ```

### Automated Version Injection

The following are automatically injected at build time via `-ldflags`:
- `internal/version.GitCommit` - Git commit hash
- `internal/version.BuildDate` - Build timestamp

**DO NOT** manually edit these in the source code.

## Release Preparation Checklist

When incrementing the version for a release:

1. **Update CHANGELOG.md (REQUIRED)**
   - [ ] Move relevant items from `[Unreleased]` section to new `[X.Y.Z]` section
   - [ ] Add release date in ISO format: `## [X.Y.Z] - YYYY-MM-DD`
   - [ ] Categorize changes under appropriate headings:
     - **Added**: New features
     - **Changed**: Changes in existing functionality
     - **Deprecated**: Soon-to-be removed features
     - **Removed**: Now removed features
     - **Fixed**: Bug fixes
     - **Security**: Security fixes
     - **Performance**: Performance improvements
     - **Documentation**: Documentation updates
   - [ ] Update version comparison links at bottom of file
   - [ ] Ensure clear, user-friendly descriptions (avoid internal jargon)
   - [ ] Include breaking changes prominently
   - [ ] Reference relevant ADRs when applicable

2. **Update Version Files**
   - [ ] Update `VERSION` file with new version number
   - [ ] Update `internal/version/version.go` constant to match
   - [ ] Commit these changes with message: `chore: bump version to X.Y.Z`

3. **Create Git Tag with Comprehensive Message**
   ```bash
   # Create annotated tag with detailed release notes
   git tag -a vX.Y.Z -m "Release vX.Y.Z - [Brief description]

   Major Features:
   - [Feature 1]
   - [Feature 2]

   Enhancements:
   - [Enhancement 1]
   - [Enhancement 2]

   Bug Fixes:
   - [Fix 1]
   - [Fix 2]

   Technical Details:
   - [Detail 1]
   - [Detail 2]

   See CHANGELOG.md for complete details."

   # Push tag to remote
   git push origin vX.Y.Z
   ```

   **🤖 Automated Release Process:**
   - Pushing a tag automatically triggers the GitHub Actions release workflow
   - The workflow will:
     - Extract release notes from CHANGELOG.md
     - Build binaries for all platforms (linux-amd64, linux-arm64, windows-amd64, darwin-amd64, darwin-arm64)
     - Generate SHA256 checksums for all binaries
     - Create a GitHub Release with binaries attached
     - Build and push Docker images to GitHub Container Registry (ghcr.io)
     - Tag Docker images with version number and "latest"
   - **No manual steps required** - just push the tag!

4. **Verify Automated Release (GitHub Actions)**
   - [ ] Monitor workflow at: `https://github.com/{owner}/{repo}/actions`
   - [ ] Verify GitHub Release created at: `https://github.com/{owner}/{repo}/releases`
   - [ ] Verify binaries attached to release
   - [ ] Verify Docker image pushed to: `ghcr.io/{owner}/{repo}:vX.Y.Z`
   - [ ] Check workflow notifications for any failures

5. **Manual Verification (Optional)**
   ```bash
   # Download and verify binary
   curl -LO https://github.com/{owner}/{repo}/releases/download/vX.Y.Z/axiom-api-linux-amd64
   curl -LO https://github.com/{owner}/{repo}/releases/download/vX.Y.Z/axiom-api-linux-amd64.sha256
   sha256sum -c axiom-api-linux-amd64.sha256

   # Pull and test Docker image
   docker pull ghcr.io/{owner}/{repo}:vX.Y.Z
   docker run --rm ghcr.io/{owner}/{repo}:vX.Y.Z ./axiom-api -version
   ```

## Version Checking

### During Development
```bash
# Check version without building
cat VERSION

# Check version in code
grep 'const Version' internal/version/version.go
```

### In Built Binary
```bash
./axiom-api -version
# Output: axiom-api v0.1.0 (commit: abc1234) (built: 2026-01-22T12:34:56Z)
```

### In Running Service
- Version is logged on service startup
- Check logs in your configured log directory

## Docker Build with Version

### Local Docker Build

When building Docker images locally, pass version information as build args:

```bash
docker build \
  --build-arg VERSION=$(cat VERSION) \
  --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) \
  --build-arg BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
  -t axiom:$(cat VERSION) \
  -t axiom:latest \
  .
```

### Automated Docker Build (GitHub Actions)

Docker images are automatically built and pushed to GitHub Container Registry when you push a version tag:

**Automatic Process:**
1. Push tag: `git push origin vX.Y.Z`
2. GitHub Actions builds multi-architecture images (linux/amd64, linux/arm64)
3. Images pushed to: `ghcr.io/{owner}/{repo}`
4. Tagged with: `vX.Y.Z`, `X.Y`, `X`, and `latest`

**Using Published Images:**
```bash
# Pull specific version
docker pull ghcr.io/techie2000/axiom:v0.2.0

# Pull latest
docker pull ghcr.io/techie2000/axiom:latest

# Pull major version (gets latest minor/patch)
docker pull ghcr.io/techie2000/axiom:0

# Run with Docker
docker run -p 8080:8080 ghcr.io/techie2000/axiom:latest
```

**Note:** First time pushing to ghcr.io, you may need to make the package public in GitHub settings:
`Settings → Packages → axiom → Package settings → Change visibility → Public`

## Critical Rules

1. **ALWAYS** update CHANGELOG.md FIRST before bumping version
2. **NEVER** commit version updates without updating BOTH VERSION and version.go files
3. **ALWAYS** use semantic versioning rules
4. **ALWAYS** create a git tag for releases with detailed tag message
5. **ALWAYS** document breaking changes prominently in CHANGELOG
6. **ALWAYS** verify version with `-version` flag after building
7. **ALWAYS** maintain [Unreleased] section in CHANGELOG for ongoing work

## CHANGELOG Maintenance Rules

### During Development (Before Release)

1. **Add changes to [Unreleased] section immediately**
   - Add entries as features/fixes are implemented
   - Categorize properly (Added, Changed, Fixed, etc.)
   - Use clear, user-facing language
   - Reference issue/PR numbers when applicable

2. **Format for CHANGELOG Entries**
   ```markdown
   ### Added
   - **Feature Name**: Brief description of what was added and why users care
   - New configuration option `FEATURE_FLAG` for controlling behavior X

   ### Changed
   - **Breaking**: Previous behavior now works differently (explain impact)
   - Improved performance of X by Y%

   ### Fixed
   - Resolved issue where X would fail under Y conditions (#123)
   ```

3. **User-Centric Language**
   - ✅ "Added support for JSON output format"
   - ❌ "Implemented JSONOutputHandler class"
   - ✅ "Fixed crash when processing files with special characters"
   - ❌ "Fixed null pointer exception in FileProcessor.go:123"

### At Release Time

1. **Move [Unreleased] to versioned section**
   ```markdown
   ## [Unreleased]

   ### Changed
   - Nothing yet

   ## [X.Y.Z] - YYYY-MM-DD

   ### Added
   - [Previous unreleased items moved here]
   ```

2. **Update comparison links**
   ```markdown
   [Unreleased]: https://github.com/techie2000/axiom/compare/vX.Y.Z...HEAD
   [X.Y.Z]: https://github.com/techie2000/axiom/compare/vX.Y.Z-1...vX.Y.Z
   ```

3. **Verify completeness**
   - All significant changes documented
   - Breaking changes clearly marked
   - User impact explained
   - ADR references included where relevant

## Common Mistakes to Avoid

- ❌ Updating VERSION file but forgetting version.go
- ❌ Updating version.go but forgetting VERSION file
- ❌ **Forgetting to update CHANGELOG.md before release**
- ❌ **Leaving [Unreleased] section empty during development**
- ❌ Using incorrect SemVer format (e.g., `v1.0` instead of `1.0.0`)
- ❌ Forgetting to tag releases in git
- ❌ Bumping MAJOR for non-breaking changes
- ❌ Using internal technical jargon in CHANGELOG (use user-facing language)
- ❌ Not updating CHANGELOG comparison links at bottom
- ❌ Forgetting to date the release in CHANGELOG
- ❌ Not marking breaking changes prominently in CHANGELOG

## Pre-Release Versions

For alpha, beta, or release candidate versions:

```bash
1.0.0-alpha.1
1.0.0-beta.1
1.0.0-rc.1
```

## Integration with CI/CD

When setting up automated releases:

1. Read version from `VERSION` file
2. Inject via ldflags during build
3. Tag Docker images with version
4. Create GitHub releases with version tag

## Quick Reference

| Scenario | Example | Next Version |
| ---------- | --------- | -------------- |
| Bug fix | Fix delimiter parsing | 0.1.0 → 0.1.1 |
| New feature | Add Kafka output | 0.1.1 → 0.2.0 |
| Breaking change | Change CLI flags | 0.2.0 → 1.0.0 |
| Security patch | Fix CVE | 1.0.0 → 1.0.1 |
| New minor feature | Add --quiet flag | 1.0.1 → 1.1.0 |

## Version History Strategy

- **MANDATORY**: Maintain CHANGELOG.md following [Keep a Changelog](https://keepachangelog.com/)
- Document all changes under appropriate categories:
  - **Added**: New features, capabilities, or functionality
  - **Changed**: Changes in existing functionality
  - **Deprecated**: Soon-to-be removed features (with timeline)
  - **Removed**: Now removed features (was previously deprecated)
  - **Fixed**: Any bug fixes
  - **Security**: Security vulnerability fixes (with CVE if applicable)
  - **Performance**: Performance improvements
  - **Documentation**: Significant documentation updates or additions

### CHANGELOG Best Practices

1. **Update continuously during development**
   - Add entries to [Unreleased] as you work
   - Don't wait until release time to document changes

2. **Write for end users, not developers**
   - Focus on impact and behavior, not implementation details
   - Explain WHAT changed and WHY users care, not HOW it was coded

3. **Be specific and actionable**
   - ✅ "Added `--timeout` flag to configure HTTP request timeout (default: 30s)"
   - ❌ "Added new flag"

4. **Highlight breaking changes prominently**
   - Use **Breaking:** prefix for any incompatible changes
   - Explain migration path if applicable

5. **Group related changes**
   - Combine related fixes/features under clear subheadings
   - Use bullet points for easy scanning

6. **Include references**
   - Link to relevant ADRs for architectural decisions
   - Reference issue/PR numbers: (#123)
   - Link to security advisories for security fixes

7. **Version comparison links**
   - Always update the comparison links at bottom of CHANGELOG
   - Format: `[X.Y.Z]: https://github.com/user/repo/compare/vX.Y.Z-1...vX.Y.Z`

### Example CHANGELOG Entry

```markdown
## [1.2.0] - 2026-01-22

### Added
- **Multi-tenant support**: Service now supports multiple input folders with distinct configurations (ADR-004)
- New `--config` flag to specify custom configuration file path
- Health check endpoint at `/health` for container orchestration

### Changed
- **Breaking**: Configuration file format changed from INI to JSON
  - Migration: Refer to migration guide in documentation
- Improved error messages to include actionable troubleshooting steps
- Default timeout increased from 10s to 30s based on production metrics

### Fixed
- Resolved memory leak when processing large files (#234)
- Fixed crash on startup when log directory doesn't exist (#245)

### Performance
- Reduced file detection latency from 5s to <100ms using event-driven monitoring (ADR-005)
- Optimized JSON parsing for 40% faster processing of large CSV files

### Security
- Updated dependency X to v2.3.4 to address CVE-2026-1234 (high severity)
```
