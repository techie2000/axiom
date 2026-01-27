# csv2json Versioning

## Overview

csv2json uses a **VERSION file** for version management. The version is automatically injected at build time using Go's `-ldflags` mechanism.

## Version File

**Location**: `csv2json/VERSION`

**Format**: Semantic versioning (MAJOR.MINOR.PATCH)

```
0.1.0
```

**Note**: Version 0.x.x indicates pre-production alpha/beta where breaking changes are acceptable. Version 1.0.0 will mark the first production-ready release.

## Building with Version

### Docker Build (Recommended)

Use the provided build script which automatically reads the VERSION file:

```powershell
# Build using VERSION file
.\scripts\build-csv2json.ps1

# Build using git tag (if available)
.\scripts\build-csv2json.ps1 -UseGitTag

# Build local binary
.\scripts\build-csv2json.ps1 -Local
```

### Manual Docker Build

```powershell
# Read version from file
$VERSION = Get-Content csv2json/VERSION -Raw | ForEach-Object { $_.Trim() }

# Build with version injection
docker compose build --build-arg VERSION=$VERSION csv2json
```

### Manual Go Build

```powershell
cd csv2json

# Read version
$VERSION = Get-Content VERSION -Raw | ForEach-Object { $_.Trim() }

# Build with version
go build -ldflags "-X main.Version=$VERSION" -o ../bin/csv2json.exe .
```

## Version in Message Envelope

The version appears in every message envelope produced by csv2json:

```json
{
  "domain": "reference",
  "entity": "countries",
  "timestamp": "2026-01-27T16:51:11.381154075Z",
  "source": "csv2json",
  "version": "0.1.0",
  "hostname": "9cac7878e5e4",
  "sourceFile": "countries.csv",
  "contract": "reference.countries.csv.v1",
  "payload": { ... }
}
```

## Updating the Version

### Manual Update

1. Edit `csv2json/VERSION` file
2. Commit the change
3. Rebuild using the build script

```powershell
# Update version
"0.2.0" | Out-File -Encoding UTF8 -NoNewline csv2json/VERSION

# Commit
git add csv2json/VERSION
git commit -m "chore: bump csv2json version to 0.2.0"

# Rebuild
.\scripts\build-csv2json.ps1
```

### Git Tag-Based (Optional)

Tag your commits and use `-UseGitTag` flag:

```powershell
# Tag release
git tag -a v0.2.0 -m "Release 0.2.0"

# Build using tag
.\scripts\build-csv2json.ps1 -UseGitTag
```

## Version Injection Mechanism

The version is injected at compile time using Go's `-ldflags`:

1. **Build Argument**: Dockerfile accepts `VERSION` build arg
2. **Compile-Time Injection**: Uses `-ldflags "-X main.Version=$VERSION"`
3. **Runtime Fallback**: If not set, tries to read `VERSION` file at startup

**In code** (`csv2json/main.go`):

```go
// Version is set at build time via ldflags or read from VERSION file
var Version = "dev"

func init() {
    // If version wasn't set at build time, try to read from VERSION file
    if Version == "dev" {
        if versionBytes, err := os.ReadFile("VERSION"); err == nil {
            Version = strings.TrimSpace(string(versionBytes))
        }
    }
}
```

## Best Practices

1. **Always update VERSION file** when making releases
2. **Use semantic versioning**: MAJOR.MINOR.PATCH
   - **0.x.x**: Pre-production (alpha/beta) - breaking changes allowed
   - **1.0.0+**: Production-ready - follow semver strictly
3. **Include version in git commit messages**: `chore: bump csv2json to v0.2.0`
4. **Tag releases** for traceability
5. **Document changes** corresponding to version bumps

## Benefits

✅ **No hardcoded versions** - Maintained in single source of truth  
✅ **Automatic injection** - No manual code changes needed  
✅ **Traceability** - Every message tracks which version created it  
✅ **Build-time resolution** - Version baked into binary  
✅ **Git integration** - Optional tag-based versioning

---

*Last updated: January 27, 2026*
