# Axiom User Documentation

This directory is the dedicated home for end-user documentation, powered by
[VitePress](https://vitepress.dev/).

Purpose:

- Explain how to use the Axiom application.
- Walk through workflows screen-by-screen.
- Provide user-friendly reference material (including future data dictionary pages).

Non-goals:

- Deep architecture details.
- ADR history.
- CI/CD and deployment internals.

Those remain in [`docs/`](../docs/README.md).

## Running the documentation site locally

```bash
cd docs-user
npm install
npm run docs:dev
```

The site is served at `http://localhost:5173/docs-user/` by default.

To build a production copy:

```bash
npm run docs:build
```

## Structure

```text
docs-user/
├── .vitepress/
│   └── config.ts           # VitePress site configuration
├── package.json
├── getting-started/        # Sign-in, navigation, and first-use guides
├── workflows/              # Step-by-step workflow guides
├── admin/                  # Admin-only workflow guides
├── reference/              # Data dictionary, statuses, and roles
└── troubleshooting/        # Common errors and FAQ
```

## Planning Artifacts

- [Information Architecture](./INFORMATION_ARCHITECTURE.md)
- [Migration Matrix](./MIGRATION_MATRIX.md)
- [Rollout Plan](./ROLLOUT_PLAN.md)

## Content Style

Each workflow page follows:

1. Goal
2. Prerequisites
3. Steps
4. Expected result
5. Common issues
6. Related tasks

## Status

Phase 2 (VitePress Bootstrap) is complete. The site builds locally and includes priority-wave
workflow pages. See [Rollout Plan](./ROLLOUT_PLAN.md) for the full roadmap.
