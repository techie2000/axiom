---
post_title: "ADR-0010: User Authentication and Registration System"
author1: "techie2000"
post_slug: "adr-0010-user-auth-registration-system"
microsoft_alias: "techie2000"
featured_image: "https://placehold.co/1200x630.png"
categories: ["backend", "security"]
tags: ["adr", "backend", "security", "authentication", "jwt", "user-management"]
ai_note: "AI-assisted draft based on repository state and user request."
summary: "Records the decision to implement a self-registration flow with admin approval, JWT issuance, and a bootstrap admin seed for the Axiom financial services static data management system."
post_date: "2026-03-02"
title: "ADR-0010: User Authentication and Registration System"
status: "Accepted"
date: "2026-03-02"
authors: "techie2000"
supersedes: ""
superseded_by: ""
---

## Status

Accepted

## Context

Axiom manages sensitive financial reference data (instruments, SSIs, entities, LEI records). Certain pages
and API routes were already designated as restricted, but no authentication or user-provisioning mechanism
existed. Without access control, any network-reachable client could read or modify production data.

The system needed:

- A way for users to request access without requiring an administrator to create every account manually.
- An approval gate so that only vetted users can reach protected data.
- A stateless token mechanism compatible with the existing Go/Gin backend and horizontally scalable
  deployment model described in [ADR-0001](adr-0001-modular-monolith-architecture.md).
- A zero-day operational path—at least one admin account must exist before any approval can happen, even
  on a fresh database.
- A clear migration path toward enterprise identity providers (LDAP, SAML, OAuth/OIDC) as the product matures.

## Decision Drivers

- **DRV-001**: The backend is Go/Gin; authentication must integrate without replacing the existing
  middleware chain.
- **DRV-002**: No external identity service dependency is acceptable for MVP; all auth state must live in
  the existing PostgreSQL database.
- **DRV-003**: The approval workflow must be enforceable server-side; frontend gating alone is
  insufficient for a financial services application.
- **DRV-004**: A fresh environment must be operational without manual database intervention.
- **DRV-005**: The implementation must be replaceable or extensible toward enterprise SSO without a
  full rewrite.

## Decision

Implement a custom user authentication and registration system comprising:

1. **Self-registration** – Users submit email, username, password, and optional full name via
   `POST /api/v1/auth/register`. Accounts are created with `status = pending`; no session or token is
   issued at this point.

2. **Admin approval workflow** – Administrators list pending accounts via `GET /api/v1/auth/users` and
   approve (`POST /api/v1/auth/users/:id/approve`) or reject (`POST /api/v1/auth/users/:id/reject`) them.
   Only users with `status = active` can authenticate. All user-management routes are protected by
   `JWTAuth` + `AdminRequired` middleware enforced server-side.

3. **JWT issuance** – On successful `POST /api/v1/auth/login`, a signed HS256 JWT is returned containing
   claims `user_id`, `email`, `username`, and `role`. The token is validated by the `JWTAuth` middleware
   for every protected route.

4. **Bootstrap admin** – Database migration `000040_add_users_table.up.sql` seeds a single admin record
   (`admin@axiom.local` / `Admin1234!`, bcrypt cost 12) with `is_bootstrap = TRUE` and a fixed UUID
   (`00000000-0000-0000-0000-000000000001`). On login, `is_bootstrap = true` is surfaced in the login
   response so the frontend can prompt the operator to approve a real admin and deactivate the seed
   account. The intended handover sequence is: login with bootstrap → approve a real admin account →
   real admin deactivates the bootstrap account.

5. **Password hashing** – bcrypt with cost factor 12 via `golang.org/x/crypto/bcrypt`.

6. **Token storage (MVP tradeoff)** – The frontend stores the JWT in `localStorage`. This is accepted
   as a pragmatic MVP choice with a documented migration to `httpOnly` cookies as a future hardening step.

