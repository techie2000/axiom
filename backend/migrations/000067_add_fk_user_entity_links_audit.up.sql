DO $$
DECLARE
    orphan_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO orphan_count
    FROM user_entity_links_audit a
    LEFT JOIN user_entity_links l ON l.id = a.user_entity_link_id
    WHERE l.id IS NULL;

    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'Cannot add fk_user_entity_links_audit_link_id: found % orphan audit rows', orphan_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_user_entity_links_audit_link_id'
          AND conrelid = 'user_entity_links_audit'::regclass
    ) THEN
        ALTER TABLE user_entity_links_audit
        ADD CONSTRAINT fk_user_entity_links_audit_link_id
        FOREIGN KEY (user_entity_link_id)
        REFERENCES user_entity_links (id)
        ON DELETE RESTRICT
        NOT VALID;
    END IF;
END$$;

COMMENT ON COLUMN user_entity_links_audit.user_entity_link_id IS
'Foreign key to user_entity_links.id. ON DELETE RESTRICT preserves audit integrity.';
