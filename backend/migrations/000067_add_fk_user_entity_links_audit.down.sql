ALTER TABLE IF EXISTS user_entity_links_audit
DROP CONSTRAINT IF EXISTS fk_user_entity_links_audit_link_id;

COMMENT ON COLUMN user_entity_links_audit.user_entity_link_id IS
'References user_entity_links.id in application logic (no DB foreign key constraint).';
