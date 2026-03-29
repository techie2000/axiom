---
post_title: "ADR-0016: Sentry for Error Tracking and Performance Monitoring"
author1: "techie2000"
post_slug: "adr-0016-sentry-error-tracking"
microsoft_alias: "techie2000"
featured_image: "https://placehold.co/1200x630.png"
categories: ["architecture"]
tags: ["adr", "architecture", "decision", "sentry", "observability", "error-tracking"]
ai_note: "AI-assisted draft based on issue investigation and repository state."
summary: "Records the decision to adopt Sentry as the error tracking and performance monitoring solution for Axiom."
post_date: "2026-03-29"
title: "ADR-0016: Sentry for Error Tracking and Performance Monitoring"
status: "Accepted"
date: "2026-03-29"
authors: "techie2000"
supersedes: ""
superseded_by: ""
---

# ADR-0016: Sentry for Error Tracking and Performance Monitoring

**Status:** Accepted
**Date:** 2026-03-29
**Decision Makers:** Engineering Team
**Context:** Axiom – Observability / Developer Experience

## Context and Problem Statement

Axiom has no automated mechanism for detecting, grouping, or alerting on runtime errors in the
Next.js frontend or the Go backend. Failures surface only through manual log inspection or user
reports, leading to delayed detection and poor mean-time-to-repair (MTTR).

The team needs an error tracking solution that:

- Captures JavaScript exceptions and Go panics automatically
- Groups related errors to eliminate noise
- Provides actionable stack traces with source context
- Integrates into the existing Docker Compose multi-environment workflow
  (dev / uat / main[^1] / prod)
- Works without exposing user PII or session data externally (financial services compliance)
- Can be disabled with zero impact when no DSN is configured (local dev and CI should not require a Sentry account)

[^1]: The `main` environment is a long-lived integration branch environment used for regression
testing before UAT promotion. It is not a standard deployment tier but is included for completeness.

## Decision Drivers

- **Observability gap**: no structured runtime error capture in frontend or backend
- **Dual-runtime requirement**: must support both Next.js (React/SSR) and Go (Gin)
- **Privacy and compliance**: financial services data; session replay and PII transmission must be opt-out
  by default
- **Opt-in design**: SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN are empty by default; Sentry is a no-op
  without them- **Self-hostability**: on-premise Sentry is available for environments where SaaS is not permitted
- **Developer experience**: must not add latency or friction to local development

## Options Considered

### Option 1: Sentry (chosen)

