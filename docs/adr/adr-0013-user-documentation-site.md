# ADR-0013: Dedicated User Documentation Site (`docs-user/`)

**Status:** Accepted
**Date:** 2026-03-13
**Decision Makers:** Engineering Team
**Context:** Documentation Strategy / Product Adoption

## Context and Problem Statement

The repository currently uses `docs/` as a mixed documentation tree containing architecture, ADRs,
environment setup, CI/CD practices, performance notes, and operational runbooks. This structure is
useful for engineers but not ideal for end users who need a polished "how to use the app" experience.

The product documentation goal has shifted toward:

- Screen-by-screen walkthroughs.
- Task/workflow-driven guidance.
- Admin and operational "how-to" procedures in plain language.
- A user-friendly reference section (including a potential data dictionary).

A single mixed-audience docs tree makes navigation noisy and increases the risk that end users land
on implementation-heavy pages.

## Decision Drivers

- End-user docs must be polished and workflow-first.
- Engineering docs must remain complete and close to source code changes.
- The split should minimize disruption to the existing `docs/` tree.
- Naming should keep documentation folders grouped and predictable in repo listings.
- The chosen structure should support a dedicated docs PR and iterative rollout.

## Options Considered

### Option 1: Keep everything in `docs/`

**Pros:**

- No restructuring effort.
- Existing links remain unchanged.

**Cons:**

- Mixed audience navigation remains noisy.
- User docs compete with highly technical content.
- Harder to present a polished product-docs experience.

### Option 2: Add user docs under `docs/user/`

**Pros:**

- Keeps all docs under a single top-level folder.
- Clear audience split in path names.

**Cons:**

- User docs still visually nested under engineering-heavy tree.
- Less clear separation for future dedicated site tooling and ownership.

### Option 3: Create dedicated top-level `docs-user/` (chosen)

**Pros:**

- Explicit audience separation.
- Clean foundation for a dedicated VitePress-powered user documentation site.
- Keeps technical docs in `docs/` intact.
- Folder naming keeps documentation folders grouped alphabetically (`docs/`, `docs-user/`).

**Cons:**

- Requires a small number of index/link updates.
- Adds another docs root to maintain.

## Decision Outcome

**Chosen Option:** Option 3 - dedicated top-level `docs-user/` for end-user docs.

### Rationale

The team needs a polished user-facing documentation experience without destabilizing current
engineering documentation. `docs-user/` provides a clean, audience-first split and supports phased
migration to a dedicated site while preserving existing technical references in `docs/`.

### Trade-offs Accepted

- Two docs roots will exist (`docs/` and `docs-user/`).
- Some content will be duplicated or rewritten in user-friendly form during migration.
- Link governance is needed to ensure users are not routed into engineering-only pages by default.

## Consequences

### Positive

- End users get a focused "how to use the app" experience.
- Engineers keep existing architecture/ADR/ops docs unchanged in `docs/`.
- Documentation contributions can be assigned by audience.

### Negative

- Additional maintenance overhead for navigation and cross-linking.
- Requires governance to avoid stale user walkthroughs (especially screenshot-heavy pages).

### Mitigation

- Use a workflow page template for consistency.
- Add explicit cross-links between user and engineering docs when needed.
- Define doc ownership and review cadence for user-facing pages.

## Implementation

Phase 1:

- Keep `docs/` as engineering source-of-truth.
- Introduce `docs-user/` with a user-focused information architecture.
- Seed highest-value user workflows first (login/navigation, LEI, SSI, preferences, admin actions).

Phase 2:

- Stand up VitePress on top of `docs-user/` for polished publishing.
- Add search, structured nav, and screenshot standards.

Phase 3:

- Expand with data dictionary and troubleshooting content.
- Continuously refine based on user feedback.

## References

- [docs/README.md](../README.md)
- [llms.txt](../../llms.txt)
- [ADR-0012 Internationalisation](./adr-0012-internationalisation.md)

## Revision History

- **2026-03-13:** Initial decision.
