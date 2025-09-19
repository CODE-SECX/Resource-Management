-- Add category-level support for tags
-- This allows tags to belong directly to a category when no subcategory is selected

-- 1) Add category_id column to tags (optional)
ALTER TABLE IF EXISTS tags
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE CASCADE;

-- 2) Helpful index for category-level lookups
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category_id);

-- 3) Optional comment
COMMENT ON COLUMN tags.category_id IS 'Optional direct category reference for tags without a subcategory';
