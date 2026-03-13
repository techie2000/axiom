CREATE TABLE IF NOT EXISTS user_preferences_audit (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    page_key VARCHAR(100) NOT NULL,
    preference_key VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_audit_user_id ON user_preferences_audit (user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_audit_user_page ON user_preferences_audit (user_id, page_key);
CREATE INDEX IF NOT EXISTS idx_user_preferences_audit_changed_at ON user_preferences_audit (changed_at DESC);

COMMENT ON TABLE user_preferences_audit IS
'Append-only audit log for every preference upsert. One row is written for each
successful call to PUT /api/v1/preferences. old_value is NULL when the preference
did not previously exist (i.e. first-time save). The table is intentionally
insert-only; rows are never updated or deleted, giving a full immutable history.
This design is generalizable: future entity mutations (LEI records, users, etc.)
can follow the same pattern with entity-specific audit tables.';

COMMENT ON COLUMN user_preferences_audit.id IS 'Surrogate primary key (UUID v4).';
COMMENT ON COLUMN user_preferences_audit.user_id IS
'Foreign key to the users table. ON DELETE CASCADE ensures audit rows are removed
when the user account is permanently deleted (GDPR right-to-erasure compliance).';
COMMENT ON COLUMN user_preferences_audit.page_key IS
'Logical page identifier matching user_preferences.page_key
(e.g. ''lei-records'', ''countries'', ''global'').';
COMMENT ON COLUMN user_preferences_audit.preference_key IS
'Preference name within the page matching user_preferences.preference_key
(e.g. ''expanded_width'', ''visible_columns'', ''theme'').';
COMMENT ON COLUMN user_preferences_audit.old_value IS
'Serialised preference value before the change. NULL when the preference row
did not exist prior to this write (i.e. first save of this preference).';
COMMENT ON COLUMN user_preferences_audit.new_value IS
'Serialised preference value after the change. Booleans stored as
''true''/''false''; column arrays stored as JSON strings.';
COMMENT ON COLUMN user_preferences_audit.changed_at IS
'Database timestamp at which the change was committed. Uses the DB clock
(NOW()) rather than the application clock to avoid client-clock skew.';
COMMENT ON COLUMN user_preferences_audit.ip_address IS
'IPv4 or IPv6 address of the HTTP client that triggered the change.
NULL when the IP could not be determined (e.g. local/internal calls).
Maximum 45 characters covers full IPv6 notation.';
