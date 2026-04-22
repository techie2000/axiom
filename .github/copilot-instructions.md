# GitHub Copilot Configuration for Axiom

This repository uses GitHub Copilot custom instructions, agents, and prompts to maintain code quality and consistency.
The configuration has been tailored specifically for this Go-based financial services static data management system.

## Project Standards

### Design Decision Documentation (REQUIRED)

**All significant design decisions MUST be documented using Architecture Decision Records (ADRs).**

- **Location**: `docs/adrs/ADR-XXX-decision-title.md`
- **Format**: Follow the standard ADR template below
- **Numbering**: Sequential (001, 002, 003, etc.)
- **Trigger**: Create an ADR when:
  - Choosing between multiple technical approaches
  - Selecting languages, frameworks, or major libraries
  - Making architecture or infrastructure decisions
  - Changing core project conventions or patterns
  - Decisions that have long-term impact on the project

#### ADR Template

```markdown
# ADR XXX: [Decision Title]

**Status:** [Proposed | Accepted | Deprecated | Superseded by ADR-YYY]
**Date:** YYYY-MM-DD
**Decision Makers:** [Team/Role]
**Context:** [Project/Component]

## Context and Problem Statement

[Describe the context and the problem requiring a decision]

## Decision Drivers

- [Factor 1]
- [Factor 2]
- [Factor N]

## Options Considered

### Option 1: [Name]

**Pros:**
- [Advantage 1]
- [Advantage 2]

**Cons:**
- [Disadvantage 1]
- [Disadvantage 2]

### Option 2: [Name]

[Repeat for each option]

## Decision Outcome

**Chosen Option:** [Selected option]

### Rationale

[Explain why this option was chosen]

### Trade-offs Accepted

[What was sacrificed to gain the benefits]

## Consequences

### Positive

- [Benefit 1]
- [Benefit 2]

### Negative

- [Cost/Risk 1]
- [Cost/Risk 2]

### Mitigation

[How negative consequences will be addressed]

## References

- [Link to relevant documentation]
- [Link to discussion/RFC]

## Revision History

- **YYYY-MM-DD:** Initial decision
- **YYYY-MM-DD:** [Any updates or amendments]
```

#### Example ADRs

- `docs/adrs/ADR-001-technology-stack-selection.md` - Choice of Go, Gin, GORM, PostgreSQL
- `docs/adrs/ADR-002-multi-environment-architecture.md` - Dev/UAT/Prod environment separation
- `docs/adrs/ADR-003-modular-monolith-pattern.md` - Architecture pattern selection

### Diagram Standards (REQUIRED)

**All diagrams MUST use Mermaid format for consistency and version control.**

- **Format**: Mermaid markdown code blocks
- **Location**: Embedded in README.md, ADRs, or separate `.md` files in `docs/diagrams/`
- **Types**: Use appropriate Mermaid diagram types:
  - `flowchart` - Process flows, decision trees
  - `sequenceDiagram` - API interactions, component communication
  - `classDiagram` - Object models, data structures
  - `erDiagram` - Database schemas, entity relationships
  - `stateDiagram` - State machines, lifecycle flows
  - `gitGraph` - Branching strategies
  - `gantt` - Project timelines

#### Mermaid Best Practices

```markdown
## Example Architecture Diagram

\`\`\`mermaid
flowchart LR
    A[Input] --> B{Decision}
    B -->|Yes| C[Process]
    B -->|No| D[Skip]
    C --> E[Output]

    style A fill:#e1f5ff
    style E fill:#d4edda
    style D fill:#fff3cd
\`\`\`

## Example Sequence Diagram

\`\`\`mermaid
sequenceDiagram
    participant Client
    participant API
    participant DB

    Client->>API: POST /users
    API->>DB: INSERT user
    DB-->>API: Success
    API-->>Client: 201 Created
\`\`\`

## Example State Diagram

\`\`\`mermaid
stateDiagram-v2
    [*] --> New
    New --> Processing: Submit
    Processing --> Completed: Success
    Processing --> Failed: Error
    Failed --> Processing: Retry
    Completed --> [*]
\`\`\`
```