7. **Libraries** – `github.com/golang-jwt/jwt/v5` for token creation and validation;
   `golang.org/x/crypto/bcrypt` for password hashing.

## Decision Outcome

**Chosen Option:** Custom JWT authentication with self-registration and admin approval workflow.

## Consequences

### Positive

- **POS-001**: No runtime dependency on an external identity service; the system operates fully
  air-gapped and is resilient to third-party outages.
- **POS-002**: Admin approval gate prevents unauthorised access to financial reference data even when
  the registration endpoint is publicly reachable.
- **POS-003**: Stateless JWTs are compatible with horizontal scaling of the backend API as described
  in [ADR-0001](adr-0001-modular-monolith-architecture.md).
- **POS-004**: The bootstrap admin migration ensures zero-day operability on fresh environments without
  manual database intervention.
- **POS-005**: The `is_bootstrap` flag enables a guided handover UX, reducing the risk of the seed
  account remaining permanently active.

### Negative

- **NEG-001**: JWT storage in `localStorage` exposes tokens to cross-site scripting (XSS) attacks;
  migration to `httpOnly` cookies is deferred to a future hardening iteration.
- **NEG-002**: Issued JWTs cannot be individually revoked without a server-side deny list; a compromised
  token remains valid until it expires.
- **NEG-003**: The bootstrap admin credentials are committed to a migration file in source control and
  must be treated as publicly known; operators must deactivate this account before any production
  deployment.
- **NEG-004**: Roles are coarse-grained (`admin` / `user`) and do not support fine-grained permissions
  or group assignments in the MVP; this limits access-control flexibility.
- **NEG-005**: LDAP, SAML, and OAuth/OIDC integration are not implemented; federated identity requires
  future architectural work.

### Mitigation

- **MIT-001**: Document the `localStorage` risk and prioritise migration to `httpOnly` session cookies
  or a BFF (Backend-for-Frontend) token relay in the next security hardening sprint.
- **MIT-002**: Set a short JWT expiry (configured via `JWT_EXPIRY` environment variable) to limit the
  window of a compromised token.
- **MIT-003**: Add a prominent operational runbook step to deactivate `admin@axiom.local` immediately
  after the first real admin account is confirmed active.
- **MIT-004**: Plan role/group assignment features and finer-grained permissions as a follow-on ADR
  once access patterns are better understood.

## Alternatives Considered

### OAuth2 / OpenID Connect (e.g., Auth0, Keycloak)

- **ALT-001**: **Description**: Delegate authentication entirely to an external identity provider using
  OAuth2 authorisation code flow with OIDC claims. The backend becomes a resource server validating
  access tokens issued by the IdP.
- **ALT-002**: **Rejection Reason**: Introduces a hard runtime dependency on an external service.
  Adds operational complexity (self-hosted Keycloak) or a SaaS cost (Auth0) that is disproportionate
  for an MVP. Chosen approach preserves a migration path to OIDC without requiring it now.

### Server-Side Session Authentication

- **ALT-003**: **Description**: Issue an opaque session ID stored in a server-side session store
  (e.g., Redis or PostgreSQL) and returned to the browser as an `httpOnly` cookie.
- **ALT-004**: **Rejection Reason**: Requires shared session storage across API instances, adding
  an infrastructure dependency. JWTs, combined with a short expiry, achieve comparable security for the
  MVP scale without the extra component. Cookie-based storage remains a recommended future hardening
  step regardless of session vs. JWT.

### Defer Authentication Entirely

- **ALT-005**: **Description**: Treat all pages as public and add no access control in this iteration.
- **ALT-006**: **Rejection Reason**: Not viable. Pages were already designated as restricted in the
  product requirements. Leaving financial reference data unprotected on a network-reachable service
  would violate basic security expectations for a financial services application.

## Implementation Notes

