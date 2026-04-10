# User Approvals

## Goal

Review and approve (or reject) new user registration requests in Axiom.

## Prerequisites

- You are signed in to Axiom with the **Admin** role.

## Background

When a new user registers for an Axiom account, their account is created in **Pending Approval**
status. An admin user must approve the account before the user can sign in. This ensures that only
authorised individuals gain access to the platform.

## Steps

### View pending approvals

1. Click **Admin** in the top navigation.
2. Select **User Approvals** from the admin menu.
3. The page shows a list of users with **Pending Approval** status.
4. Each row shows the user's name, email address, and registration date.

### Approve a user

1. On the User Approvals page, locate the user you want to approve.
2. Click **Approve** for that user.
3. A confirmation prompt appears. Click **Confirm** to proceed.
4. The user's status changes to **Active** and they receive a notification that their account is
   now accessible.

### Reject a user

1. On the User Approvals page, locate the user you want to reject.
2. Click **Reject** for that user.
3. A confirmation prompt appears. Click **Confirm** to proceed.
4. The user's account is marked as **Rejected**. They will not be able to sign in.

### View all users

To see all users regardless of status (Active, Pending, Rejected):

1. In the Admin section, navigate to **Users**.
2. Use the **Status** filter to switch between views.

## Expected result

Approved users can sign in to Axiom. Rejected users cannot access the platform.

## Common issues

| Issue | Possible cause | Resolution |
| --- | --- | --- |
| No pending approvals listed | No users are awaiting approval | Check if new registrations have been received |
| Cannot approve a user | Your session may have expired | Refresh the page and sign in again |
| User did not receive a notification | Email delivery issue | Ask the user to check their spam folder |

## Related tasks

- [Sign In & Access](../getting-started/sign-in-and-access) — the registration process users follow.
- [Translation Review](./translation-review) — another admin workflow.
