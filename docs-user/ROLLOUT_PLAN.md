# User Docs Rollout Plan

This plan defines a phased rollout for establishing `docs-user/` as the polished end-user documentation layer.

## Phase 1: Foundation ✅ Complete

- Create `docs-user/` root and conventions.
- Add ADR decision for split (`ADR-0013`).
- Publish IA and migration matrix.
- Add cross-links from existing doc indexes.

Exit criteria:

- Decision and scope are approved. ✅
- User-doc directory and governance conventions exist. ✅

## Phase 2: VitePress Bootstrap ✅ Complete

- Initialize VitePress in a dedicated docs-user site path.
- Add sidebar/nav aligned to `INFORMATION_ARCHITECTURE.md`.
- Configure search and basic theme.
- Add starter pages for priority wave.

Exit criteria:

- Local build works. ✅
- Navigation usable for end users. ✅
- At least 3 high-value workflow pages drafted. ✅

Pages delivered in Phase 2:

- `getting-started/sign-in-and-access.md` ✅
- `getting-started/navigation-basics.md` ✅
- `workflows/lei-records.md` ✅
- `workflows/ssi.md` ✅
- `admin/user-approvals.md` ✅
- `reference/data-dictionary.md` ✅

## Phase 3: Core Workflow Coverage ✅ Complete

- Complete priority 1 pages.
- Add screenshots for key workflow transitions.
- Add data dictionary seed pages for major modules.
- Add troubleshooting + FAQ baseline.

Exit criteria:

- Core workflows documented end-to-end. ✅
- Data dictionary exists for top user-facing entities. ✅

Pages delivered in Phase 3:

- `workflows/countries.md` ✅ — full workflow, fields, filters, common issues
- `workflows/currencies.md` ✅ — full workflow, compliance filters, fields, common issues
- `workflows/entities.md` ✅ — full workflow, LEI link, fields, common issues
- `workflows/instruments.md` ✅ — current Coming Soon state documented with planned fields
- `workflows/accounts.md` ✅ — current Coming Soon state documented with planned fields
- `reference/data-dictionary.md` ✅ — expanded with entity, instrument, account, and language fields
- `reference/statuses-and-states.md` ✅ — translation and file processing statuses added
- `reference/permissions-and-roles.md` ✅ — what users and admins can and cannot do
- `admin/translation-review.md` ✅ — full workflow with approval and rejection steps
- `admin/sync-triggers.md` ✅ — full workflow with monitoring and re-run guidance
- `troubleshooting/common-errors.md` ✅ — expanded with module-specific and admin errors
- `troubleshooting/faq.md` ✅ — comprehensive FAQ covering access, data, preferences, and admin

## Phase 4: Hardening and Publication

- Link check and markdown linting.
- Editorial pass for consistency and plain-language quality.
- Add ownership/review cadence.
- Publish and announce user docs entry points.

Exit criteria:

- Published site is discoverable.
- User docs and engineering docs are clearly separated.

## Governance

- User-doc PRs should include task validation from a product/domain owner.
- Engineering-doc changes should not alter user-doc IA without ADR or explicit review.
- Screenshot updates should be versioned or tracked to UI release milestones.
