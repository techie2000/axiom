CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE, -- noqa: RF04
    page_key VARCHAR(100) NOT NULL,
    preference_key VARCHAR(100) NOT NULL,
    preference_value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_preferences_user_page_key UNIQUE (user_id, page_key, preference_key)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences (user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_page ON user_preferences (user_id, page_key);

COMMENT ON TABLE user_preferences IS
'Stores per-user UI preferences keyed by page and preference name.
Each row holds one preference for one user on one page (e.g. column visibility,
expanded width, theme). page_key=''global'' is used for cross-page preferences
such as theme. Values are stored as plain text; JSON arrays are stored as JSON strings.';

COMMENT ON COLUMN user_preferences.id IS 'Surrogate primary key (UUID v4).';
COMMENT ON COLUMN user_preferences.user_id IS 'Foreign key to the users table.';
COMMENT ON COLUMN user_preferences.page_key IS
'Logical page identifier (e.g. ''lei-records'', ''countries'', ''global'').
Use ''global'' for preferences that apply across all pages.';
COMMENT ON COLUMN user_preferences.preference_key IS
'Name of the preference within the page (e.g. ''expanded_width'', ''visible_columns'', ''theme'').';
COMMENT ON COLUMN user_preferences.preference_value IS
'Serialised preference value. Booleans are stored as ''true''/''false'',
string arrays as JSON arrays (e.g. ''["col1","col2"]'').';
COMMENT ON COLUMN user_preferences.created_at IS 'Timestamp when this preference was first saved.';
COMMENT ON COLUMN user_preferences.updated_at IS 'Timestamp of the most recent update to this preference.';
