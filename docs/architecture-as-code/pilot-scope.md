# Architecture as Code Pilot Scope

## Included in v1

- System context representation for Axiom.
- Core runtime components:
  - Frontend
  - Backend API
  - PostgreSQL
  - RabbitMQ
- Three critical flows:
  - Authentication
  - LEI synchronization
  - SSI read path

## Excluded in v1

- Full domain-by-domain decomposition.
- Exhaustive sequence coverage for all endpoints.
- Auto-generation of deployment/runtime manifests from architecture model.
- Broad governance/process rewrite beyond pilot workflow updates.

## Entry Criteria

- [ADR-0015](../adr/adr-0015-architecture-as-code-calm-pilot.md) proposed and linked.
- [Tracking issue #204](https://github.com/techie2000/axiom/issues/204) open with task checklist.
- Documentation links available from [Architecture as Code overview](README.md) and [llms.txt](../../llms.txt).
- Initial CALM model exists at [axiom-core.architecture.json](models/axiom-core.architecture.json).

## Exit Criteria

- Model validation integrated in CI and run locally with parity.
- At least one PR review uses architecture model diff for impact analysis.
- Team agrees whether to expand scope or keep high-impact-only coverage.

## Review Cadence

- Weekly during pilot.
- Decision checkpoint after 2 to 3 weeks.

## Ownership

- Architecture owners: maintain model shape and boundaries.
- Feature owners: update affected flows/components in same PR.
- Reviewers: enforce source-of-truth policy and update requirements.
