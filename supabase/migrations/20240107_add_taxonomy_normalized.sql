-- Normalized Taxonomy: categories -> subcategories -> tags
-- This migration introduces first-class Subcategories and Tags tied to Categories,
-- and mapping tables to associate them with Learning and Resources.
-- Renaming a subcategory or tag will automatically reflect everywhere since
-- Learning/Resources will reference their IDs instead of storing name text.

-- 1) Core taxonomy tables ----------------------------------------------------

-- Subcategories belong to a Category and a User
CREATE TABLE IF NOT EXISTS subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id, name)
);

-- Tags belong to a Subcategory (and implicitly to a Category via subcategory)
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subcategory_id UUID NOT NULL REFERENCES subcategories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, subcategory_id, name)
);

-- Triggers to auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subcategories_updated_at ON subcategories;
CREATE TRIGGER trg_subcategories_updated_at
  BEFORE UPDATE ON subcategories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tags_updated_at ON tags;
CREATE TRIGGER trg_tags_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_subcategories_user ON subcategories(user_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_name ON subcategories(name);

-- Ensure required column exists if 'tags' table pre-existed without it
ALTER TABLE IF EXISTS tags
  ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES subcategories(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_subcategory ON tags(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- 2) Mapping tables to Learning and Resources -------------------------------

-- Learning <-> Subcategories (many-to-many)
CREATE TABLE IF NOT EXISTS learning_subcategories (
  learning_id UUID NOT NULL REFERENCES learning(id) ON DELETE CASCADE,
  subcategory_id UUID NOT NULL REFERENCES subcategories(id) ON DELETE CASCADE,
  PRIMARY KEY (learning_id, subcategory_id)
);
CREATE INDEX IF NOT EXISTS idx_learning_subcategories_learning ON learning_subcategories(learning_id);
CREATE INDEX IF NOT EXISTS idx_learning_subcategories_subcategory ON learning_subcategories(subcategory_id);

-- Learning <-> Tags (many-to-many)
CREATE TABLE IF NOT EXISTS learning_tags (
  learning_id UUID NOT NULL REFERENCES learning(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (learning_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_learning_tags_learning ON learning_tags(learning_id);
CREATE INDEX IF NOT EXISTS idx_learning_tags_tag ON learning_tags(tag_id);

-- Resources <-> Subcategories (many-to-many)
CREATE TABLE IF NOT EXISTS resource_subcategories (
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  subcategory_id UUID NOT NULL REFERENCES subcategories(id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, subcategory_id)
);
CREATE INDEX IF NOT EXISTS idx_resource_subcategories_resource ON resource_subcategories(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_subcategories_subcategory ON resource_subcategories(subcategory_id);

-- Resources <-> Tags (many-to-many)
CREATE TABLE IF NOT EXISTS resource_tags (
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_resource_tags_resource ON resource_tags(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_tags_tag ON resource_tags(tag_id);

-- 3) RLS Policies -----------------------------------------------------------

-- Enable RLS
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_tags ENABLE ROW LEVEL SECURITY;

-- Drop existing to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "own_subcategories_select" ON subcategories;
  DROP POLICY IF EXISTS "own_subcategories_modify" ON subcategories;
  DROP POLICY IF EXISTS "own_tags_select" ON tags;
  DROP POLICY IF EXISTS "own_tags_modify" ON tags;
  DROP POLICY IF EXISTS "own_learning_subcategories" ON learning_subcategories;
  DROP POLICY IF EXISTS "own_learning_tags" ON learning_tags;
  DROP POLICY IF EXISTS "own_resource_subcategories" ON resource_subcategories;
  DROP POLICY IF EXISTS "own_resource_tags" ON resource_tags;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Subcategories: only owner can read/write
CREATE POLICY "own_subcategories_select" ON subcategories
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_subcategories_modify" ON subcategories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tags: only owner can read/write
CREATE POLICY "own_tags_select" ON tags
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_tags_modify" ON tags
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Junctions: scope by owner via subqueries
CREATE POLICY "own_learning_subcategories" ON learning_subcategories
  USING (
    EXISTS (
      SELECT 1 FROM learning l
      WHERE l.id = learning_subcategories.learning_id AND l.user_id = auth.uid()
    ) AND EXISTS (
      SELECT 1 FROM subcategories s
      JOIN categories c ON c.id = s.category_id
      WHERE s.id = learning_subcategories.subcategory_id AND s.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM learning l
      WHERE l.id = learning_subcategories.learning_id AND l.user_id = auth.uid()
    ) AND EXISTS (
      SELECT 1 FROM subcategories s
      JOIN categories c ON c.id = s.category_id
      WHERE s.id = learning_subcategories.subcategory_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "own_learning_tags" ON learning_tags
  USING (
    EXISTS (
      SELECT 1 FROM learning l
      WHERE l.id = learning_tags.learning_id AND l.user_id = auth.uid()
    ) AND EXISTS (
      SELECT 1 FROM tags t
      WHERE t.id = learning_tags.tag_id AND t.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM learning l
      WHERE l.id = learning_tags.learning_id AND l.user_id = auth.uid()
    ) AND EXISTS (
      SELECT 1 FROM tags t
      WHERE t.id = learning_tags.tag_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "own_resource_subcategories" ON resource_subcategories
  USING (
    EXISTS (
      SELECT 1 FROM resources r
      WHERE r.id = resource_subcategories.resource_id AND r.user_id = auth.uid()
    ) AND EXISTS (
      SELECT 1 FROM subcategories s
      JOIN categories c ON c.id = s.category_id
      WHERE s.id = resource_subcategories.subcategory_id AND s.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM resources r
      WHERE r.id = resource_subcategories.resource_id AND r.user_id = auth.uid()
    ) AND EXISTS (
      SELECT 1 FROM subcategories s
      JOIN categories c ON c.id = s.category_id
      WHERE s.id = resource_subcategories.subcategory_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "own_resource_tags" ON resource_tags
  USING (
    EXISTS (
      SELECT 1 FROM resources r
      WHERE r.id = resource_tags.resource_id AND r.user_id = auth.uid()
    ) AND EXISTS (
      SELECT 1 FROM tags t
      WHERE t.id = resource_tags.tag_id AND t.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM resources r
      WHERE r.id = resource_tags.resource_id AND r.user_id = auth.uid()
    ) AND EXISTS (
      SELECT 1 FROM tags t
      WHERE t.id = resource_tags.tag_id AND t.user_id = auth.uid()
    )
  );

-- 4) Comments ---------------------------------------------------------------
COMMENT ON TABLE subcategories IS 'User-owned subcategories tied to categories';
COMMENT ON TABLE tags IS 'User-owned tags tied to subcategories';
COMMENT ON TABLE learning_subcategories IS 'Junction between learning and subcategories';
COMMENT ON TABLE learning_tags IS 'Junction between learning and tags';
COMMENT ON TABLE resource_subcategories IS 'Junction between resources and subcategories';
COMMENT ON TABLE resource_tags IS 'Junction between resources and tags';
