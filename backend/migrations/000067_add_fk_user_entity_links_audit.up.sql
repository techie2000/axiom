DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_user_entity_links_audit_link_id'
    ) THEN
        ALTER TABLE user_entity_links_audit
        ADD CONSTRAINT fk_user_entity_links_audit_link_id
        FOREIGN KEY (user_entity_link_id)
        REFERENCES user_entity_links (id)
        ON DELETE RESTRICT;
    END IF;
END$$;

COMMENT ON COLUMN user_entity_links_audit.user_entity_link_id IS
'Foreign key to user_entity_links.id. ON DELETE RESTRICT preserves audit integrity.';
