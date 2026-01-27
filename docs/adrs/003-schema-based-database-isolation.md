# ADR-003: Schema-Based Database Isolation with Migration Path

## Status

Accepted

## Date

2026-01-26

## Context

Axiom spans multiple business domains (reference, trading, settlement) with different:

- Access patterns (reference data is read-heavy; trading is write-heavy)
- Data lifecycles (reference data is relatively static; trading data is high-velocity)
- Ownership boundaries (different teams may own different domains)
- Scaling requirements (trading may need more resources than reference)

We need a database organization strategy that:

- Provides logical separation between domains
- Limits blast radius of schema changes or issues
- Allows independent scaling in the future
- Is cost-effective and simple to manage initially
- Enables migration to separate instances when needed

## Decision

We will use **schema-based isolation within a single PostgreSQL instance** initially, with a clear migration path to separate instances as load demands.

### Initial Structure

Single PostgreSQL instance with separate schemas:

```
axiom_db
├── reference (schema)
│   ├── countries
│   ├── currencies
│   ├── accounts
│   └── instruments
├── trading (schema)
│   ├── trades
│   ├── allocations
│   └── confirmations
└── settlement (schema)
    ├── instructions
    ├── messages
    ├── cash_movements
    └── stock_movements
```

### Future Migration Path

As workload grows, migrate "hot" schemas to dedicated instances:

```
axiom_reference_db → Low-medium load, mostly reads
axiom_trading_db   → High load, write-heavy
axiom_settlement_db → Medium-high load, mixed
```

## Rationale

### Why Start with Schemas?

1. **Simplicity**: Single instance to manage, backup, monitor
2. **Cost-effective**: One server, one connection pool, shared resources
3. **Sufficient isolation**: Schemas provide namespace separation and permission boundaries
4. **Cross-schema queries**: Can join reference data with operational data when needed
5. **Easy development**: Simpler local setup for developers
6. **Gradual scaling**: Start simple, scale when data proves it's necessary

### Why Not Separate Databases Initially?

- Premature optimization without proven load requirements
- Higher operational complexity (multiple backups, monitoring, connections)
- More expensive (need resources for each instance)
- Harder to iterate during early development

### Why Not Single Schema?

- No isolation between domains
- Schema changes affect everything
- Cannot separate permissions by domain
- Harder to migrate later

## Consequences

### Positive

- **Simple operations**: One database to backup, monitor, tune
- **Faster development**: Easy local setup, cross-domain queries when needed
- **Cost-effective**: Share resources across domains
- **Clear boundaries**: Schemas enforce separation of concerns
- **Permission control**: Can grant different access per schema
- **Migration path**: Can move to separate instances without application rewrites

### Negative

- **Shared resources**: Heavy load in trading could impact reference queries (mitigated by monitoring)
- **Single point of failure**: All domains down if instance fails (mitigated by HA setup)
- **Future migration effort**: Moving to separate instances requires DevOps work

### Migration Strategy

When metrics show resource contention:

1. Set up new dedicated instance for hot domain
2. Use logical replication to migrate data
3. Update connection strings in service configs
4. Cutover during maintenance window
5. Decommission old schema

## Notes

- Use different PostgreSQL roles per schema for access control
- Monitor query performance per schema to identify when to split
- Consider connection pooling with schema-aware routing
- Document cross-schema dependencies before splitting

## Related ADRs

- [ADR-002: PostgreSQL for Data Persistence](002-postgresql-for-data-persistence.md)
- [ADR-006: Audit Trail for Reference Data Provenance](006-audit-trail-for-provenance.md)
