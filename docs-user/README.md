# Axiom User Documentation

This directory is the dedicated home for end-user documentation.

Purpose:

- Explain how to use the Axiom application.
- Walk through workflows screen-by-screen.
- Provide user-friendly reference material (including future data dictionary pages).

Non-goals:

- Deep architecture details.
- ADR history.
- CI/CD and deployment internals.

Those remain in [`docs/`](../docs/README.md).

## Planned Structure

- `getting-started/`
- `workflows/`
- `admin/`
- `reference/`
- `troubleshooting/`

## Planning Artifacts

- [Information Architecture](./INFORMATION_ARCHITECTURE.md)
- [Migration Matrix](./MIGRATION_MATRIX.md)
- [Rollout Plan](./ROLLOUT_PLAN.md)

## Content Style

Each workflow page should follow:

1. Goal
2. Prerequisites
3. Steps
4. Expected result
5. Common issues

## Status

This is an initial bootstrap directory created to support a dedicated user-docs PR and staged
migration to a polished VitePress site.