#### Why Mermaid?

- ✅ **Version Control**: Text-based diagrams tracked in Git
- ✅ **Collaboration**: Easy to review and update in PRs
- ✅ **Rendering**: Works in GitHub, VS Code, and most documentation tools
- ✅ **No Binary Files**: Avoid binary image files that cause merge conflicts
- ✅ **Consistency**: Standardized syntax across all diagrams
- ✅ **Maintainability**: Update diagrams as code changes

**DO NOT** use:

- ❌ Binary image files (PNG, JPG) for architecture diagrams
- ❌ External diagram tools (draw.io, Visio) unless absolutely necessary
- ❌ ASCII art (hard to read and maintain)
- ❌ External hosting (links break, requires external accounts)

#### Color Scheme for Dark Mode

Use medium-saturation colors that work in both light and dark modes:

```yaml
services/components: "#2C5F8D" (medium blue) with white text
processing/intermediate: "#17A2B8" (teal) with white text
success/output: "#28A745" (medium green) with white text
errors/validation: "#D9534F" (medium red) with white text
warnings/DLQ: "#F0AD4E" (medium orange) with dark text
backgrounds: "#555" (dark gray) with white text
```

## Repository Structure

```text
.github/
├── agents/           # Specialized AI assistants for specific workflows
├── instructions/     # Coding standards and best practices (language/framework-specific)
├── prompts/          # Reusable prompt templates for common tasks
├── skills/           # Domain-specific knowledge modules
└── workflows/        # GitHub Actions for automation
```text

## Key Components

### Instructions (`instructions/*.instructions.md`)
Coding standards that AI applies when generating or reviewing code:
- **Language-specific**: `go.instructions.md` - Go idioms and best practices
- **Frontend-specific**: `frontend-ui.instructions.md` - Theme consistency, sortable-table standards, and mandatory `PreferenceSavePrompt` UX for preference-backed toggles
- **Cross-cutting**:
  - `security-and-owasp.instructions.md` - Security best practices
  - `performance-optimization.instructions.md` - Performance guidelines
  - `containerization-docker-best-practices.instructions.md` - Docker optimization
  - `github-actions-ci-cd-best-practices.instructions.md` - CI/CD patterns
- **Code Quality**:
  - `code-review-generic.instructions.md` - General code review standards
  - `self-explanatory-code-commenting.instructions.md` - Comment guidelines
  - `test-driven-maintenance.instructions.md` - Test requirements
- **Documentation**:
  - `markdown.instructions.md` - Documentation standards
  - `update-docs-on-code-change.instructions.md` - Keep docs in sync
  - `version-management.instructions.md` - Release process

Each instruction file includes:
- YAML frontmatter with `applyTo` glob patterns (e.g., `**/*.go`)
- Actionable guidelines, not generic advice
- Real code examples demonstrating patterns
- Anti-patterns to avoid

### Agents (`agents/*.agent.md`)
Specialized AI personas for complex workflows:
- **`adr-generator.agent.md`**: Generate Architecture Decision Records
- **`devops-expert.agent.md`**: DevOps and infrastructure guidance
- **`go-mcp-expert.agent.md`**: Go Model Context Protocol expertise

### Prompts (`prompts/*.prompt.md`)
Reusable templates for common tasks:
- **`create-architectural-decision-record.prompt.md`**: ADR creation workflow
- **`review-and-refactor.prompt.md`**: Comprehensive code review
- **`create-llms.prompt.md`**: Generate llms.txt documentation index

### Skills (`skills/*/SKILL.md`)
Modular domain knowledge packages that AI can load on-demand:
- **`github-issues/`**: Complete workflow for creating, updating, and managing GitHub issues using MCP tools

## Working with This Repository

