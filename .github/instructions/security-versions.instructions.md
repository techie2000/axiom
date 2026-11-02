---
description: >
  Requires any PR that bumps a version tracked in .github/security-versions.yml
  (go_modules or nodejs_packages) to update that entry (version + updated date)
  in the same PR, so the tracking file doesn't drift from reality.
applyTo: 'backend/go.mod,backend/go.sum,frontend/package.json,frontend/package-lock.json,.github/security-versions.yml'
---

# Security Versions Tracking Parity

## Rule

If a PR changes the resolved version of a dependency that has an entry in
`.github/security-versions.yml` (under `go_modules.direct_dependencies`,
`go_modules.indirect_dependencies`, or `nodejs_packages.dependencies` /
`nodejs_packages.dev_dependencies`), the PR **must update that entry in the same
commit/PR**:

- `version` — set to the new resolved version
- `updated` — set to the date of the commit that actually changed the version
  (not the date of some later, unrelated audit)

This applies whether the bump comes from a manual `go get` / `npm install`, a
Dependabot PR, or the weekly security scan workflow.

## Rationale

Entries in `security-versions.yml` get updated piecemeal whenever a specific PR
happens to touch them, but nothing re-audits the rest of the file. Over time this
lets tracked versions silently drift from what's actually in `go.mod` / `go.sum` /
`package.json`, and `last_updated` timestamps become misleading — they record when
the file was last *touched*, not when each entry was last *true*. See #686, #687,
and #689 for cases of this drift, and #688 for the audit that fixed it.

## Checklist (apply when reviewing a dependency-bump PR)

- [ ] If the PR bumps a Go module listed in `go_modules`, its entry's `version` and
  `updated` fields are updated to match
- [ ] If the PR bumps an npm package listed in `nodejs_packages`, its entry's
  `version` and `updated` fields are updated to match
- [ ] `updated` reflects the actual bump commit's date, not the PR review/merge date
- [ ] If the PR bumps a dependency NOT listed in `security-versions.yml`, no action
  is needed — the file only tracks the subset called out as security-relevant

## Out of scope

Dependencies not already tracked in `security-versions.yml` don't need a new entry
added just because they were bumped — only keep existing entries accurate. Adding
new entries (e.g. for a newly security-relevant package) is a separate, deliberate
decision, not an automatic consequence of a version bump.
