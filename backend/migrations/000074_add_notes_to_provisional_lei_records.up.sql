-- Add optional notes field for provisional LEI records stored in lei_raw.lei_records
-- This supports admin-entered notes from the provisional LEI create/edit UI.

ALTER TABLE lei_raw.lei_records
ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN lei_raw.lei_records.notes IS
'Optional free-text notes for provisional LEI records managed by admins.
Used for internal context; expected to remain NULL for GLEIF-sourced (non-provisional) records.';
