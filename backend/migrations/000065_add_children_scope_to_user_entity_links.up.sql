ALTER TABLE user_entity_links
ADD COLUMN IF NOT EXISTS children_scope VARCHAR(10) NOT NULL DEFAULT 'none'
    CHECK (children_scope IN ('none', 'direct', 'all'));

-- Migrate existing rows: any link that had include_children=true becomes 'direct'.
UPDATE user_entity_links
SET children_scope = 'direct'
WHERE include_children = TRUE;

ALTER TABLE user_entity_links
DROP COLUMN IF EXISTS include_children;
