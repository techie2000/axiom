ALTER TABLE lei_raw.file_processing_status
ADD COLUMN IF NOT EXISTS progress_message TEXT;

COMMENT ON COLUMN lei_raw.file_processing_status.progress_message IS
'Optional in-flight progress text for UI visibility during RUNNING state (e.g., downloading/extracting/processing). Cleared on success/failure completion.';
