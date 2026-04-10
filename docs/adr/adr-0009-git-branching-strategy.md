---
post_title: "ADR-0009: Git Branching Strategy"
author1: "techie2000"
post_slug: "adr-0009-git-branching-strategy"
microsoft_alias: "techie2000"
featured_image: "https://placehold.co/1200x630.png"
categories: ["devops"]
tags: ["adr", "devops", "git", "branching", "workflow"]
ai_note: "AI-assisted draft based on repository state and user request."
summary: "Records the decision to adopt a trunk-based branching strategy with protected long-lived branches
  for dev, uat, and prod promotion gates."
post_date: "2026-02-24"
title: "ADR-0009: Git Branching Strategy"
status: "Accepted"
date: "2026-02-24"
authors: "techie2000"
supersedes: ""
superseded_by: ""
---

## Status

Accepted

## Context

Axiom supports three deployment environments (dev, UAT, production) as described in
[ADR-0007](adr-0007-docker-compose-local-dev.md). Day-to-day code lives on `main`, and feature and
bugfix branches are created off `main`. There was no formalised set of long-lived branches to act as
promotion gates between environments, making it unclear which commit was deployed where and how
changes were promoted. The project needs a lightweight, explicit strategy that matches its small-team
context while preserving a clear audit trail.

## Decision Drivers

- **DRV-001**: Keep the workflow simple for a small team.
- **DRV-002**: Provide a clear, auditable promotion path: dev → uat → prod.
- **DRV-003**: Protect stable branches from accidental direct pushes.
- **DRV-004**: `main` already acts as the active development integration branch — preserve this.
- **DRV-005**: Support short-lived feature, bugfix, hotfix, and chore branches.

## Decision

Adopt a **trunk-based strategy with environment promotion branches**.

`main` remains the primary integration branch (trunk). Three additional long-lived branches —
`dev`, `uat`, and `prod` — act as promotion gates, each corresponding to a deployed environment.
Short-lived branches (`feature/*`, `bugfix/*`, `hotfix/*`, `chore/*`) are created from `main`,
merged back via pull request, and deleted after merging.

```text
main  ──────────────────────────────────────────► (active development)
        │  feature branches merge back here
        ▼
       dev  ──────────────────────────────────────► (dev environment)
              ▼ promote (PR)
             uat  ─────────────────────────────────► (UAT environment)
                    ▼ promote (PR)
                   prod ──────────────────────────► (production environment)
```

Promotion from one environment branch to the next is done via a pull request so that the event is
logged, reviewable, and linked to a CI run.

## Decision Outcome

**Chosen Option:** Trunk-based strategy with `dev`, `uat`, and `prod` promotion branches.

## Branch Definitions

| Branch | Purpose | Source | Merge target |
| ------ | ------- | ------ | ----------- |
| `main` | Active development integration | — | `dev` (to promote) |
| `dev` | Tracks what is deployed to the dev environment | `main` | `uat` (to promote) |
| `uat` | Tracks what is deployed to UAT | `dev` | `prod` (to promote) |
| `prod` | Tracks what is deployed to production | `uat` | — |
| `feature/*` | New feature work | `main` | `main` |
| `bugfix/*` | Non-urgent bug fixes | `main` | `main` |
| `hotfix/*` | Urgent production fixes | `prod` | `prod` then `main` |
| `chore/*` | Maintenance, dependency bumps, docs | `main` | `main` |

## Consequences

### Positive

- **POS-001**: Clear, explicit promotion path aligned with environments.
- **POS-002**: Every promotion is a pull request — reviewable and linked to CI.
- **POS-003**: Minimal overhead — `main` workflow is unchanged for daily work.
- **POS-004**: Branch names mirror environment names in docker-compose files.

### Negative

- **NEG-001**: Three additional long-lived branches require maintenance hygiene.
- **NEG-002**: Fast-forward drift between branches can accumulate if promotions are infrequent.
- **NEG-003**: Hotfix flows require merging to `prod` *and* cherry-picking or merging back to `main`.

### Mitigation

- **MIT-001**: Branch protection rules enforce PR-only merges; no direct pushes.
- **MIT-002**: Automation (GitHub Actions) or periodic promotion PRs prevent long drift windows.
  Three scheduled workflows implement this across the full promotion chain:
  - [`promote-main-to-dev`](.github/workflows/promote-main-to-dev.yml) — daily at 01:00 UTC
  - [`promote-dev-to-uat`](.github/workflows/promote-dev-to-uat.yml) — weekly (Monday 01:00 UTC)
  - [`promote-uat-to-prod`](.github/workflows/promote-uat-to-prod.yml) — monthly (1st at 01:00 UTC)
- **MIT-003**: Hotfix documentation provides a clear procedure for back-merging.

## Alternatives Considered

### GitFlow

- **ALT-001**: **Description**: Separate `develop`, `release/*`, and `main` (stable) branches with
  strict merge rules.
- **ALT-002**: **Rejection Reason**: Higher ceremony for a small team; `main`-as-trunk is already
  established.

### Strict trunk-based (no environment branches)

- **ALT-003**: **Description**: Deploy directly from `main`; environments distinguished only by CI
  pipeline configuration.
- **ALT-004**: **Rejection Reason**: Loses explicit per-environment audit trail; harder to see what
  is deployed where at a glance.

### Environment branches without a trunk

- **ALT-005**: **Description**: Use `dev` as the integration branch instead of `main`.
- **ALT-006**: **Rejection Reason**: Changes existing workflow and tooling that already reference
  `main`.

## Implementation Notes

- **IMP-001**: See [docs/contributing/BRANCHING_STRATEGY.md](../contributing/BRANCHING_STRATEGY.md)
  for day-to-day workflow guidance and branch setup instructions.
- **IMP-002**: Branch protection must be configured in GitHub — see the setup script at
  [scripts/setup-branches.sh](../../scripts/setup-branches.sh).
- **IMP-003**: CI/CD pipelines should key off branch names to select the deployment target.
  The [`ci` workflow](.github/workflows/ci.yml) detects the target environment from the branch
  name (`dev` → dev, `uat` → UAT, `prod` → production) and reports it in the CI summary job.

## References

- **REF-001**: [docs/contributing/BRANCHING_STRATEGY.md](../contributing/BRANCHING_STRATEGY.md)
- **REF-002**: [ADR-0007: Docker Compose Local Development](adr-0007-docker-compose-local-dev.md)
- **REF-003**: [scripts/setup-branches.sh](../../scripts/setup-branches.sh)
- **REF-004**: [Trunk-Based Development](https://trunkbaseddevelopment.com/)
