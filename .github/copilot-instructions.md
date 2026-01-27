# Copilot Instructions for Axiom

## Project Overview
**Axiom** is a parent/aggregate project serving as a **single source of truth** for enterprise reference data and operational data across trading, settlement, and reference domains.

### Data Ingestion Pipeline
```
CSV files → csv2json (Go) → RabbitMQ → canonicalizer (Go) → PostgreSQL (Axiom modules)
```
- **csv2json**: Converts human-readable CSV bulk data to JSON
- **canonicalizer**: Dequeues from RabbitMQ, standardizes data, writes to Axiom databases
- **Axiom modules**: Go services exposing domain data from PostgreSQL

## Architecture: Modular Domain Design

### Module Naming Convention
All sub-modules follow the pattern: `axiom.[domain].[entity]`

### Domain Structure

#### Reference Data (`axiom.reference.*`)
Core reference data entities with strict dependency ordering:
- `axiom.reference.countries` ⚠️ **First priority** - foundation for other modules
- `axiom.reference.currencies` - depends on countries
- `axiom.reference.accounts` - depends on countries & currencies
- `axiom.reference.instruments` - depends on accounts, countries, currencies

#### Trading Domain (`axiom.trading.*`)
- `axiom.trading.trades`
- `axiom.trading.allocations`
- `axiom.trading.confirmations`

#### Settlement Domain (`axiom.settlement.*`)
- `axiom.settlement.instructions`
- `axiom.settlement.messages`
- `axiom.settlement.cashMovements`
- `axiom.settlement.stockMovements`

#### Future Domains (Planned)
- Collateral management
- Fails tracking
- Netting
- Corporate actions
- Reconciliation

## Project Structure
```
axiom/                           # Parent project (this repository)
├── .github/                     # GitHub configuration
│   └── appmod/appcat/          # Application modernization tooling
├── docs/
│   └── adrs/                   # Architecture Decision Records
├── go.work                     # Go workspace file
├── csv2json/                   # CSV to JSON conversion tool
├── canonicalizer/              # Data standardization service
└── modules/
    ├── reference/
    │   ├── countries/          # go.mod - First module (in development)
    │   ├── currencies/         # go.mod - Planned
    │   ├── accounts/           # go.mod - Planned
    │   └── instruments/        # go.mod - Planned
    ├── trading/
    │   ├── trades/             # go.mod - Planned
    │   ├── allocations/        # go.mod - Planned
    │   └── confirmations/      # go.mod - Planned
    └── settlement/
        ├── instructions/       # go.mod - Planned
        ├── messages/           # go.mod - Planned
        ├── cashMovements/      # go.mod - Planned
        └── stockMovements/     # go.mod - Planned
```
**Monorepo structure** with Go workspaces for unified development while maintaining module independence.

## Critical Dependency Chain
```
countries → currencies → accounts → instruments
```
**Rule**: Never create downstream modules before their dependencies are complete.
Technology Stack

### Languages & Frameworks
- **Go**: Primary language for all Axiom services
  - csv2json: CSV to JSON conversion utility
  - canonicalizer: RabbitMQ consumer + data standardization
  - axiom.*.* modules: Domain services (RabbitMQ → PostgreSQL)

### Infrastructure
- **Database**: PostgreSQL (open-source, vendor-neutral)
  - **Strategy**: Start with single PostgreSQL instance using schemas
    - `axiom_db.reference`: countries, currencies, accounts, instruments
    - `axiom_db.trading`: trades, allocations, confirmations
    - `axiom_db.settlement`: instructions, messages, cash/stock movements
  - **Future**: Migrate hot domains to separate instances as load demands
  
- **Message Queue**: RabbitMQ for decoupled data ingestion
- **Configuration**: Environment files (.env) for all services

### Architecture Decision Records (ADRs)
Stored in [docs/adrs/](docs/adrs/) - see ADR documentation for key decisions

**ADR Best Practices**:
1. **Naming**: Use format `NNN-brief-description.md` (e.g., `006-audit-trail-for-provenance.md`)
2. **Required Sections**: Status, Date, Context, Decision, Rationale, Consequences, Notes, Related ADRs
3. **Cross-References**: Maintain **bidirectional** links between related ADRs
   - When creating a new ADR that relates to existing ADRs, update references in **both** directions
   - Example: If ADR-006 relates to ADR-002, add "ADR-002" to ADR-006 **AND** add "ADR-006" to ADR-002
   - Keep Related ADRs in chronological order (oldest first)
   - Always use hyperlinks: `[ADR-NNN: Title](NNN-brief-description.md)`
4. **When to Create**: Technology choices, architectural patterns, major design decisions with long-term impact

## Development Workflow

### Monorepo with Go Workspaces
- **Single repository** containing all Axiom modules
- Each module is an independent Go module with its own `go.mod`
- `go.work` file at root coordinates all modules
- Benefits: atomic cross-module changes, unified CI/CD, easier testing

### Module Structure
- Each module is independently buildable and testable
- Modules under `modules/[domain]/[entity]/`
- Shared utilities can live in `internal/` or `pkg/` at root
- Each module has its own versioning and can be released independently

### Current Development Phase
🚧 **Active**: `modules/reference/countries/` (foundational module)
📋 **Next**: `modules/reference/currencies/`

## Conventions & Patterns

### Data Integrity Principles
- **Single Source of Truth**: Axiom is the authoritative source for all reference and operational data
- **Dependency Awareness**: Respect the module dependency chain
- **Domain Boundaries**: Keep domain logic within respective modules

### Module Integration
- Reference data modules expose consistent interfaces
- Downstream modules consume reference data through defined contracts
- Cross-domain dependencies must be explicitly documented

## Documentation Standards

### Markdown Guidelines
Follow official Markdown linting rules to maintain consistency and compatibility:

1. **MD031/MD032: Blank Lines Around Blocks**
   - Always surround lists with blank lines (before and after)
   - Always surround fenced code blocks with blank lines (before and after)
   - Always surround headings with blank lines

2. **MD040: Fenced Code Language**
   - Always specify language for fenced code blocks
   - Use appropriate language identifiers: `go`, `bash`, `powershell`, `json`, `yaml`, `sql`, `mermaid`, etc.
   - Use `text` or `plaintext` if no specific language applies

3. **MD060: Table Column Style**
   - Use consistent spacing in table pipes
   - Format: `| Column1 | Column2 |` (space before and after pipe)
   - Align header separators: `| ------- | ------- |`

4. **Mermaid Diagrams**
   - Use Mermaid flowcharts instead of ASCII art for data flows
   - Specify language as `mermaid` in fenced code blocks
   - Include color styling for clarity

**Example:**

```markdown
## Section Title

This is a paragraph with proper spacing.

- List item 1
- List item 2
- List item 3

Another paragraph after the list.

| Column 1 | Column 2 |
| -------- | -------- |
| Value A  | Value B  |

Code example with language specified:

\`\`\`go
func main() {
    fmt.Println("Hello, World!")
}
\`\`\`

Final paragraph.
```

## Notes for AI Agents

- **Current State**: Project initialization - setting up monorepo structure and first module
- **Priority**: Establish `modules/reference/countries/` as the foundation
- When creating new modules:
  1. Verify all dependencies exist
  2. Follow structure: `modules/[domain]/[entity]/`
  3. Create independent `go.mod` for each module
  4. Update `go.work` to include new module
  5. Maintain clear domain boundaries
  6. Document data contracts and integration points
- **Documentation**: Follow markdown guidelines above for all .md files

---
*Last updated: January 26, 2026*
*This file should be updated as the codebase evolves*