### Adding New Instructions
1. Create `.github/instructions/[name].instructions.md`
2. Add YAML frontmatter with `applyTo` glob pattern:
   ```yaml
   ---
   description: 'Brief description'
   applyTo: '**/*.ext'
   ---
```text
3. Write specific, actionable guidance with code examples
4. Avoid generic advice - focus on YOUR project's patterns

### Adding New Agents
1. Create `.github/agents/[name].agent.md`
2. Define metadata in YAML frontmatter
3. Structure workflow with clear steps using headings
4. Include example inputs/outputs

### Adding New Prompts
1. Create `.github/prompts/[name].prompt.md`
2. Use configuration variables: `${VARIABLE="default|option1|option2"}`
3. Document workflow steps clearly
4. Provide example structures/templates

### File Naming Conventions
- **Instructions**: `[topic].instructions.md` (e.g., `java.instructions.md`)
- **Agents**: `[workflow-name].agent.md` (e.g., `modernization.agent.md`)
- **Prompts**: `[task-name].prompt.md` (e.g., `create-llms.prompt.md`)
- **Skills**: `skills/[skill-name]/SKILL.md` with supporting `references/` folder

## Special Instructions

### Markdown Compliance Gate (REQUIRED)

When an agent edits any `*.md` file, it must run this loop before commit or PR update:

1. `make docs-check-fix`
2. `make docs-check`
3. If lint still fails, fix remaining issues and rerun `make docs-check` until clean

Rules:

- Do not commit markdown changes while markdown lint is failing.
- Treat markdown lint failures as blocking, not advisory.

### Feature Test Gate (REQUIRED)

When an agent adds or changes functional behavior, it must also add or update automated tests in the same change whenever automated coverage is feasible.

Rules:

1. Treat feature work as incomplete until tests for the new behavior exist.
2. Do not wait for review comments to request tests; add them proactively.
3. For backend Go changes, update or add `*_test.go` coverage in the affected module.
4. For frontend changes, add or update the nearest existing Vitest coverage when the area already has a test pattern or harness.
5. For frontend behavior changes, prefer testing user-visible behavior, transformation logic, and state transitions over implementation details.
6. When frontend UI logic is hard to test directly, extract a pure helper and cover it with Vitest.
7. For frontend i18n, filtering, formatting, preferences, and null-handling changes, add focused regression tests for the changed path.
8. For bug fixes, add a regression test that would fail before the fix when practical.
9. If tests cannot be added, state the reason explicitly in the final response or PR summary.

Minimum test expectation for behavior changes:

- happy path
- failure or validation path
- at least one edge case for the new logic

Frontend validation expectation when relevant:

- `cd frontend && npm test`
- `cd frontend && npm run lint`
- `cd frontend && npm run i18n:verify` for i18n-related changes

### Self-Explanatory Code
`self-explanatory-code-commenting.instructions.md` emphasizes:
- Code that speaks for itself
- Comments only for WHY, not WHAT
- Specific annotation types: `TODO`, `FIXME`, `HACK`, `NOTE`, `WARNING`, `PERF`, `SECURITY`, `BUG`, `REFACTOR`, `DEPRECATED`

### Documentation Updates
`update-docs-on-code-change.instructions.md` triggers automatic documentation updates when code changes affect:
- Public APIs
- Configuration options
- CLI commands
- Installation/setup steps

### Configuration Consistency (CRITICAL)
When adding, removing, or modifying environment variables:
1. Update all environment files: [`.env.dev`](../.env.dev), [`.env.uat`](../.env.uat), [`.env.prod`](../.env.prod) with the new variable and environment-appropriate values
2. Update [`backend/internal/config/config.go`](../backend/internal/config/config.go) to load and validate the variable
3. **Update all docker-compose files**: [`docker-compose.dev.yml`](../docker-compose.dev.yml), [`docker-compose.uat.yml`](../docker-compose.uat.yml), [`docker-compose.prod.yml`](../docker-compose.prod.yml) environment sections to include the variable
4. **Update [`README.md`](../README.md)** configuration documentation with the new variable
5. **Update [`docs/environments/`](../docs/environments/)** environment-specific documentation if applicable
6. Create or update relevant ADRs in [`docs/adr/`](../docs/adr/) if the change affects core behavior or architecture

