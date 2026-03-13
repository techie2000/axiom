---
description: 'Automatically update llms.txt when documentation or infrastructure changes occur'
applyTo: '**/*.md,**/docker-compose*.yml,**/Dockerfile*,**/Makefile,**/README.md'
---

# Update llms.txt on Documentation and Infrastructure Changes

## Core Principle

**The `llms.txt` file at the repository root must be kept synchronized with documentation and infrastructure changes.**
This file serves as the primary navigation guide for LLMs to understand the repository structure and locate relevant
documentation.

## When to Update llms.txt

Update `llms.txt` immediately when ANY of the following occur:

### Documentation Changes
- **New documentation file added** in `docs/` or subdirectories
- **Documentation file removed or renamed**
- **Significant documentation restructuring** (moving files between directories)
- **New README files added** (e.g., `docker/README.md`, `scripts/README.md`)
- **New ADR (Architecture Decision Record) added** in `docs/adr/`

### Infrastructure Changes
- **New service added** to docker-compose files
- **New Dockerfile created** or existing one significantly changed
- **New deployment environment added** (e.g., staging, canary)
- **Major architecture pattern change** requiring new documentation section

### Feature Changes
- **Major feature added** that includes new documentation
- **Integration with new external system** (e.g., LEI was added, would need llms.txt update)
- **New API endpoints documented** in separate files

### Configuration Changes
- **New configuration files added** that are important for understanding the system
- **Environment setup process changed** requiring new documentation reference

## What NOT to Update For

Do NOT update `llms.txt` for:
- Minor documentation typo fixes or formatting changes
- Code implementation changes without documentation impact
- Version bumps in dependencies
- Bug fixes that don't require new documentation
- Routine maintenance commits

## Update Process

### Step 1: Review the Change

Ask yourself:
1. Does this change add, remove, or rename a documentation file?
2. Does this change alter how someone would understand the repository?
3. Would an LLM benefit from knowing about this file?
4. Is this file essential for understanding a major feature or component?

If YES to any of these, proceed to update `llms.txt`.

### Step 2: Determine Section Placement

Match the file to the appropriate `llms.txt` section:

- **Main Documentation**: Core README, architecture docs
- **Getting Started**: Quick start guides, setup instructions
- **LEI Integration** (or similar feature sections): Feature-specific documentation
- **Architecture Decision Records**: ADRs explaining technical decisions
- **Deployment and Infrastructure**: Docker, compose files, deployment guides
- **Optional**: Secondary files, bug fixes, technical deep-dives

### Step 3: Write Descriptive Link Text

Format the generated `llms.txt` entries as: descriptive name, relative URL, then brief description.
Literal structure: `[descriptive-name]` + `(relative-url)` + `: brief description`

**Guidelines:**
- Use clear, descriptive link text (not just "Documentation" or "README")
- Provide brief description explaining the file's purpose
- Keep descriptions concise (one line, under 120 characters)
- Use relative paths from repository root
- Maintain consistent formatting with existing entries

### Step 4: Maintain Logical Organization

- Keep files within each section logically ordered (often chronological or by importance)
- For ADRs, maintain numerical order (ADR-0001, ADR-0002, etc.)
- For environment files, group related files together
- Ensure the most important/frequently accessed files are in prominent sections

### Step 5: Verify Compliance

After updating, ensure:
- [ ] File follows https://llmstxt.org/ format specification
- [ ] All links use relative paths from repository root
- [ ] H1 header remains unchanged (project name)
- [ ] Blockquote summary is still accurate
- [ ] All sections use H2 headers (`##`)
- [ ] Link format is correct: link text + relative path + description
- [ ] No broken links (all referenced files exist)
- [ ] File passes markdown linting (run `make lint-docs`)

## Examples

### Example 1: New ADR Added

**Scenario**: New ADR created at `docs/adr/adr-0008-grpc-microservices.md`

**Update Required**:
```text
## Architecture Decision Records

- [ADR-0001: Modular Monolith](docs/adr/adr-0001-modular-monolith-architecture.md): Architecture pattern choice
...
- [ADR-0007: Docker Compose Local Dev](docs/adr/adr-0007-docker-compose-local-dev.md): Development environment
- [ADR-0008: Sticky Headers with Smooth Transitions](docs/adr/adr-0008-sticky-headers-with-smooth-transitions.md): UI interaction decision
```

### Example 2: New Feature Documentation

**Scenario**: New feature "Trade Matching" added with documentation at `docs/TRADE_MATCHING.md`

**Update Required**:
Create new section or add to existing relevant section:
```text
## Core Features

- [LEI Acquisition](docs/lei/LEI_ACQUISITION.md): Legal Entity Identifier data acquisition from GLEIF
- [LEI Data Flow](docs/lei/LEI_DATA_FLOW.md): LEI ingestion and processing flow
```

### Example 3: Documentation Removed

**Scenario**: File `docs/DEPRECATED_API.md` removed from repository

**Update Required**:
Remove the corresponding line from `llms.txt`:
```text
## API Documentation

- [Backend API Entrypoint](backend/cmd/api/main.go): API server entrypoint and route bootstrap
- [Master Data Guide](docs/MASTER_DATA.md): Data model and API usage reference
- [Project Docs Index](docs/README.md): Documentation hub
```

### Example 4: Documentation Restructured

**Scenario**: All API docs moved from `docs/` to `docs/api/`

**Update Required**:
Update all affected paths:
```text
## API Documentation

- [Backend API Entrypoint](backend/cmd/api/main.go): API server entrypoint and route bootstrap
- [Master Data Guide](docs/MASTER_DATA.md): Data model and API usage reference
- [Project Docs Index](docs/README.md): Documentation hub
```

## Commit Message Convention

When updating `llms.txt`, use clear commit messages:

```bash
# Good commit messages
docs: update llms.txt with new ADR-0008 for gRPC migration
docs: add Trade Matching documentation to llms.txt
docs: remove deprecated API reference from llms.txt
docs: update llms.txt paths after API docs restructure

# Bad commit messages
update llms.txt
fix
docs
```

## Integration with CI/CD

Consider adding a CI check (future enhancement) that:
- Detects when documentation files are added/removed
- Validates llms.txt links are not broken
- Warns if new documentation in `docs/` is not referenced in llms.txt

## Priority Guidelines

When multiple changes occur, prioritize updates in this order:

1. **CRITICAL**: New major features with documentation (must update immediately)
2. **HIGH**: New ADRs, removed documentation files
3. **MEDIUM**: Renamed files, restructured directories
4. **LOW**: Optional section additions, minor documentation enhancements

## Quality Checklist

Before committing `llms.txt` updates:

- [ ] All new documentation files are referenced appropriately
- [ ] All removed files have been deleted from llms.txt
- [ ] All renamed files have updated paths
- [ ] Links are in the correct section (Main Docs, Getting Started, etc.)
- [ ] Descriptions are clear and concise
- [ ] File follows https://llmstxt.org/ specification
- [ ] All links are valid relative paths
- [ ] Markdown linting passes (`make lint-docs`)
- [ ] File is at repository root (`/llms.txt`)

## Reference

- **Specification**: https://llmstxt.org/
- **Current Location**: `/llms.txt` (repository root)
- **Related Instructions**: `.github/instructions/update-docs-on-code-change.instructions.md`

## Support

If unsure whether a change requires an llms.txt update, ask:
- "Would an LLM benefit from knowing this file exists?"
- "Is this file essential for understanding a major component?"
- "Does this change how someone would navigate the repository?"

If YES to any, update `llms.txt`.
