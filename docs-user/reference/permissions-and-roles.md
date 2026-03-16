# Permissions & Roles

## User roles in Axiom

Axiom uses a role-based access control model. Each user is assigned one or more roles that
determine what they can see and do in the application.

## Role definitions

| Role | Description |
| --- | --- |
| **User** | Standard access to view master data and run searches |
| **Admin** | Full access including user management, approvals, and sync triggers |

## Module access by role

| Module | User | Admin |
| --- | --- | --- |
| Dashboard | ✅ | ✅ |
| Countries | ✅ | ✅ |
| Currencies | ✅ | ✅ |
| Languages | ✅ | ✅ |
| LEI Records | ✅ | ✅ |
| SSI | ✅ | ✅ |
| Instruments | ✅ | ✅ |
| Accounts | ✅ | ✅ |
| Admin — User Approvals | ❌ | ✅ |
| Admin — Translation Review | ❌ | ✅ |
| Admin — Sync Triggers | ❌ | ✅ |

## Related pages

- [User Approvals](../admin/user-approvals) — how admins approve new users.
- [Statuses & States](./statuses-and-states) — user account status values.

> **Note:** This page is a stub. Full documentation will be added in Phase 3.
