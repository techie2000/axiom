ALTER TABLE IF EXISTS user_entity_links_audit
DROP CONSTRAINT IF EXISTS fk_user_entity_links_audit_link_id;

COMMENT ON COLUMN user_entity_links_audit.user_entity_link_id IS
'Foreign key to user_entity_links.id.';
