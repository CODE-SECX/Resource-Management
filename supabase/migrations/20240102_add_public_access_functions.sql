-- Create function to get public learning data by ID
CREATE OR REPLACE FUNCTION get_public_learning(learning_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  url TEXT,
  tags TEXT[],
  difficulty_level TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  categories JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.title,
    l.description,
    l.url,
    l.tags,
    l.difficulty_level,
    l.created_at,
    l.updated_at,
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'id', c.id,
          'name', c.name,
          'color', c.color
        )
      ) FILTER (WHERE c.id IS NOT NULL),
      '[]'::JSONB
    ) as categories
  FROM learning l
  LEFT JOIN learning_categories lc ON l.id = lc.learning_id
  LEFT JOIN categories c ON lc.category_id = c.id
  WHERE l.id = learning_id
  GROUP BY l.id, l.title, l.description, l.url, l.tags, l.difficulty_level, l.created_at, l.updated_at;
END;
$$;

-- Create function to get public resource data by ID
CREATE OR REPLACE FUNCTION get_public_resource(resource_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  url TEXT,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  categories JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.title,
    r.description,
    r.url,
    r.tags,
    r.created_at,
    r.updated_at,
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'id', c.id,
          'name', c.name,
          'color', c.color
        )
      ) FILTER (WHERE c.id IS NOT NULL),
      '[]'::JSONB
    ) as categories
  FROM resources r
  LEFT JOIN resource_categories rc ON r.id = rc.resource_id
  LEFT JOIN categories c ON rc.category_id = c.id
  WHERE r.id = resource_id
  GROUP BY r.id, r.title, r.description, r.url, r.tags, r.created_at, r.updated_at;
END;
$$;

-- Create RPC endpoints for public access
CREATE OR REPLACE FUNCTION get_public_learning_by_token(share_token TEXT)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  url TEXT,
  tags TEXT[],
  difficulty_level TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  categories JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pl.id,
    pl.title,
    pl.description,
    pl.url,
    pl.tags,
    pl.difficulty_level,
    pl.created_at,
    pl.updated_at,
    pl.categories
  FROM get_public_learning(
    SELECT item_id::UUID 
    FROM share_tokens 
    WHERE token = share_token 
    AND is_active = true 
    AND (expires_at IS NULL OR expires_at > NOW())
    AND item_type = 'learning'
    LIMIT 1
  ) pl;
END;
$$;

-- Create RPC endpoint for public resource access
CREATE OR REPLACE FUNCTION get_public_resource_by_token(share_token TEXT)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  url TEXT,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  categories JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pr.id,
    pr.title,
    pr.description,
    pr.url,
    pr.tags,
    pr.created_at,
    pr.updated_at,
    pr.categories
  FROM get_public_resource(
    SELECT item_id::UUID 
    FROM share_tokens 
    WHERE token = share_token 
    AND is_active = true 
    AND (expires_at IS NULL OR expires_at > NOW())
    AND item_type = 'resource'
    LIMIT 1
  ) pr;
END;
$$;
