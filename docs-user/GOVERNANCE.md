# User Documentation Governance

This document defines the ownership, review cadence, and quality standards for the
`docs-user/` end-user documentation site.

## Ownership

| Area | Owner |
| --- | --- |
| `getting-started/` | Product / UX lead |
| `workflows/` | Domain / feature owners per module |
| `admin/` | Platform / operations team |
| `reference/` | Data operations team |
| `troubleshooting/` | Support / operations team |
| Site configuration (`.vitepress/config.ts`) | Engineering lead |
| Governance (this file) | Documentation owner |

The documentation owner is responsible for ensuring page owners are kept up to date and for
driving periodic reviews.

## Review cadence

| Review type | Frequency | Owner |
| --- | --- | --- |
| Content accuracy check per module | After each UI release | Feature owner |
| Full site review (all pages) | Quarterly | Documentation owner |
| Screenshot freshness audit | At each major release milestone | UX lead |
| Link and lint check (CI) | Every pull request | Automated (CI) |

## Contribution workflow

1. Create a branch from `main` following the project branching strategy.
2. Edit or create the relevant Markdown file in `docs-user/`.
3. Run the local dev server to preview your changes:

   ```bash
   cd docs-user
   npm install
   npm run docs:dev
   ```

4. Verify the VitePress build succeeds with no dead links:

   ```bash
   make docs-user-check
   ```

5. Run markdown lint:

   ```bash
   make docs-check
   ```

6. Open a pull request. Include a domain or product owner as a reviewer for workflow pages.
7. Obtain at least one approval from the content area owner before merging.

## Content quality standards

- Follow the workflow page structure defined in
  [INFORMATION_ARCHITECTURE.md](./INFORMATION_ARCHITECTURE.md): Goal → Prerequisites →
  Steps → Expected result → Common issues → Related tasks.
- Use plain, task-oriented language. Write for an operations user, not a developer.
- Do not include engineering internals, ADR rationale, or deployment details in user docs.
- Screenshots are optional but encouraged for key transitions. Store screenshots in
  `docs-user/public/screenshots/` and reference them with relative paths.
- All new pages must be added to the sidebar in `.vitepress/config.ts`.

## Deprecation and removal

- Pages for features that are removed from the application must be updated to reflect the removal
  or deleted from the site.
- Pages for planned-but-not-yet-released features (marked **Coming Soon**) must be reviewed and
  updated when the feature ships.

## Relationship to engineering docs

- `docs-user/` — end-user and operations documentation.
- `docs/` — engineering documentation (ADRs, architecture, API reference, deployment).

End-user docs may link to engineering docs as a "technical reference" escalation path.
Engineering docs should link to user flows where a workflow context is helpful.
Do not route end users into ADR pages from primary user-doc navigation.

## Related pages

- [Information Architecture](./INFORMATION_ARCHITECTURE.md) — page structure and content rules.
- [Rollout Plan](./ROLLOUT_PLAN.md) — phased delivery history.
- [Migration Matrix](./MIGRATION_MATRIX.md) — mapping of existing docs to user-doc targets.
