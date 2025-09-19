-- Make tags.subcategory_id nullable and enforce association rule
-- Add uniqueness constraints for category-level tags

-- 1) Allow tags without a subcategory
ALTER TABLE IF EXISTS tags
  ALTER COLUMN subcategory_id DROP NOT NULL;

-- 2) Ensure each tag is associated with either a subcategory OR a category
DO $$
BEGIN
  ALTER TABLE tags
    ADD CONSTRAINT tags_association_nonnull_chk
    CHECK ((subcategory_id IS NOT NULL) OR (category_id IS NOT NULL)) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3) Unique per user+subcategory+name when subcategory is present
CREATE UNIQUE INDEX IF NOT EXISTS uniq_tags_user_subcat_name
  ON tags(user_id, subcategory_id, name)
  WHERE subcategory_id IS NOT NULL;

-- 4) Unique per user+category+name when no subcategory (category-level tags)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_tags_user_cat_name_category_level
  ON tags(user_id, category_id, name)
  WHERE subcategory_id IS NULL;

COMMENT ON CONSTRAINT tags_association_nonnull_chk ON tags IS 'Each tag must belong to either a subcategory or directly to a category.';

-- NOTE: The constraint is added NOT VALID to avoid failing if legacy rows violate it.
-- After fixing/backfilling legacy rows, you can validate it with:
--   ALTER TABLE tags VALIDATE CONSTRAINT tags_association_nonnull_chk;
