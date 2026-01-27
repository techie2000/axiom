# ADR-002: PostgreSQL for Data Persistence

## Status

Accepted

## Date

2026-01-26

## Context

Axiom serves as the single source of truth for reference data (countries, currencies, accounts, instruments) and operational data (trades, settlements, allocations). This requires a robust, reliable database that:

- Provides ACID compliance for data integrity
- Supports complex queries for reference data lookups
- Can scale to handle trading volumes
- Avoids vendor lock-in
- Has strong Go driver support

## Decision

We will use **PostgreSQL** as the primary database for all Axiom domains.

## Rationale

### Why PostgreSQL?

1. **Vendor-neutral**: Open-source with permissive license; no lock-in to Oracle, Sybase, or Microsoft
2. **ACID compliance**: Full transactional support critical for reference data integrity
3. **Mature and battle-tested**: Used in production by major financial institutions
4. **Rich feature set**:
   - JSONB for flexible schema evolution
   - Full-text search capabilities
   - Foreign key constraints for referential integrity
   - Excellent indexing options
5. **Strong Go support**: Multiple production-ready drivers (lib/pq, pgx)
6. **Cost**: Free and open-source with enterprise features
7. **Tooling**: Excellent ecosystem (pgAdmin, Flyway, monitoring tools)

### Alternatives Considered

- **Oracle**: Expensive licensing, vendor lock-in, overkill for our use case
- **SQL Server**: Microsoft lock-in, licensing costs, Windows-centric
- **MySQL**: Less feature-rich, weaker ACID guarantees historically
- **MongoDB**: Document store not ideal for structured reference data with relationships
- **Sybase**: Legacy platform, limited modern tooling, vendor lock-in

## Consequences

### Positive

- No vendor lock-in or licensing costs
- Rich feature set supports complex reference data relationships
- Strong community and ecosystem
- Can run on any platform (Linux, Windows, macOS)
- Excellent performance for read-heavy reference data workloads
- Native support for JSON when flexibility is needed

### Negative

- Team needs PostgreSQL expertise
- Requires operational knowledge for tuning and maintenance
- Horizontal scaling requires planning (read replicas, partitioning)

### Neutral

- Use connection pooling (pgBouncer or application-level)
- Migration tooling needed (Flyway, golang-migrate, or similar)
- Standard backup/restore procedures apply

## Notes

- Start with PostgreSQL 15+ for latest performance improvements
- Use prepared statements to prevent SQL injection
- Implement proper indexing strategy for reference data lookups
- Consider materialized views for complex reporting queries

## Related ADRs

- [ADR-003: Schema-Based Database Isolation](003-schema-based-database-isolation.md)
- [ADR-006: Audit Trail for Reference Data Provenance](006-audit-trail-for-provenance.md)
- [ADR-007: Exclude Formerly Used Country Codes](007-exclude-formerly-used-country-codes.md)
