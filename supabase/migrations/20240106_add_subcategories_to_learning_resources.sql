-- Add subcategories field to learning and resources tables
-- This migration adds a subcategories array field to both learning and resources tables
-- to allow for multiple subcategories per item, similar to the payloads table structure

-- Add subcategories column to learning table
ALTER TABLE learning 
ADD COLUMN IF NOT EXISTS subcategories TEXT[] DEFAULT '{}';

-- Add subcategories column to resources table  
ALTER TABLE resources
ADD COLUMN IF NOT EXISTS subcategories TEXT[] DEFAULT '{}';

-- Create GIN indexes for better performance on array operations
CREATE INDEX IF NOT EXISTS idx_learning_subcategories ON learning USING GIN(subcategories);
CREATE INDEX IF NOT EXISTS idx_resources_subcategories ON resources USING GIN(subcategories);

-- Full-text search support for subcategories using trigger-maintained tsvector columns
-- 1) Add tsvector columns to store search vectors
ALTER TABLE learning
ADD COLUMN IF NOT EXISTS subcategories_tsv tsvector;

ALTER TABLE resources
ADD COLUMN IF NOT EXISTS subcategories_tsv tsvector;

-- 2) Backfill existing rows
UPDATE learning
SET subcategories_tsv = to_tsvector('simple', COALESCE(array_to_string(subcategories, ' '), ''));

UPDATE resources
SET subcategories_tsv = to_tsvector('simple', COALESCE(array_to_string(subcategories, ' '), ''));

-- 3) Triggers to keep the tsvector columns up-to-date
CREATE OR REPLACE FUNCTION learning_subcategories_tsv_trigger()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.subcategories_tsv := to_tsvector('simple', COALESCE(array_to_string(NEW.subcategories, ' '), ''));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION resources_subcategories_tsv_trigger()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.subcategories_tsv := to_tsvector('simple', COALESCE(array_to_string(NEW.subcategories, ' '), ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_learning_subcategories_tsv ON learning;
CREATE TRIGGER trg_learning_subcategories_tsv
BEFORE INSERT OR UPDATE OF subcategories
ON learning
FOR EACH ROW
EXECUTE FUNCTION learning_subcategories_tsv_trigger();

DROP TRIGGER IF EXISTS trg_resources_subcategories_tsv ON resources;
CREATE TRIGGER trg_resources_subcategories_tsv
BEFORE INSERT OR UPDATE OF subcategories
ON resources
FOR EACH ROW
EXECUTE FUNCTION resources_subcategories_tsv_trigger();

-- 4) Index the tsvector columns
CREATE INDEX IF NOT EXISTS idx_learning_subcategories_tsv ON learning USING GIN(subcategories_tsv);
CREATE INDEX IF NOT EXISTS idx_resources_subcategories_tsv ON resources USING GIN(subcategories_tsv);

-- Update updated_at trigger function to handle the new columns if needed
-- (The existing trigger should automatically handle this, but we ensure it's active)

-- Create or replace views for statistics to include subcategories
DROP VIEW IF EXISTS learning_stats CASCADE;
CREATE OR REPLACE VIEW learning_stats AS
SELECT 
    l.user_id,
    COUNT(*) as total_learning_items,
    COUNT(DISTINCT l.difficulty_level) as unique_difficulty_levels,
    COUNT(DISTINCT c.id) as unique_categories,
    COUNT(DISTINCT subcat.subcategory) as unique_subcategories,
    COUNT(DISTINCT tag.tag) as unique_tags,
    MAX(l.created_at) as last_created,
    COUNT(CASE WHEN l.difficulty_level = 'Beginner' THEN 1 END) as beginner_count,
    COUNT(CASE WHEN l.difficulty_level = 'Intermediate' THEN 1 END) as intermediate_count,
    COUNT(CASE WHEN l.difficulty_level = 'Advanced' THEN 1 END) as advanced_count,
    COUNT(CASE WHEN l.difficulty_level = 'Expert' THEN 1 END) as expert_count
FROM learning l
LEFT JOIN learning_categories lc ON l.id = lc.learning_id
LEFT JOIN categories c ON lc.category_id = c.id
LEFT JOIN LATERAL unnest(l.subcategories) AS subcat(subcategory) ON true
LEFT JOIN LATERAL unnest(l.tags) AS tag(tag) ON true
GROUP BY l.user_id;

DROP VIEW IF EXISTS resource_stats CASCADE;
CREATE OR REPLACE VIEW resource_stats AS
SELECT 
    r.user_id,
    COUNT(*) as total_resources,
    COUNT(DISTINCT c.id) as unique_categories,
    COUNT(DISTINCT subcat.subcategory) as unique_subcategories,
    COUNT(DISTINCT tag.tag) as unique_tags,
    MAX(r.created_at) as last_created
FROM resources r
LEFT JOIN resource_categories rc ON r.id = rc.resource_id
LEFT JOIN categories c ON rc.category_id = c.id
LEFT JOIN LATERAL unnest(r.subcategories) AS subcat(subcategory) ON true
LEFT JOIN LATERAL unnest(r.tags) AS tag(tag) ON true
GROUP BY r.user_id;

-- Add comments for documentation
COMMENT ON COLUMN learning.subcategories IS 'Array of subcategories for better organization and filtering';
COMMENT ON COLUMN resources.subcategories IS 'Array of subcategories for better organization and filtering';