[sentry.io](https://sentry.io) with the official `@sentry/nextjs` (v10) and `sentry-go` (v0.44) SDKs.

**Pros:**

- Official, maintained SDKs for both Next.js and Go
- Excellent error grouping and deduplication
- Source map upload for readable production stack traces
- Can be self-hosted (Sentry Self-Hosted via Docker Compose)
- Generous free tier on sentry.io SaaS
- Session Replay is disabled by default (privacy-safe)
- Performance tracing with configurable sample rate (default 10 %)
- Zero-overhead when DSN is not set

**Cons:**

- External SaaS dependency (mitigated by self-host option)
- Source map upload requires an auth token in CI

### Option 2: LogRocket

Session recording and error replay platform.

**Pros:**

- Rich session context for debugging UI issues

**Cons:**

- Frontend-only; no Go SDK
- Session recording raises PII and financial data compliance concerns
- Significantly more expensive
- Not self-hostable

### Option 3: Datadog APM

Full observability platform with APM, logs, and traces.

**Pros:**

- Unified observability (traces, logs, metrics, errors)
- Strong enterprise support

**Cons:**

- High cost at scale; pricing per host
- Heavier agent footprint
- Significant operational overhead compared to targeted error tracking

### Option 4: Rollbar

**Pros:**

- Supports JavaScript and Go
- Similar feature set to Sentry

**Cons:**

- Smaller community; fewer Next.js-specific integrations
- Not self-hostable
- Less active open-source SDK development

### Option 5: No dedicated error tracking (status quo)

**Cons:**

- Errors surface only through manual log inspection or user reports
- High MTTR and poor developer experience

## Decision Outcome

**Chosen Option:** Sentry (Option 1)

### Rationale

Sentry is the only candidate that satisfies all constraints simultaneously: dual-runtime SDK
coverage (Next.js + Go), self-hostability, privacy-safe defaults, and zero-configuration opt-out.
The lightweight integration adds no overhead when `SENTRY_DSN` is empty, preserving the frictionless
local development experience.

### Trade-offs Accepted

- Source map upload to Sentry SaaS requires `SENTRY_AUTH_TOKEN` in CI secrets (acceptable; scoped
  per-project token with upload-only permissions)
- Session Replay is intentionally disabled; enabling it in the future requires a data-privacy review

## Implementation

### Backend (Go / Gin)

- Dependency: `github.com/getsentry/sentry-go v0.44.1`
- Dependency: `github.com/getsentry/sentry-go/gin v0.44.1`
- Initialisation in `backend/cmd/api/main.go` via `initSentry()` (no-op when DSN is empty)
- Gin middleware `sentrygin.New()` added to the global middleware stack when DSN is set
- Configuration via `SentryConfig` struct in `backend/internal/config/config.go`

Environment variables consumed by the backend:

| Variable | Description | Default |
| --- | --- | --- |
| `SENTRY_DSN` | Backend project DSN | `` (disabled) |
| `SENTRY_ENVIRONMENT` | Environment label (dev/uat/prod) | Falls back to `ENVIRONMENT` |
| `SENTRY_SAMPLERATE` | Traces sample rate 0.0–1.0 | `0.1` |

### Frontend (Next.js)

- Dependency: `@sentry/nextjs@10.46.0`
- Sentry config files: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- Next.js instrumentation hook: `instrumentation.ts`
- `next.config.js` wrapped with `withSentryConfig` only when `NEXT_PUBLIC_SENTRY_DSN` is set
- Session Replay sample rate: `0` (disabled)
- PII transmission: disabled (`sendDefaultPii: false`)
- Source map upload: enabled when `SENTRY_AUTH_TOKEN` is present in the build environment

Environment variables consumed by the frontend:

| Variable | Description | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_SENTRY_DSN` | Frontend project DSN | `` (disabled) |
| `SENTRY_AUTH_TOKEN` | Source map upload token (CI only) | `` |
| `SENTRY_ORG` | Sentry organisation slug | `` |
| `SENTRY_PROJECT` | Sentry project slug | `axiom-frontend` |

### Activating Sentry

1. Create two Sentry projects: `axiom-backend` and `axiom-frontend` on sentry.io or your
   self-hosted instance.
2. Copy the project DSNs into the appropriate `.env.*` file for each environment:

   ```bash
   SENTRY_DSN=https://<key>@<host>/<backend-project-id>
   NEXT_PUBLIC_SENTRY_DSN=https://<key>@<host>/<frontend-project-id>
   ```

3. For production source map upload, add `SENTRY_AUTH_TOKEN` to CI secrets.

## Consequences

### Positive

- Runtime errors are automatically captured, grouped, and linked to source code
- Performance bottlenecks become measurable via transaction traces
- MTTR decreases through automated alerts rather than manual log inspection
- Dev environments are unaffected; Sentry only activates when DSN is provided

### Negative

- CI builds that set `SENTRY_AUTH_TOKEN` will upload source maps (network egress, ~seconds overhead)
- Frontend bundle size increases slightly (Sentry SDK adds ~40 kB gzip); mitigated by tree-shaking

### Mitigation

- Source map upload is conditional on `SENTRY_AUTH_TOKEN`; omitting the token skips upload silently
- Sentry's `disableLogger: true` option tree-shakes SDK log statements from the production bundle

## References

- [Sentry Next.js SDK](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Go SDK](https://docs.sentry.io/platforms/go/)
- [Sentry Self-Hosted](https://develop.sentry.dev/self-hosted/)
- [GitHub Advisory: no vulnerabilities found in @sentry/nextjs@10.46.0 or sentry-go@v0.44.1]
- [sentry-go/gin middleware](https://pkg.go.dev/github.com/getsentry/sentry-go/gin)

## Revision History

- **2026-03-29:** Initial decision record
