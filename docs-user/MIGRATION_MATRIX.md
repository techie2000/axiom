# User Docs Migration Matrix

This matrix maps current documentation to user-doc actions for the `docs-user/` rollout.

Legend:

- `reuse`: can be linked with minimal rewrite
- `rewrite`: content useful but needs user-facing rewrite
- `engineering-only`: keep in `docs/`, do not place in primary user nav
- `defer`: not required in initial launch

| Source | Audience today | Action | Target in `docs-user/` |
| --- | --- | --- | --- |
| `docs/README.md` | mixed | `rewrite` | `README.md` + section indexes |
| `docs/MASTER_DATA.md` | mixed | `rewrite` | `workflows/countries.md`, `workflows/currencies.md`, `reference/data-dictionary.md` |
| `docs/ssi/SSI_UI_SCHEMA.md` | mixed | `rewrite` | `workflows/ssi.md`, `reference/data-dictionary.md` |
| `docs/lei/LEI_QUICKSTART.md` | mixed | `rewrite` | `workflows/lei-records.md` |
| `docs/lei/LEI_IMPLEMENTATION_SUMMARY.md` | engineering-heavy | `engineering-only` | n/a |
| `docs/lei/LEI_DATA_FLOW.md` | engineering-heavy | `engineering-only` | n/a |
| `docs/i18n/INTERNATIONALISATION.md` | mixed | `rewrite` | `admin/translation-review.md` |
| `docs/ui-patterns.md` | engineering | `engineering-only` | n/a |
| `docs/environments/*` | engineering/ops | `engineering-only` | n/a |
| `docs/performance/*` | engineering | `engineering-only` | n/a |
| `docs/security/*` | engineering/security | `engineering-only` | n/a |
| `docs/adr/*` | engineering/architecture | `engineering-only` | n/a |
| `README.md` (root) | mixed | `reuse` | cross-link from `docs-user/README.md` |

## Initial Priority Wave

Priority 1 pages:

1. `getting-started/sign-in-and-access.md`
2. `getting-started/navigation-basics.md`
3. `workflows/lei-records.md`
4. `workflows/ssi.md`
5. `admin/user-approvals.md`
6. `reference/data-dictionary.md`

Priority 2 pages:

1. `workflows/countries.md`
2. `workflows/currencies.md`
3. `workflows/entities.md`
4. `workflows/instruments.md`
5. `workflows/accounts.md`
6. `troubleshooting/common-errors.md`

## Success Criteria

- A new user can complete core workflows without reading engineering docs.
- Admin users can perform approval/review workflows via user-doc pages.
- Data dictionary covers primary fields used in core workflows.
- Primary user nav contains only user-facing pages.
