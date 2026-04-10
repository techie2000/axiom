# User Documentation Information Architecture

This document defines the target structure for user-facing documentation in `docs-user/`.

## Audience

Primary audience:

- End users
- Operations users performing in-app workflows
- Admin users managing approvals and user-facing settings

Out of scope:

- Backend architecture
- ADR implementation rationale
- CI/CD, deployment internals, and environment plumbing

## Navigation Model

1. Getting Started
2. Core Workflows
3. Admin Workflows
4. Reference
5. Troubleshooting

## Proposed File Tree

```text
docs-user/
├── README.md
├── getting-started/
│   ├── index.md
│   ├── sign-in-and-access.md
│   └── navigation-basics.md
├── workflows/
│   ├── index.md
│   ├── countries.md
│   ├── currencies.md
│   ├── entities.md
│   ├── instruments.md
│   ├── accounts.md
│   ├── ssi.md
│   └── lei-records.md
├── admin/
│   ├── index.md
│   ├── user-approvals.md
│   ├── translation-review.md
│   └── sync-triggers.md
├── reference/
│   ├── index.md
│   ├── data-dictionary.md
│   ├── statuses-and-states.md
│   └── permissions-and-roles.md
└── troubleshooting/
    ├── index.md
    ├── common-errors.md
    └── faq.md
```

## Workflow Page Standard

Each workflow page should include the following sections in order:

1. Goal
2. Prerequisites
3. Steps
4. Expected result
5. Common issues
6. Related tasks

## Content Rules

- Use task-oriented titles (for example, "Update a currency") instead of technical titles.
- Keep first screenful actionable; avoid implementation history in user docs.
- Use screenshots intentionally to show key transitions, not every click.
- Link to engineering docs only when the user must escalate.

## Cross-Linking Rules

- User docs may link to engineering docs as "technical reference" only.
- Engineering docs should link back to user flows where relevant.
- Avoid routing end users into ADR pages from primary nav.