- **IMP-001**: User domain model and role/status enumerations are defined in
  [backend/internal/domain/models.go](../../backend/internal/domain/models.go). The `User` struct
  carries `Role` (`admin` | `user`), `Status` (`pending` | `active` | `inactive`), `ApprovedBy`,
  `ApprovedAt`, and `IsBootstrap` fields.
- **IMP-002**: All authentication business logic (registration, login, approval, rejection, token
  generation) lives in
  [backend/internal/service/auth_service.go](../../backend/internal/service/auth_service.go).
  Login returns a generic `"invalid credentials"` error for both unknown email and wrong password to
  prevent user enumeration.
- **IMP-003**: JWT validation and role enforcement are handled in
  [backend/internal/middleware/middleware.go](../../backend/internal/middleware/middleware.go) via the
  `JWTAuth` and `AdminRequired` middleware functions. `JWTAuth` explicitly validates the signing
  algorithm (`HS256`) to prevent algorithm-confusion attacks.
- **IMP-004**: HTTP handlers are in
  [backend/internal/handler/handler.go](../../backend/internal/handler/handler.go). Public routes
  (`/api/v1/auth/login`, `/api/v1/auth/register`) require no token. User-management routes
  (`GET /api/v1/auth/users`, `POST /api/v1/auth/users/:id/approve`,
  `POST /api/v1/auth/users/:id/reject`) are protected by `JWTAuth` + `AdminRequired`.
- **IMP-005**: The bootstrap admin is seeded via
  [backend/migrations/000040_add_users_table.up.sql](../../backend/migrations/000040_add_users_table.up.sql)
  using `ON CONFLICT (id) DO NOTHING` so re-running migrations is idempotent. The fixed UUID is
  `00000000-0000-0000-0000-000000000001`.
- **IMP-006**: Frontend pages for registration (`/register`), login (`/login`), and admin user
  management (`/admin/users`) are implemented in Next.js under
  [frontend/app/register/page.tsx](../../frontend/app/register/page.tsx),
  [frontend/app/login/page.tsx](../../frontend/app/login/page.tsx), and
  [frontend/app/admin/users/page.tsx](../../frontend/app/admin/users/page.tsx) respectively.
- **IMP-007**: Operational runbook for bootstrap handover:
  1. Deploy the application (migration seeds `admin@axiom.local`).
  2. Log in with `admin@axiom.local` / `Admin1234!`.
  3. A real administrator self-registers and the bootstrap admin approves the account.
  4. The real admin logs in and sets the bootstrap account to `inactive` via the user-management UI.
  5. Confirm no further login is possible with `admin@axiom.local`.
- **IMP-008**: Success criteria — no user can access protected API routes without a valid JWT issued
  to an `active` account; `pending` and `inactive` users receive `401 Unauthorized` on login;
  non-admin users receive `403 Forbidden` on user-management endpoints.

## References

- **REF-001**: [adr-0004-jwt-authentication.md](adr-0004-jwt-authentication.md) — parent ADR
  establishing JWT as the API authentication mechanism; this ADR provides the full user-lifecycle
  implementation detail.
- **REF-002**: [adr-0001-modular-monolith-architecture.md](adr-0001-modular-monolith-architecture.md) — architectural
  context for the layered service/handler/repository structure used here.
- **REF-003**: [adr-0003-postgres-gorm.md](adr-0003-postgres-gorm.md) — database and ORM decisions
  underpinning the `users` table and migration approach.
- **REF-004**: [backend/internal/service/auth_service.go](../../backend/internal/service/auth_service.go)
- **REF-005**: [backend/internal/middleware/middleware.go](../../backend/internal/middleware/middleware.go)
- **REF-006**: [backend/migrations/000040_add_users_table.up.sql](../../backend/migrations/000040_add_users_table.up.sql)
- **REF-007**: golang-jwt/jwt v5 — https://github.com/golang-jwt/jwt
- **REF-008**: golang.org/x/crypto/bcrypt — https://pkg.go.dev/golang.org/x/crypto/bcrypt
