---
post_title: "ADR-0019: Deprecate lei_raw.lei_records.changed_fields"
author1: "techie2000"
post_slug: "adr-0019-lei-records-changed-fields-deprecation"
microsoft_alias: "techie2000"
featured_image: "/assets/images/adr-0019-lei-records-changed-fields-deprecation.png"
categories: ["backend", "database", "lei"]
tags: ["adr", "lei", "audit", "schema", "postgres"]
ai_note: "AI-assisted evaluation based on repository runtime/query consumer analysis."
summary: "Records the decision that lei_raw.lei_records.changed_fields is legacy and should be removed, with
  implementation tracked in issue #474."
post_date: "2026-05-13"
title: "ADR-0019: Deprecate lei_raw.lei_records.changed_fields"
status: "Accepted"
date: "2026-05-13"
authors: "techie2000"
supersedes: ""
superseded_by: ""
---

## Status

Accepted

## Context

The LEI schema currently stores `changed_fields` in both:

- `lei_raw.lei_records` (base table, "last change details")
- `lei_raw.lei_records_audit` (historical audit trail per action)

Recent behavior drift showed that some update paths do not populate base-table
`changed_fields` consistently, while audit-table `changed_fields` is still used for
history views and audit workflows.

## Decision Drivers

- Audit history must remain accurate and consistent.
- We should avoid duplicated, partially-maintained change metadata.
- Runtime read paths should have a single source of truth for changed fields.
- Any schema removal must account for API contract and migration impact.

## Consumer Verification

### Runtime/query consumers

1. **Audit history read path uses audit table data**:
   [`FindAuditHistoryByLEI`](../../backend/internal/repository/lei_repository.go) returns
   `domain.LEIRecordAudit` rows from `lei_raw.lei_records_audit`, and
   [`GetAuditHistory`](../../backend/internal/service/lei_service.go) and
   [`LEIAuditHistoryModal`](../../frontend/app/components/LEIAuditHistoryModal.tsx) consume
   audit `changed_fields`.
2. **No runtime/reporting read path depends on `lei_raw.lei_records.changed_fields`** was
   found in repository code search.
3. **Base-table writes are inconsistent**:
   - Batch/single upsert sets base `changed_fields` in
     [`lei_repository.go`](../../backend/internal/repository/lei_repository.go).
   - Provisional create inserts base `changed_fields`, but provisional update/succeed paths
     do not update base-table `changed_fields` in
     [`provisional_lei_repository.go`](../../backend/internal/repository/provisional_lei_repository.go).
4. **Provisional audit paths correctly write audit `changed_fields`** in
   [`provisional_lei_service.go`](../../backend/internal/service/provisional_lei_service.go).

### Documentation consumers

Documentation currently describes base-table `changed_fields` as last change details in
[`LEI_ACQUISITION.md`](../lei/LEI_ACQUISITION.md). This must be revised during removal.

## Decision

`lei_raw.lei_records.changed_fields` is considered a **legacy redundant column** and should
be removed. The authoritative source for change deltas is
`lei_raw.lei_records_audit.changed_fields`.

## Consequences

### Positive

- Eliminates duplicate, inconsistent change metadata storage.
- Clarifies architecture: base table stores current state; audit table stores change history.
- Reduces maintenance burden for update paths that currently diverge.

### Negative

- Removal requires coordinated code and migration updates where base-table writes currently
  reference `changed_fields`.
- `domain.LEIRecord` currently still exposes `changed_fields` in JSON; API contract handling
  must be explicit in the implementation change.

### Mitigation

- Perform schema + application updates in one implementation task.
- Update API/schema docs together with code changes.
- Keep audit table `changed_fields` unchanged to preserve UI audit history behavior.

## Follow-up Implementation

Implementation is tracked by GitHub issue
[`#474`](https://github.com/techie2000/axiom/issues/474).

Scope for #474:

- remove column via migration,
- remove or adapt base-table write references,
- decide and document API field behavior for `LEIRecord.changed_fields`,
- update LEI documentation accordingly.

## References

- [`backend/migrations/000002_create_lei_schema.up.sql`](../../backend/migrations/000002_create_lei_schema.up.sql)
- [`backend/internal/repository/lei_repository.go`](../../backend/internal/repository/lei_repository.go)
- [`backend/internal/repository/provisional_lei_repository.go`](../../backend/internal/repository/provisional_lei_repository.go)
- [`backend/internal/service/provisional_lei_service.go`](../../backend/internal/service/provisional_lei_service.go)
- [`backend/internal/service/lei_service.go`](../../backend/internal/service/lei_service.go)
- [`frontend/app/components/LEIAuditHistoryModal.tsx`](../../frontend/app/components/LEIAuditHistoryModal.tsx)
- [`docs/lei/LEI_ACQUISITION.md`](../lei/LEI_ACQUISITION.md)

## Revision History

- **2026-05-13**: Initial decision
