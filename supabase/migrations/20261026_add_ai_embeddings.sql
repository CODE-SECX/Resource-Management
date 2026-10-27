-- AI: semantic search, related content and near-duplicate detection.
-- Embeddings are produced by the `ai` Edge Function (Gemini) and stored here.
-- Every function below is SECURITY INVOKER, so RLS limits results to the caller's own rows.

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS content_embeddings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('resource', 'learning')),
    item_id UUID NOT NULL,
    embedding extensions.vector(768) NOT NULL,
    content_hash TEXT NOT NULL,
    model TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_content_embeddings_user ON content_embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_content_embeddings_hnsw
    ON content_embeddings USING hnsw (embedding extensions.vector_cosine_ops);

ALTER TABLE content_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own embeddings" ON content_embeddings;
CREATE POLICY "Users manage their own embeddings" ON content_embeddings
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Drop an item's embedding when the item itself is deleted.
CREATE OR REPLACE FUNCTION delete_content_embedding()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM content_embeddings WHERE item_type = TG_ARGV[0] AND item_id = OLD.id;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_resources_delete_embedding ON resources;
CREATE TRIGGER trg_resources_delete_embedding
    AFTER DELETE ON resources FOR EACH ROW EXECUTE FUNCTION delete_content_embedding('resource');

DROP TRIGGER IF EXISTS trg_learning_delete_embedding ON learning;
CREATE TRIGGER trg_learning_delete_embedding
    AFTER DELETE ON learning FOR EACH ROW EXECUTE FUNCTION delete_content_embedding('learning');

-- Item metadata shared by the functions below.
CREATE OR REPLACE VIEW content_items WITH (security_invoker = true) AS
    SELECT 'resource'::TEXT AS item_type, id AS item_id, user_id, title, description, url, tags, updated_at
    FROM resources
    UNION ALL
    SELECT 'learning'::TEXT, id, user_id, title, description, url, tags, updated_at
    FROM learning;

-- Semantic search over the caller's content.
CREATE OR REPLACE FUNCTION match_content(
    query_embedding extensions.vector(768),
    match_count INT DEFAULT 10,
    min_similarity FLOAT DEFAULT 0.35,
    filter_type TEXT DEFAULT NULL
)
RETURNS TABLE (item_type TEXT, item_id UUID, title TEXT, description TEXT, url TEXT, tags TEXT[], similarity FLOAT)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, extensions AS $$
    SELECT ci.item_type, ci.item_id, ci.title, ci.description, ci.url, ci.tags,
           1 - (ce.embedding <=> query_embedding) AS similarity
    FROM content_embeddings ce
    JOIN content_items ci ON ci.item_type = ce.item_type AND ci.item_id = ce.item_id
    WHERE ce.user_id = auth.uid()
      AND (filter_type IS NULL OR ce.item_type = filter_type)
      AND 1 - (ce.embedding <=> query_embedding) >= min_similarity
    ORDER BY ce.embedding <=> query_embedding
    LIMIT LEAST(match_count, 50);
$$;

-- Items most similar to an existing (already embedded) item.
CREATE OR REPLACE FUNCTION related_content(
    p_item_type TEXT,
    p_item_id UUID,
    match_count INT DEFAULT 6,
    min_similarity FLOAT DEFAULT 0.5
)
RETURNS TABLE (item_type TEXT, item_id UUID, title TEXT, description TEXT, url TEXT, tags TEXT[], similarity FLOAT)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, extensions AS $$
    SELECT m.*
    FROM content_embeddings src,
         LATERAL match_content(src.embedding, match_count + 1, min_similarity) m
    WHERE src.item_type = p_item_type AND src.item_id = p_item_id
      AND NOT (m.item_type = p_item_type AND m.item_id = p_item_id)
    LIMIT match_count;
$$;

-- Pairs of items that are near-duplicates of each other.
CREATE OR REPLACE FUNCTION find_near_duplicates(
    threshold FLOAT DEFAULT 0.92,
    max_pairs INT DEFAULT 50
)
RETURNS TABLE (
    a_type TEXT, a_id UUID, a_title TEXT,
    b_type TEXT, b_id UUID, b_title TEXT,
    similarity FLOAT
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, extensions AS $$
    SELECT a.item_type, a.item_id, ai.title,
           nn.item_type, nn.item_id, bi.title,
           nn.similarity
    FROM content_embeddings a
    JOIN content_items ai ON ai.item_type = a.item_type AND ai.item_id = a.item_id
    CROSS JOIN LATERAL (
        SELECT b.item_type, b.item_id, 1 - (b.embedding <=> a.embedding) AS similarity
        FROM content_embeddings b
        WHERE b.user_id = a.user_id AND b.id <> a.id
        ORDER BY b.embedding <=> a.embedding
        LIMIT 3
    ) nn
    JOIN content_items bi ON bi.item_type = nn.item_type AND bi.item_id = nn.item_id
    WHERE a.user_id = auth.uid()
      AND nn.similarity >= threshold
      -- report each pair once
      AND (a.item_type, a.item_id::TEXT) < (nn.item_type, nn.item_id::TEXT)
    ORDER BY nn.similarity DESC
    LIMIT LEAST(max_pairs, 200);
$$;

-- How much of the caller's content is indexed.
CREATE OR REPLACE FUNCTION ai_index_status()
RETURNS TABLE (total_items BIGINT, indexed_items BIGINT, last_indexed_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, extensions AS $$
    SELECT
        (SELECT COUNT(*) FROM content_items WHERE user_id = auth.uid()),
        (SELECT COUNT(*) FROM content_embeddings ce
            JOIN content_items ci ON ci.item_type = ce.item_type AND ci.item_id = ce.item_id
            WHERE ce.user_id = auth.uid()),
        (SELECT MAX(updated_at) FROM content_embeddings WHERE user_id = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION match_content, related_content, find_near_duplicates, ai_index_status TO authenticated;
GRANT SELECT ON content_items TO authenticated;
