# ADR-004: Monorepo with Go Workspaces

## Status

Accepted

## Date

2026-01-26

## Context

Axiom consists of multiple services and domain modules:

- Shared utilities (csv2json, canonicalizer)
- Multiple domain modules (reference.countries, reference.currencies, trading.trades, etc.)
- Cross-module dependencies (currencies depends on countries)

We need a repository structure that:

- Allows independent versioning of modules
- Facilitates code sharing and reuse
- Enables atomic cross-module changes
- Simplifies CI/CD and testing
- Provides good developer experience

## Decision

We will use a **monorepo structure with Go workspaces** for the Axiom project.

### Repository Structure

```
axiom/
├── go.work                      # Go workspace file
├── .github/                     # Shared CI/CD workflows
├── docs/                        # Project-wide documentation
├── csv2json/                    # Utility: CSV to JSON
│   └── go.mod
├── canonicalizer/               # Service: Data standardization
│   └── go.mod
└── modules/
    ├── reference/
    │   ├── countries/           # Domain module
    │   │   └── go.mod
    │   ├── currencies/
    │   │   └── go.mod
    │   └── ...
    ├── trading/
    │   └── ...
    └── settlement/
        └── ...
```

Each module has its own `go.mod` and can be versioned independently.

## Rationale

### Why Monorepo?

1. **Atomic changes**: Update multiple modules in a single commit
2. **Simplified dependency management**: No version hell between internal modules
3. **Unified CI/CD**: Single pipeline for all modules
4. **Code sharing**: Easy to extract common utilities to shared packages
5. **Easier testing**: Run integration tests across modules
6. **Better discoverability**: All code in one place
7. **Simplified development**: One `git clone`, everything works

### Why Go Workspaces?

1. **Independent modules**: Each module maintains its own `go.mod`
2. **Local development**: Changes in one module immediately visible to others
3. **No replace directives**: Workspace handles module resolution
4. **Standard Go tooling**: `go build`, `go test` work as expected
5. **Independent versioning**: Can release modules on different schedules

### Alternatives Considered

**Separate Repositories (Polyrepo)**

- ❌ Git submodules are painful to work with
- ❌ Cross-module changes require multiple PRs
- ❌ Harder to discover and search code
- ❌ Complex CI coordination
- ❌ Version management overhead

**Single Module (No Workspaces)**

- ❌ Cannot version modules independently
- ❌ Changes to one domain affect all consumers
- ❌ Harder to establish clear module boundaries

## Consequences

### Positive

- **Atomic refactoring**: Change interfaces and implementations together
- **Unified tooling**: One place for linting, formatting, CI configuration
- **Faster feedback**: See impact of changes across entire system
- **Better collaboration**: All code visible in one repo
- **Simplified onboarding**: Clone once, build everything
- **Easier testing**: Integration tests can import any module

### Negative

- **Larger repository**: More code to clone (mitigated by shallow clones)
- **Requires discipline**: Must maintain clear module boundaries despite proximity
- **Single CI pipeline**: All modules tested on every change (can optimize with path filters)

### Development Workflow

```bash
# Clone repository
git clone https://github.com/your-org/axiom.git
cd axiom

# Go workspace automatically handles module resolution
go build ./...
go test ./...

# Work on specific module
cd modules/reference/countries
go test ./...
```

### Module Independence

- Each module can be released independently with semantic versioning
- External consumers can import specific modules:

  ```go
  import "github.com/your-org/axiom/modules/reference/countries"
  ```

- Modules can evolve at different paces

## Notes

- Use GitHub CODEOWNERS to assign teams to specific modules
- Implement pre-commit hooks to enforce module boundaries
- Consider using `go work use` to add new modules to workspace
- Document cross-module dependencies clearly

## Related ADRs

- [ADR-001: Go as Primary Language](001-go-as-primary-language.md)
