# ADR-0015: Architecture as Code (CALM) Pilot Adoption

**Status:** Proposed
**Date:** 2026-03-20
**Decision Makers:** Engineering Team
**Context:** Architecture Governance / Documentation Strategy

## Context and Problem Statement

Axiom has strong narrative architecture documentation in `docs/architecture.md` and a healthy ADR history in
`docs/adr/`. This is effective for human readers but currently lacks machine-readable architecture artifacts that can be
validated in CI and diffed consistently during PR review.

The team wants to introduce Architecture as Code in a low-risk way and evaluate whether this improves:

- Architecture drift detection
- PR impact analysis for cross-cutting changes
- Onboarding speed for new contributors
- Consistency between architecture documentation and implementation

## Decision Drivers

- Preserve existing ADR and Mermaid documentation investments
- Minimize delivery risk and documentation churn
- Introduce automated architecture validation gradually
- Keep model scope intentionally small for first adoption cycle
- Enable cloud-based continuation and collaboration through issue-driven workflow

## Options Considered

### Option 1: Keep narrative-only architecture docs

**Pros:**

- No additional tooling or process changes
- Zero CI overhead

**Cons:**

- Architecture drift remains largely manual to detect
- Harder to perform model-level impact analysis in reviews
- No machine-readable source for architecture validation

### Option 2: Big-bang migration to full Architecture as Code

**Pros:**

- Immediate full coverage of architecture model
- Unified representation from day one

**Cons:**

- High rollout risk and contributor friction
- Significant upfront modeling effort
- Higher chance of stale artifacts if adoption is not mature

### Option 3: Incremental CALM pilot layered onto existing ADR + Mermaid (chosen)

**Pros:**

- Low-risk adoption path
- Keeps existing documentation as stable baseline
- Enables measurable validation gains before broad expansion
- Supports phased CI enforcement

**Cons:**

- Temporary dual-maintenance between narrative and model artifacts
- Requires explicit source-of-truth boundaries to avoid ambiguity

## Decision Outcome

**Chosen Option:** Option 3 - incremental CALM pilot layered onto existing architecture documentation.

### Rationale

A pilot approach gives the team a practical way to evaluate value before committing to broad model coverage.
It aligns with current team workflows and CI maturity while keeping implementation changes scoped and reversible.

### Trade-offs Accepted

- During pilot, architecture updates may require touching both narrative and model files.
- CI gates start in warning mode, so some drift risk remains during initial stabilization.
- Full coverage is deferred in favor of proving value on critical flows first.

## Consequences

### Positive

- Introduces machine-readable architecture artifacts without destabilizing current docs.
- Enables architecture validation in PR workflows.
- Improves traceability between decisions, structure, and implementation changes.

### Negative

- Additional contributor learning curve for CALM concepts and workflow.
- Initial implementation overhead for model authoring and CI integration.

### Mitigation

- Keep pilot scope small and explicit.
- Provide clear contributor guidance in `docs/architecture-as-code/`.
- Start CI in non-blocking mode and promote only after one stable sprint.

## Source-of-Truth Policy

- ADRs remain the source of truth for *why* decisions were made.
- CALM model artifacts become the source of truth for *what* architecture structure and key flows exist.
- Narrative architecture docs remain the primary explanatory layer for broad audiences.

## Implementation

Phase 1 (Pilot baseline):

- Create `docs/architecture-as-code/` and define pilot scope.
- Model system context, core runtime components, and three critical flows:
  - Authentication
  - LEI sync
  - SSI read path

Phase 2 (Validation):

- Add local and CI model validation command parity.
- Run CI gate in warning mode for one sprint.

Phase 3 (Enforcement and review):

- Promote validation gate to blocking.
- Require architecture model updates when changes affect boundaries or critical flows.

## References

- [Architecture Overview](../architecture.md)
- [Architecture as Code Pilot Scope](../architecture-as-code/pilot-scope.md)
- [Tracking Issue #204](https://github.com/techie2000/axiom/issues/204)
- [FINOS Architecture as Code](https://github.com/finos/architecture-as-code)

## Revision History

- **2026-03-20:** Initial proposal.
