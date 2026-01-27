# ADR-001: Go as Primary Language for Axiom Services

## Status

Accepted

## Date

2026-01-26

## Context

Axiom requires a language for building multiple services that will:

- Process data from RabbitMQ queues (csv2json, canonicalizer)
- Transform and validate reference/operational data
- Interface with PostgreSQL databases
- Serve as domain services exposing data APIs
- Be deployed across multiple modules with consistent tooling

The services are primarily data-transformation pipelines: dequeue → transform → persist.

## Decision

We will use **Go (Golang)** as the primary language for all Axiom services, including:

- `csv2json`: CSV to JSON conversion utility
- `canonicalizer`: RabbitMQ consumer and data standardization service
- All `axiom.*.*` domain modules (countries, currencies, accounts, trades, etc.)

## Rationale

### Why Go?

1. **Excellent concurrency model**: Goroutines and channels are perfect for queue processing and parallel data transformation
2. **Performance**: Compiled binary with low memory footprint, ideal for data-intensive workloads
3. **Simple deployment**: Single static binary with no runtime dependencies
4. **Strong standard library**: Built-in CSV parsing, JSON encoding, HTTP servers
5. **Database support**: Excellent PostgreSQL drivers (lib/pq, pgx)
6. **Team consistency**: csv2json and canonicalizer already use Go
7. **Maintainability**: Simple language with minimal "magic", easy onboarding

### Alternatives Considered

- **Java/Spring Boot**: Too heavyweight for simple queue-to-DB services; longer startup times
- **Python**: Slower performance; requires runtime management; less suitable for concurrent processing
- **Node.js**: Good for APIs but less ideal for CPU-intensive data transformation
- **Rust**: Steeper learning curve; overkill for business logic services

## Consequences

### Positive

- Unified tooling and build process across all services
- Fast, efficient services with minimal resource usage
- Easy containerization (single binary)
- Excellent performance for queue processing
- Strong typing catches errors at compile time

### Negative

- Team must maintain Go expertise
- Some complex business logic may be more verbose than in higher-level languages
- Limited ecosystem compared to Java/Python for certain specialized libraries

### Neutral

- Go modules for dependency management
- Standard project layout conventions apply
- Testing with Go's built-in test framework

## Notes

- All services will use Go 1.21+ for generics support and improved performance
- Follow [Standard Go Project Layout](https://github.com/golang-standards/project-layout) conventions
- Use Go workspaces for monorepo management
