ALTER TABLE user_entity_links
ADD COLUMN IF NOT EXISTS include_children BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE user_entity_links
SET include_children = TRUE
WHERE children_scope IN ('direct', 'all');

ALTER TABLE user_entity_links
DROP COLUMN IF EXISTS children_scope;
