# ADR-0011: Per-User UI Preferences Persisted to Database

**Status:** Accepted
**Date:** 2026-03-04
**Decision Makers:** Engineering Team
**Context:** Axiom Frontend / UX

## Context and Problem Statement

Since ADR-0010 introduced user authentication, Axiom has a stable user identity. Users now interact
with wide data tables that support configurable column visibility, expandable/normal page width, and
light/dark theme. Without a persistence mechanism these preferences reset on every page load,
forcing users to re-configure views on each session and on each device they use.

## Decision Drivers

- Preferences must survive page reloads, browser restarts, and cross-device access.
- The change must be unobtrusive — users should not be interrupted while working; saving a
  preference is optional and prompt-driven.
- The implementation must integrate cleanly with the existing JWT authentication system.
- The backend schema must be generic enough to store any future page-level preference without a
  new migration.
- Unauthenticated users (or users not yet logged in) must still get a working UI via
  `localStorage` fallback.

## Options Considered

### Option 1: localStorage only

**Pros:**

- Zero backend changes.
- No network round-trips.

**Cons:**

- Preferences are device-scoped and lost when browser storage is cleared.
- Does not satisfy the cross-device requirement stated in the issue.

### Option 2: User-settings JSON blob in the `users` table

**Pros:**

- Single DB row per user.

**Cons:**

- Merge conflicts when multiple tabs save simultaneously.
- No partial-update API — every write serialises the full blob.
- Schema-less; hard to query or migrate individual preferences.

### Option 3: Normalised `user_preferences` table (chosen)

**Pros:**

- Each preference is an independent, addressable row; partial updates are atomic.
- Simple `UPSERT` semantics via unique constraint on `(user_id, page_key, preference_key)`.
- New preferences require no migration — just a new `page_key`/`preference_key` combination.
- Queryable and auditable.

**Cons:**

- Extra DB round-trip on session start (one `GET /api/v1/preferences` per login).
- Slightly more complex frontend hook compared to bare `localStorage`.

## Decision Outcome

**Chosen Option:** Option 3 – normalised `user_preferences` table.

### Rationale

The normalised table satisfies all decision drivers. The one-time load cost on session start is
acceptable and is mitigated by the module-level in-memory cache shared across all hook instances.
The generic `(page_key, preference_key, preference_value TEXT)` schema is future-proof without
further migrations.

### Trade-offs Accepted

- A single HTTP call is made at session start; this is cached for the entire browser session.
- Server errors during preference saves are swallowed silently; `localStorage` provides an
  immediate local fallback so the UI is never blocked.

## Consequences

### Positive

- Users enjoy consistent views across all devices and sessions.
- Adding a new preference on any page requires only two lines of frontend code.
- No schema change is required when a new preference type is introduced.

### Negative

- If the backend is unavailable at login, the user's stored preferences will not load (they will
  still get `localStorage`-cached values from the last successful session).
- The `preference_value TEXT` column requires the application layer to serialise/deserialise
  typed values (booleans as `'true'/'false'`, arrays as JSON strings).

### Mitigation

- `localStorage` is always written alongside every preference change, so offline UX degrades
  gracefully.
- The hook's `defaultValue` parameter ensures pages render correctly even before the initial
  server load completes.

## Implementation

### Database

Migration `000041_add_user_preferences_table`:

```sql
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    page_key VARCHAR(100) NOT NULL,
    preference_key VARCHAR(100) NOT NULL,
    preference_value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_preferences_user_page_key
        UNIQUE (user_id, page_key, preference_key)
);
```

`page_key` conventions:

| Value | Meaning |
| ----- | ------- |
| `global` | Cross-page preferences (e.g. `theme`) |
| `lei-records` | LEI Records page |
| `countries` | Countries page |
| `currencies` | Currencies page |
| `languages` | Languages page |

### REST API

All routes are behind `JWTAuth` middleware.

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/api/v1/preferences` | Return all preferences (optionally `?page_key=`) |
| `PUT` | `/api/v1/preferences` | Upsert one preference |
| `DELETE` | `/api/v1/preferences` | Delete one preference (`?page_key=&preference_key=`) |

### Frontend Hook

```tsx
import { useUserPreference } from '../lib/useUserPreference'