**Common mistake**: Forgetting to sync all environment files and docker-compose configurations, causing configuration drift between dev, UAT, and production environments.

### Module Path for GitHub Publishing (IMPORTANT)

**Current State**: Module path is `github.com/techie2000/axiom` (properly configured for GitHub)

**Backend Module:**
- [`backend/go.mod`](../backend/go.mod): Uses `module github.com/techie2000/axiom`
- All backend imports use the full GitHub path: `github.com/techie2000/axiom/internal/*`

**Root Module:**
- [`go.mod`](../go.mod): Uses `module github.com/techie2000/axiom` for consistency

**When adding new packages or imports:**
1. Always use the full GitHub module path in imports
2. Run `go mod tidy` in the backend directory after adding dependencies
3. Run `go test ./...` in backend to verify all tests still pass

**Files to check when modifying imports:**
- `backend/cmd/api/main.go`
- `backend/cmd/worker/main.go` 
- `backend/cmd/notification/main.go`
- All files in `backend/internal/` subdirectories

**Why**: Using the full GitHub path ensures the module works correctly with `go get` and remote imports.

### Architecture Decision Records (ADRs)
All significant design decisions must be documented in ADR format:
- Located in `docs/adrs/ADR-XXX-decision-title.md`
- Follow standard ADR template (see Project Standards section)
- Include context, options considered, decision rationale, and consequences
- Reference ADRs in [README](../README.md) and related documentation

### Mermaid Diagrams
All architecture and technical diagrams must use Mermaid format:
- Embedded directly in Markdown files
- Version-controlled with code
- Use appropriate diagram types (flowchart, sequence, class, ER, state)
- Apply consistent styling and color schemes

### Frontend Preference and Popover Behavior (IMPORTANT)
When implementing frontend preference-driven UX:
1. **Preference updates must be live**: `useUserPreference` writes should update all mounted consumers immediately (event-driven sync), without requiring page refresh.
2. **Popover/user-menu placement must be adaptive**: align menus based on trigger position and direction (LTR/RTL) to keep content inside visible layout bounds.
3. **Viewport safety is required**: add max-width safeguards for popovers to prevent clipping on narrow screens.
4. **Validation must include RTL + LTR**: test layout in both directions before finalizing UI changes.

### Internationalisation From The Start (REQUIRED)

When adding or changing frontend UI text:
1. Add i18n keys at implementation time (same change), not as a follow-up fix.
2. Route all visible strings through `t('...')`; avoid hardcoded user-facing text.
3. Add new keys to `frontend/public/locales/en/common.json` and rely on fallback for other locales.
4. Run `cd frontend && npm run i18n:verify` and `cd frontend && npm run lint` before completion.
5. Treat missing i18n coverage as blocking for feature-complete status.

## How to Use These Files in VS Code

### Instructions (Automatic Application)

Instructions are **automatically applied** by GitHub Copilot when you work on matching files:

1. **`applyTo` Pattern Matching**: The `applyTo` glob pattern in each instruction file determines when it activates
   ```yaml
   ---
   description: 'Go coding standards'
   applyTo: '**/*.go'
   ---
```text
   - This instruction activates for ALL `.go` files in the workspace
   - Patterns like `src/**/*.ts` target specific directories
   - Multiple extensions: `**/*.{js,jsx,ts,tsx}`

2. **Automatic Context Loading**: When you:
   - Open a `.go` file → `go.instructions.md` loads automatically
   - Use Copilot chat in that file → Instructions guide the AI's responses
   - Generate code → AI follows the documented patterns

3. **Layered Instructions**: Multiple instructions can apply simultaneously:
   - `go.instructions.md` (language-specific)
   - `security-and-owasp.instructions.md` (applies to all files with `applyTo: '*'`)
   - `performance-optimization.instructions.md` (cross-cutting concerns)

