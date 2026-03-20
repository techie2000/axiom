# Architecture as Code

This directory contains machine-readable architecture artifacts and implementation guidance for Axiom's
Architecture as Code pilot.

## Goal

Introduce a low-risk Architecture as Code workflow that complements existing ADR and Mermaid documentation,
then validate the model in CI to reduce architecture drift.

## Pilot Scope

The initial pilot models:

- System context
- Core runtime components
- Critical flows:
  - Authentication
  - LEI sync
  - SSI read path

See [pilot-scope.md](./pilot-scope.md) for boundaries and exclusions.

## Source of Truth Rules

- ADRs document architectural decision rationale (`why`).
- Architecture model artifacts capture structure and flows (`what`).
- Narrative docs explain implementation context (`how`).

## Contributor Workflow

1. Update model artifacts when changing cross-cutting boundaries or critical flows.
2. Keep links between model files, ADRs, and narrative docs in sync.
3. Run local model validation before opening PR.
4. Ensure CI model validation passes.

## Current Status

- Pilot planning and ADR proposal are in place.
- Model files and validation automation are intentionally incremental.
- Tracking issue: [#204](https://github.com/techie2000/axiom/issues/204)
