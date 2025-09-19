-- Ensure upsert compatibility: add unconditional unique constraints for tags
-- This allows PostgREST/Supabase upsert with on_conflict=(user_id, subcategory_id, name)
-- and on_conflict=(user_id, category_id, name) without relying on partial indexes.

-- Drop previous partial unique indexes to avoid duplication (optional but recommended)
DROP INDEX IF EXISTS uniq_tags_user_subcat_name;
DROP INDEX IF EXISTS uniq_tags_user_cat_name_category_level;

-- Add unconditional unique constraints
DO $$
BEGIN
  ALTER TABLE tags
    ADD CONSTRAINT uc_tags_user_subcat_name UNIQUE (user_id, subcategory_id, name);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE tags
    ADD CONSTRAINT uc_tags_user_cat_name UNIQUE (user_id, category_id, name);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Keep the NOT VALID association check from previous migration
-- Validate later after data backfill/cleanup if desired
-- ALTER TABLE tags VALIDATE CONSTRAINT tags_association_nonnull_chk;

-- Refresh PostgREST schema cache
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN undefined_function THEN
    BEGIN
      NOTIFY pgrst, 'reload schema';
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
END $$;