### Agents (Explicit Invocation)

Agents are **invoked explicitly** using the `@` mention syntax in Copilot Chat:

1. **Syntax**: `@[agent-name]` followed by your request
   ```

   @adr-generator Create an ADR for choosing RabbitMQ

```text

2. **Available Agents**:
   - `@adr-generator` - Generate Architecture Decision Records
   - `@devops-expert` - DevOps and infrastructure guidance
   - `@go-mcp-expert` - Go Model Context Protocol expertise

3. **Agent Context**: Agents have access to:
   - The codebase (via `tools: ['codebase']` in frontmatter)
   - File editing capabilities (`'edit/editFiles'`)
   - Search functionality (`'search/codebase'`)

4. **Example Workflow**:
   ```

   User: @adr-generator Help me document the decision to use Go
   Agent: [Creates structured ADR with options, rationale, and consequences]

```text

### Prompts (Slash Commands)

Prompts are **invoked using slash commands** in Copilot Chat:

1. **Syntax**: `/[prompt-name]` (auto-completes as you type)
   ```

   /review-and-refactor
   /create-llms
   /create-architectural-decision-record

```text

2. **Interactive Configuration**: Many prompts have variables:
   ```yaml
   ${PROJECT_TYPE="Auto-detect|.NET|Java|React|Angular"}
```text
   - Copilot will prompt you for these values
   - Or detect them automatically from context

3. **Common Prompts**:
   - `/review-and-refactor` - Comprehensive code review against all instruction files
   - `/create-llms` - Generate llms.txt documentation index
   - `/create-architectural-decision-record` - Document design decisions

4. **Prompt Chaining**: Combine prompts for complex workflows:
   ```

   /create-architectural-decision-record → /create-llms → /review-and-refactor

```text

### Skills (On-Demand Loading)

Skills are **loaded automatically** when relevant topics are mentioned:

1. **Trigger Words**: Mentioning "GitHub issues", "create issue", "update issue" loads the `github-issues` skill

2. **Skill Structure**:
   - `SKILL.md` - Main instructions and workflow
   - `references/` - Supporting documentation (templates, examples)

3. **Usage Example**:
   ```

   User: Create a bug report issue for the authentication timeout
   Copilot: [Loads github-issues skill, uses templates, creates formatted issue]

```text

### Practical Usage Patterns

#### For Code Generation
```

1. Open file matching an instruction (e.g., main.go)
2. Use Copilot inline suggestions → Follows go.instructions.md patterns
3. Or ask in chat: "Create a CSV parser with error handling"
   → Applies go.instructions.md + security-and-owasp.instructions.md

```text

#### For Code Review
```

1. Select code block to review
2. Chat: /review-and-refactor
   → Reviews against ALL applicable instruction files
   → Suggests improvements following documented patterns

```text

#### For Workflow Automation
```

1. Chat: @adr-generator Create ADR for RabbitMQ choice
   → Executes structured ADR creation workflow
   → Generates comprehensive decision document

```text

#### For Documentation
```

1. Chat: /create-llms
   → Scans repo structure
   → Generates llms.txt with all key documentation links

```text

### Best Practices

1. **Start with Instructions**: Customize instruction files FIRST before writing code
2. **Use Agents for Complex Tasks**: Don't try to manually orchestrate multi-step workflows
3. **Chain Prompts**: Use prompts sequentially to build comprehensive documentation
4. **Review Auto-Applied Instructions**: Check which instructions are active with `Ctrl+Shift+P` → "Copilot: Show Instructions"
5. **Test Instructions**: After adding new instruction files, verify they apply correctly by generating code in matching files

### Debugging Copilot Configuration

6. **Document design decisions** in ADR format when making architectural choices
7. **Use Mermaid diagrams** for all architecture and technical documentation

This template repository is designed to make AI coding agents immediately productive by providing comprehensive, project-specific guidance rather than relying on generic training data.

## AI Agent Decision Documentation Workflow

When making significant technical decisions:

