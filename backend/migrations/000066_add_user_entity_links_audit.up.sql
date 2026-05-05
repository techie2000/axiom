CREATE TABLE IF NOT EXISTS user_entity_links_audit (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    user_entity_link_id UUID NOT NULL,
    "action" VARCHAR(20) NOT NULL,  -- CREATE, UPDATE, DELETE
    record_snapshot JSONB NOT NULL,
    changed_fields JSONB,
    changed_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_entity_links_audit_link_id ON user_entity_links_audit (user_entity_link_id);
CREATE INDEX IF NOT EXISTS idx_user_entity_links_audit_action ON user_entity_links_audit ("action");
CREATE INDEX IF NOT EXISTS idx_user_entity_links_audit_created_at ON user_entity_links_audit (created_at);

COMMENT ON TABLE user_entity_links_audit IS
'Audit log for user-entity link lifecycle events: grant (CREATE), update (UPDATE), revoke (DELETE).
Tracks who made changes, when, and what changed.';
COMMENT ON COLUMN user_entity_links_audit.id IS 'Surrogate primary key (UUID v4).';
COMMENT ON COLUMN user_entity_links_audit.user_entity_link_id IS 'References user_entity_links.id in application logic (no DB foreign key constraint).';
COMMENT ON COLUMN user_entity_links_audit."action" IS 'Type of change: CREATE (granted), UPDATE (role/scope/expiry changed), DELETE (revoked/unrevoked).';
COMMENT ON COLUMN user_entity_links_audit.record_snapshot IS 'Full snapshot of the user_entity_links row after the action.';
COMMENT ON COLUMN user_entity_links_audit.changed_fields IS 'JSON object showing which fields changed and their before/after values (null for CREATE).';
COMMENT ON COLUMN user_entity_links_audit.changed_by IS 'Admin username or system identifier who triggered the change.';
COMMENT ON COLUMN user_entity_links_audit.created_at IS 'Timestamp of the audit record creation.';
