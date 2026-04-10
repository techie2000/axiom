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

## What users can do

Standard users (the **User** role) can:

- View and search all master data modules they have access to.
- Customise column visibility and page-width preferences.
- Switch the display language.
- Toggle light and dark mode.
- Submit translations for review (where the translation feature is available).

Standard users **cannot**:

- Approve or reject new user registrations.
- Review or approve translation submissions.
- Trigger manual data synchronisation.

## What admins can do

Admin users have all **User** permissions plus:

- Approve or reject new user registration requests.
- Review, approve, and reject translation submissions.
- Trigger manual LEI and master data synchronisation.
- View all users regardless of status.

## Requesting a role change

Role changes must be requested through your Axiom administrator. Admins can update a user's role
from the Admin section of the application.

## Related pages

- [User Approvals](../admin/user-approvals) — how admins approve new users.
- [Statuses & States](./statuses-and-states) — user account status values.