// Returns [currentValue, setValue, isLoading]
const [storedTheme, setStoredTheme] = useUserPreference('global', 'theme', 'dark')
```

See [ui-patterns.md](../ui-patterns.md#user-preferences) for the full usage guide and the
step-by-step integration checklist for new pages.

## References

- [ADR-0010: User Auth and Registration](./adr-0010-user-auth-registration-system.md)
- [ui-patterns.md – User Preferences section](../ui-patterns.md#user-preferences)
- [useUserPreference hook](../../frontend/app/lib/useUserPreference.ts)
- [PreferenceSavePrompt component](../../frontend/app/components/PreferenceSavePrompt.tsx)
- GitHub Issue: [[feature] user preferences](https://github.com/techie2000/axiom/issues/108)
- GitHub Issue: [[enhancement] undo accidental preference save + audit trail](https://github.com/techie2000/axiom/issues/122)

## Revision History

- **2026-03-04:** Initial decision
- **2026-03-13:** Added undo capability and server-side audit trail (see amendment below)

---

## Amendment: Preference Undo and Audit Trail

**Status:** Accepted
**Date:** 2026-03-13

### Context

After the initial delivery (migration 000042, `useUserPreference`, `PreferenceSavePrompt`),
two gaps were identified:

1. **No recovery path** – a user who accidentally clicks "Save" must manually reconfigure their
   columns or other preferences; there is no in-app undo.
2. **No audit trail** – there is no record of what preference value was replaced, when, or from
   which IP, which is needed for debugging and future compliance requirements.

### Solution

#### 1. Undo (frontend)

`useDeferredBooleanPreference` and `useDeferredStringPreference` now capture the previous
persisted value in a ref (`previousValue`) immediately before calling `setStoredValue`. After a
successful save they expose:

| Return field | Type | Description |
| ------------ | ---- | ----------- |
| `showUndo` | `boolean` | `true` for up to 15 s after a save |
| `undoResetKey` | `number` | Incremented on each save; resets the undo timer |
| `undo()` | `() => void` | Restores the previous value and hides the undo toast |
| `undoDismiss()` | `() => void` | Hides the undo toast without reverting |

`PreferenceSavePrompt` gained optional `showUndo`, `undoResetKey`, `onUndo`, `onUndoDismiss`,
and `undoLabel` props. When `showUndo` is `true` and `visible` is `false`, the component renders
an amber "Undo" toast that auto-dismisses after 15 seconds. All pages that use
`PreferenceSavePrompt` have been updated to wire these props.

Pages with Set-based column preferences (countries, LEI Records) use local refs (`previousColumns`)
following the same pattern.

#### 2. Audit trail (backend)

Migration `000047_add_preference_audit_table` adds a `user_preferences_audit` table:

```sql
CREATE TABLE IF NOT EXISTS user_preferences_audit (
    id            UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    user_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    page_key      VARCHAR(100) NOT NULL,
    preference_key VARCHAR(100) NOT NULL,
    old_value     TEXT,
    new_value     TEXT NOT NULL,
    changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address    VARCHAR(45)
);
```

`old_value` is `NULL` when the preference did not previously exist. `ip_address` captures the
HTTP client IP from the gin context. All columns have `COMMENT ON` documentation.

`UserPreferenceService.Set` was extended to accept an `ipAddress string` parameter. Before
upserting, it reads the current value via the new `UserPreferenceRepository.GetOne` method.
After a successful upsert, it writes an audit row via `PreferenceAuditRepository.Record`. Audit
errors are swallowed (best-effort) so that a transient write failure never degrades the
preference save response to the user.

### Generalisation note

The `user_preferences_audit` table design is intentionally generic. Future entity mutation audit tables
(e.g. `lei_record_audit`, `user_profile_audit`) should follow the same append-only, insert-only
pattern with `old_value` / `new_value` columns and a DB-clock `changed_at` timestamp.
