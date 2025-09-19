-- Backfill normalized taxonomy from existing learning/resources data
-- 1) Upsert subcategories based on existing arrays on learning/resources per category
-- 2) Create junction links for learning_subcategories and resource_subcategories
-- 3) Backfill category-level tags from existing arrays on learning/resources per category
-- 4) Reload PostgREST schema cache

-- 1) Subcategories from learning
INSERT INTO subcategories (user_id, category_id, name)
SELECT DISTINCT l.user_id, lc.category_id, TRIM(sc.name)
FROM learning l
JOIN learning_categories lc ON lc.learning_id = l.id
JOIN LATERAL unnest(l.subcategories) AS sc(name) ON TRUE
WHERE sc.name IS NOT NULL AND btrim(sc.name) <> ''
ON CONFLICT (user_id, category_id, name) DO NOTHING;

-- 1b) Subcategories from resources
INSERT INTO subcategories (user_id, category_id, name)
SELECT DISTINCT r.user_id, rc.category_id, TRIM(sc.name)
FROM resources r
JOIN resource_categories rc ON rc.resource_id = r.id
JOIN LATERAL unnest(r.subcategories) AS sc(name) ON TRUE
WHERE sc.name IS NOT NULL AND btrim(sc.name) <> ''
ON CONFLICT (user_id, category_id, name) DO NOTHING;

-- 2) learning_subcategories links
INSERT INTO learning_subcategories (learning_id, subcategory_id)
SELECT DISTINCT l.id, s.id
FROM learning l
JOIN learning_categories lc ON lc.learning_id = l.id
JOIN LATERAL unnest(l.subcategories) AS sc(name) ON TRUE
JOIN subcategories s
  ON s.user_id = l.user_id
 AND s.category_id = lc.category_id
 AND lower(s.name) = lower(sc.name)
ON CONFLICT DO NOTHING;

-- 2b) resource_subcategories links
INSERT INTO resource_subcategories (resource_id, subcategory_id)
SELECT DISTINCT r.id, s.id
FROM resources r
JOIN resource_categories rc ON rc.resource_id = r.id
JOIN LATERAL unnest(r.subcategories) AS sc(name) ON TRUE
JOIN subcategories s
  ON s.user_id = r.user_id
 AND s.category_id = rc.category_id
 AND lower(s.name) = lower(sc.name)
ON CONFLICT DO NOTHING;

-- 3) Category-level tags from learning
INSERT INTO tags (user_id, category_id, name)
SELECT DISTINCT l.user_id, lc.category_id, TRIM(t.name)
FROM learning l
JOIN learning_categories lc ON lc.learning_id = l.id
JOIN LATERAL unnest(l.tags) AS t(name) ON TRUE
WHERE t.name IS NOT NULL AND btrim(t.name) <> ''
ON CONFLICT (user_id, category_id, name) DO NOTHING;

-- 3b) Category-level tags from resources
INSERT INTO tags (user_id, category_id, name)
SELECT DISTINCT r.user_id, rc.category_id, TRIM(t.name)
FROM resources r
JOIN resource_categories rc ON rc.resource_id = r.id
JOIN LATERAL unnest(r.tags) AS t(name) ON TRUE
WHERE t.name IS NOT NULL AND btrim(t.name) <> ''
ON CONFLICT (user_id, category_id, name) DO NOTHING;

-- 4) Reload PostgREST schema cache
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
