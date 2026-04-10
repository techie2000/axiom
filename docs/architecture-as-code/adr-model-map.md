# ADR to CALM Model Mapping

This mapping links architecture decisions to machine-readable CALM artifacts for review traceability.

## Current Mapping

- [ADR-0001: Modular Monolith](../adr/adr-0001-modular-monolith-architecture.md)
  - CALM impact: system boundaries and core runtime nodes in [axiom-core.architecture.json](models/axiom-core.architecture.json)
- [ADR-0004: JWT Authentication](../adr/adr-0004-jwt-authentication.md)
  - CALM impact: authentication flow in [axiom-core.architecture.json](models/axiom-core.architecture.json) (`flow-authentication`)
- [ADR-0005: RabbitMQ Async Processing](../adr/adr-0005-rabbitmq-async-processing.md)
  - CALM impact: async relationship and LEI sync flow in
    [axiom-core.architecture.json](models/axiom-core.architecture.json)
    (`rel-api-rabbitmq`, `flow-lei-sync`)
- [ADR-0015: Architecture as Code (CALM) Pilot Adoption](../adr/adr-0015-architecture-as-code-calm-pilot.md)
  - CALM impact: source-of-truth policy and pilot scope captured by
    [Architecture as Code overview](README.md),
    [pilot scope](pilot-scope.md), and
    [axiom-core.architecture.json](models/axiom-core.architecture.json)

## Usage in PR Reviews

When a PR changes architecture boundaries, reviewers should verify:

1. Decision alignment: affected ADR references still match implementation intent.
2. Model alignment: impacted flows/relationships are updated in CALM JSON.
3. Documentation alignment: architecture narrative and model links remain current.
