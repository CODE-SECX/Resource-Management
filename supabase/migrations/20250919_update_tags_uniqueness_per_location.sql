-- Make tag names unique per location (category OR subcategory), not globally per user

-- 1) Drop any existing global unique constraints or indexes on (user_id, name)
DO $$
DECLARE
  cons RECORD;
BEGIN
  FOR cons IN 
    SELECT oid, conname 
    FROM pg_constraint 
    WHERE conrelid = 'public.tags'::regclass 
      AND contype = 'u'
  LOOP
    -- Drop any unique constraint whose definition lists (user_id, name)
    IF position('(user_id, name)' IN pg_get_constraintdef(cons.oid)) > 0 THEN
      EXECUTE format('ALTER TABLE public.tags DROP CONSTRAINT %I', cons.conname);
    END IF;
  END LOOP;
END $$;

-- Also try common names directly (no-op if they don't exist)
ALTER TABLE IF EXISTS public.tags DROP CONSTRAINT IF EXISTS tags_user_id_name_key;
ALTER TABLE IF EXISTS public.tags DROP CONSTRAINT IF EXISTS uc_tags_user_name;
DROP INDEX IF EXISTS idx_tags_user_name_unique;
DROP INDEX IF EXISTS tags_user_id_name_idx;

-- 2) Ensure per-location unique constraints exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.tags'::regclass 
      AND conname = 'uc_tags_user_subcat_name'
  ) THEN
    ALTER TABLE public.tags
      ADD CONSTRAINT uc_tags_user_subcat_name UNIQUE (user_id, subcategory_id, name);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.tags'::regclass 
      AND conname = 'uc_tags_user_cat_name'
  ) THEN
    ALTER TABLE public.tags
      ADD CONSTRAINT uc_tags_user_cat_name UNIQUE (user_id, category_id, name);
  END IF;
END $$;

-- 3) Optional: keep association rule (either subcategory_id OR category_id)
DO $$
BEGIN
  ALTER TABLE public.tags
    ADD CONSTRAINT tags_association_nonnull_chk
    CHECK ((subcategory_id IS NOT NULL) OR (category_id IS NOT NULL)) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) Refresh PostgREST schema cache
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


