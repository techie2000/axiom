ALTER TABLE user_entity_links
ADD COLUMN IF NOT EXISTS children_scope VARCHAR(10) NOT NULL DEFAULT 'none'
    CHECK (children_scope IN ('none', 'direct', 'all'));

-- Migrate existing rows: any link that had include_children=true becomes 'direct'.
UPDATE user_entity_links
SET children_scope = 'direct'
WHERE include_children = TRUE;

ALTER TABLE user_entity_links
DROP COLUMN IF EXISTS include_children;

COMMENT ON TABLE user_entity_links IS
'Links a system user to one or more LEI entities (official or provisional) as the basis
for entity-scoped access control. Each row grants a user a named role on a specific LEI
entity with an optional descendants scope (none/direct/all). Rows are soft-revoked via
revoked_at rather than deleted, to preserve the audit trail.';

COMMENT ON COLUMN user_entity_links.children_scope IS
'Controls descendant access scope for the link: none (entity only), direct (immediate
children), all (all descendants). Requires Level 2 relationship data for traversal.';
