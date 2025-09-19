-- Ensure tags table has required columns for API payloads and refresh PostgREST schema cache

-- 1) Ensure description column exists (needed by UI/API payload)
ALTER TABLE IF EXISTS tags
  ADD COLUMN IF NOT EXISTS description TEXT;

-- 2) Refresh PostgREST schema cache so new/changed columns are recognized immediately
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN undefined_function THEN
    -- Fallback: try direct NOTIFY if PERFORM is not available in this context
    BEGIN
      NOTIFY pgrst, 'reload schema';
    EXCEPTION WHEN OTHERS THEN
      -- Ignore if NOTIFY fails; cache will refresh on next cycle
      NULL;
    END;
END $$;
