CREATE TABLE IF NOT EXISTS user_entity_links (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    user_id UUID NOT NULL REFERENCES users (id), -- noqa: RF04
    lei VARCHAR(20) NOT NULL,
    entity_role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    include_children BOOLEAN NOT NULL DEFAULT FALSE,
    granted_by UUID NOT NULL REFERENCES users (id), -- noqa: RF04
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_entity_links_user_lei
ON user_entity_links (user_id, lei)
WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_entity_links_user_id ON user_entity_links (user_id);
CREATE INDEX IF NOT EXISTS idx_user_entity_links_lei ON user_entity_links (lei);
CREATE INDEX IF NOT EXISTS idx_user_entity_links_entity_role ON user_entity_links (entity_role);
CREATE INDEX IF NOT EXISTS idx_user_entity_links_revoked_at ON user_entity_links (revoked_at);
CREATE INDEX IF NOT EXISTS idx_user_entity_links_expires_at ON user_entity_links (expires_at)
WHERE expires_at IS NOT NULL;

COMMENT ON TABLE user_entity_links IS
'Links a system user to one or more LEI entities (official or provisional) as the basis
for entity-scoped access control. Each row grants a user a named role on a specific LEI
entity, optionally cascading to its Level 2 children. Rows are soft-revoked via
revoked_at rather than deleted, to preserve the audit trail.';

COMMENT ON COLUMN user_entity_links.id IS 'Surrogate primary key (UUID v4).';
COMMENT ON COLUMN user_entity_links.user_id IS 'The user being linked to the entity.';
COMMENT ON COLUMN user_entity_links.lei IS
'20-character LEI code of the entity (ISO 17442). May reference an official GLEIF record
or an Axiom-issued provisional record (AXIO prefix). Not a hard FK because provisional
records live in the same table as official records and succession chains must remain navigable.';
COMMENT ON COLUMN user_entity_links.entity_role IS
'Role the user holds for this entity: viewer (read-only), trader (read + trade instructions),
entity_admin (can manage other users links to this entity).';
COMMENT ON COLUMN user_entity_links.include_children IS
'When TRUE, the role cascades to all Level 2 child entities in the LEI relationship hierarchy.
Requires Level 2 data to be populated for the entity.';
COMMENT ON COLUMN user_entity_links.granted_by IS 'UUID of the admin who created this link.';
COMMENT ON COLUMN user_entity_links.granted_at IS 'Timestamp when the link was granted.';
COMMENT ON COLUMN user_entity_links.expires_at IS
'Optional expiry timestamp. NULL means the link does not expire. When NOW() > expires_at the
link is treated as inactive even if revoked_at is NULL.';
COMMENT ON COLUMN user_entity_links.revoked_at IS
'Soft-revoke timestamp. NULL means the link is active. Set by an admin to deactivate the link
without deleting the history.';
COMMENT ON COLUMN user_entity_links.notes IS 'Optional free-text notes added by the admin.';
COMMENT ON COLUMN user_entity_links.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN user_entity_links.updated_at IS 'Timestamp of the last update to this row.';
