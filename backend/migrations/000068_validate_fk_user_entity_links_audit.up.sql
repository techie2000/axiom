DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_user_entity_links_audit_link_id'
          AND conrelid = 'user_entity_links_audit'::regclass
          AND NOT convalidated
    ) THEN
        ALTER TABLE user_entity_links_audit
        VALIDATE CONSTRAINT fk_user_entity_links_audit_link_id;
    END IF;
END$$;