1. **Recognize Decision Point**: Identify when multiple valid options exist
2. **Create ADR**: Use `/create-architectural-decision-record` prompt or create manually
3. **Document Options**: List all considered alternatives with pros/cons
4. **Make Decision**: Choose option with clear rationale
5. **Update Diagrams**: Create or update Mermaid diagrams showing the decision's impact
6. **Link Documentation**: Reference ADR in [README](../README.md), related docs, and code comments

## Test Maintenance Workflow (MANDATORY)

**Every functional code change MUST be accompanied by test updates or new tests.**

When modifying Go code in Axiom:

1. **Identify Impact**: Determine which test modules are affected by the change
2. **Update Tests**: Modify existing tests to match new behavior
3. **Add New Tests**: Create new test cases for new functionality
4. **Run Tests**: Execute `go test ./... -v` in the backend directory to verify all tests pass
5. **Check Coverage**: Run `go test -cover ./...` in backend to ensure coverage is maintained
6. **Document**: Update test documentation if new test categories are added

**Backend Test Structure:**
- Unit tests: Located alongside source files (e.g., `backend/internal/service/service_test.go`)
- Integration tests: In `backend/tests/` directory
- Test coverage target: >70% per module

**See [`.github/instructions/test-driven-maintenance.instructions.md`](./instructions/test-driven-maintenance.instructions.md) for complete requirements.**

### ADR Creation Checklist

- [ ] ADR file created in `docs/adrs/` with sequential number
- [ ] All viable options documented with trade-offs
- [ ] Decision rationale clearly explained
- [ ] Consequences (positive and negative) listed
- [ ] Mitigation strategies for negative consequences included
- [ ] References and supporting documentation linked
- [ ] ADR referenced in [README](../README.md) or relevant documentation
- [ ] Related Mermaid diagrams created or updated

### Diagram Creation Checklist

- [ ] Diagram uses Mermaid format (not binary images)
- [ ] Appropriate diagram type selected (flowchart, sequence, etc.)
- [ ] Clear labels and descriptions on all nodes/connections
- [ ] Color coding applied for clarity (e.g., green=success, red=error)
- [ ] Diagram embedded in relevant Markdown documentation
- [ ] Diagram explains the "what" and "how" of the system/flow
- [ ] Complex diagrams broken into smaller, focused diagrams
- Verify YAML frontmatter is valid (use `---` delimiters)
- Restart VS Code after adding new instruction files
- Check Copilot output panel: View → Output → Select "GitHub Copilot"

## Quick Start for AI Agents

When working with this repository:
1. **Identify the task type** (code generation, review, documentation, etc.)
2. **Load relevant instructions** from `.github/instructions/` matching the language/framework
3. **Consider using an agent** if the task matches a defined workflow (ADR creation, DevOps guidance)
4. **Use prompts** for common templated tasks (ADRs, refactoring, llms.txt generation)
5. **Follow project standards** for ADRs, Mermaid diagrams, and test-driven maintenance

This repository configuration is designed to make AI coding agents immediately productive by providing comprehensive, project-specific guidance rather than relying on generic training data.

## PR Finalization Default (Team Preference)

When an AI agent creates a pull request, it should complete standard PR hygiene automatically **without asking for confirmation**:

1. Add appropriate labels following the three-namespace taxonomy:
   - **Category** (optional, max one): `bug`, `enhancement`, `security`, `performance`, or `question` — add only when it conveys information not already implied by Area
   - **Area** (required, exactly one): `area:backend`, `area:frontend`, `area:database`, `area:docs`,
     `area:infra`, `area:ci`, `area:lei`, or `area:dependencies` — infer from the files touched OR let CI workflow auto-apply
   - **Type** (optional secondary, one or two): `type:tests`, `type:refactor`, `type:chore`
   - Add `automated` to mark AI-created items and `no-issue-needed` for PRs with no backing issue
   - **Note**: The CI workflow (`auto-label-prs.yml`) automatically applies Area labels based on file paths. Do not manually add Area labels unless the auto-detection fails. Avoid duplicate semantics: do not add `documentation` when `area:docs` is present. Category labels are only needed when they are orthogonal to Area (e.g., `area:backend` change that is also a `security` fix should add `security`).
2. Request a reviewer (prefer `copilot-pull-request-reviewer` when available).
3. Post a concise verification checklist comment relevant to the changed files.
4. After each commit push to the PR branch, post a concise implementation summary comment that includes:
   - what changed,
   - what validation/tests were run,
   - any follow-up actions or known limitations.
5. For each linked underlying issue (prefer `Refs #123`; use `Fixes/Closes #123` only when `#123` is confirmed to be
   an issue and not a pull request),
   post a concise issue update comment after each PR push (same per-push trigger as
   [`instructions/copilot-pr-feedback-resolution.instructions.md`](instructions/copilot-pr-feedback-resolution.instructions.md))
   that includes:
   - implementation status,
   - validation status,
   - testing guidance for user/UAT verification,
   - PR link.
6. Do not ask whether to post the summary/checklist/issue-update comments; post them by default.

### Merge/Close Review Gate (REQUIRED)

Before merging a PR, closing a linked PR, or announcing readiness to merge:

1. Confirm no unresolved review threads remain.
2. Confirm required reviews are complete and nothing is pending for the latest commit.
3. Confirm no new reviewer/Copilot comments were added after the latest fix without a reply.
4. If any of the above checks fail, do not merge or close; address feedback first and re-check.

This is a high-visibility reminder; execution details are defined in
[`instructions/copilot-pr-feedback-resolution.instructions.md`](instructions/copilot-pr-feedback-resolution.instructions.md).

Use this gate even when checks are green. CI success alone is not sufficient for merge/close decisions.

Only ask follow-up questions if required metadata cannot be applied (for example, reviewer handle is unavailable).

## GitHub Comment Formatting (REQUIRED)

When posting PR/issue comments, checklists, PR descriptions, or review summaries via CLI/API:

1. Use **real multiline Markdown**, not escaped newline text. The rendered comment must show bullets and checkboxes on separate lines.
2. **Do not post literal escape sequences** like `\\n`, `\\t`, or JSON-escaped text into comment bodies.
3. Prefer safe body construction patterns:
   - PowerShell here-strings with actual line breaks, or
   - `gh api ... --method PATCH/POST -f "body=..."` where the body variable already contains real newlines.
4. Immediately verify the posted body (for example with `gh api ... --jq .body` or `gh pr view --comments`) and fix in-place if formatting is not human-readable.
5. For checklist comments, keep concise one-line bullets and avoid shell-escaped artifacts in the final rendered text.

## Markdown Authoring Guardrail (REQUIRED)

When creating or editing markdown in `.github/` (especially `*.instructions.md`):

1. Keep lines within markdownlint line-length limits (MD013, currently 120 chars).
2. Always add explicit language tags to fenced code blocks (MD040), for example `bash`, `powershell`, `json`, `yaml`, `markdown`, or `text`.
3. Keep required blank lines around headings, lists, and fenced blocks (MD022/MD031/MD032).
4. Before pushing, run `make docs-check-fix` then `make docs-check`; if lint still fails, fix manually until clean.

## Git Ref Cleanup Guardrail (REQUIRED)

When terminal output shows repeated prompts like:

```text
Deletion of directory '.git/refs/heads/feat' failed. Should I try again? (y/n)
Deletion of directory 'backups' failed. Should I try again? (y/n)
```

the agent must proactively run:

```powershell
pwsh ./scripts/cleanup-git-refs.ps1 -RepoPath <repo-root> -PruneEmptyParents
```

before retrying branch/ref deletion, `pack-refs`, `git gc`, or branch switching.

Notes:

- Do not wait for the user to interrupt and ask.
- Prefer this script-based cleanup flow over repeated interactive prompt retries.
- If the script reports `NOT_EMPTY:*`, preserve those folders and continue with non-destructive operations.
