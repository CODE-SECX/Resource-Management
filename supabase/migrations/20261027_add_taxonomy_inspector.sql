-- AI Library Organizer: inspections, reviewable change proposals, and a safe apply/rollback engine.
--
-- Flow:
--   1. The `taxonomy-inspector` Edge Function (Gemini) analyses the caller's library and stores
--      typed, validated rows in taxonomy_proposals. The AI never writes SQL or touches data directly.
--   2. An admin approves / rejects proposals (pending ↔ approved ↔ rejected).
--   3. apply_taxonomy_proposal(s) runs one fixed, whitelisted operation per proposal inside a
--      transaction, recording an undo log; rollback_taxonomy_proposal replays it in reverse.
--
-- Everything is SECURITY INVOKER (except is_admin), so RLS keeps each user inside their own library.

-- ============================================================================
-- Roles
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Users can see their own role; granting roles is done from the SQL editor (service role).
DROP POLICY IF EXISTS "Users read their own role" ON user_roles;
CREATE POLICY "Users read their own role" ON user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, taxonomy_private AS $$
    SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin');
$$;

-- ============================================================================
-- Inspection records
-- ============================================================================

CREATE TABLE IF NOT EXISTS taxonomy_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('full', 'incremental')),
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
    model TEXT,
    item_count INT NOT NULL DEFAULT 0,          -- items in scope for this run
    items_processed INT NOT NULL DEFAULT 0,
    analyze_structure BOOLEAN NOT NULL DEFAULT TRUE,
    structure_done BOOLEAN NOT NULL DEFAULT FALSE,
    structure_fingerprint TEXT,                 -- detects taxonomy changes between runs
    current_structure JSONB,                    -- snapshot of the taxonomy when the run started
    summary TEXT,
    stats JSONB NOT NULL DEFAULT '{}',
    log JSONB NOT NULL DEFAULT '[]',
    error TEXT,
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    heartbeat_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_taxonomy_inspections_user ON taxonomy_inspections(user_id, created_at DESC);

-- Which items each run covers (and which chunk they belong to, so runs can resume).
CREATE TABLE IF NOT EXISTS taxonomy_inspection_items (
    inspection_id UUID NOT NULL REFERENCES taxonomy_inspections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('resource', 'learning')),
    item_id UUID NOT NULL,
    chunk INT NOT NULL,
    content_hash TEXT NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (inspection_id, item_type, item_id)
);
CREATE INDEX IF NOT EXISTS idx_taxonomy_inspection_items_chunk ON taxonomy_inspection_items(inspection_id, chunk);

-- Last inspected state of every item; drives incremental runs.
CREATE TABLE IF NOT EXISTS taxonomy_item_state (
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('resource', 'learning')),
    item_id UUID NOT NULL,
    content_hash TEXT NOT NULL,
    last_inspection_id UUID REFERENCES taxonomy_inspections(id) ON DELETE SET NULL,
    inspected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, item_type, item_id)
);

-- Proposal payloads (ids are UUIDs; {"ref": "..."} points at an entity created by a create_* proposal
-- of the same inspection):
--   create_category      {name, description?}                                   (+ ref)
--   rename_category      {category_id, new_name}
--   merge_categories     {target:{id|ref}, source_ids:[uuid], new_name?}
--   create_subcategory   {category:{id|ref}, name}                              (+ ref)
--   rename_subcategory   {subcategory_id, new_name}
--   move_subcategory     {subcategory_id, to_category:{id|ref}}
--   merge_subcategories  {target:{id|ref}, source_ids:[uuid], new_name?}
--   rename_tag           {tag_id, new_name}
--   merge_tags           {target_id, source_ids:[uuid], new_name?}
--   reassign_item        {item_type, item_id, add_categories:[{id|ref}], remove_category_ids:[uuid],
--                         add_subcategories:[{id|ref}], remove_subcategory_ids:[uuid]}
--   set_item_tags        {item_type, item_id, add_tags:[{id} | {name, subcategory?:{id|ref}, category?:{id|ref}}],
--                         remove_tag_ids:[uuid]}
CREATE TABLE IF NOT EXISTS taxonomy_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES taxonomy_inspections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    seq INT NOT NULL DEFAULT 0,
    kind TEXT NOT NULL CHECK (kind IN (
        'create_category', 'rename_category', 'merge_categories',
        'create_subcategory', 'rename_subcategory', 'move_subcategory', 'merge_subcategories',
        'rename_tag', 'merge_tags',
        'reassign_item', 'set_item_tags')),
    ref TEXT,
    payload JSONB NOT NULL,
    summary TEXT NOT NULL,
    rationale TEXT,
    confidence REAL,
    fingerprint TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'applied', 'failed', 'rolled_back')),
    error TEXT,
    result JSONB,
    undo JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    applied_at TIMESTAMPTZ,
    rolled_back_at TIMESTAMPTZ,
    UNIQUE (inspection_id, ref)
);
CREATE INDEX IF NOT EXISTS idx_taxonomy_proposals_inspection ON taxonomy_proposals(inspection_id, seq);
CREATE INDEX IF NOT EXISTS idx_taxonomy_proposals_fingerprint ON taxonomy_proposals(user_id, fingerprint);

-- Admin-only access to all inspection data.
ALTER TABLE taxonomy_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_inspection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_item_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage their inspections" ON taxonomy_inspections;
CREATE POLICY "Admins manage their inspections" ON taxonomy_inspections
    FOR ALL USING (auth.uid() = user_id AND is_admin()) WITH CHECK (auth.uid() = user_id AND is_admin());
DROP POLICY IF EXISTS "Admins manage their inspection items" ON taxonomy_inspection_items;
CREATE POLICY "Admins manage their inspection items" ON taxonomy_inspection_items
    FOR ALL USING (auth.uid() = user_id AND is_admin()) WITH CHECK (auth.uid() = user_id AND is_admin());
DROP POLICY IF EXISTS "Admins manage their item state" ON taxonomy_item_state;
CREATE POLICY "Admins manage their item state" ON taxonomy_item_state
    FOR ALL USING (auth.uid() = user_id AND is_admin()) WITH CHECK (auth.uid() = user_id AND is_admin());
DROP POLICY IF EXISTS "Admins manage their proposals" ON taxonomy_proposals;
CREATE POLICY "Admins manage their proposals" ON taxonomy_proposals
    FOR ALL USING (auth.uid() = user_id AND is_admin()) WITH CHECK (auth.uid() = user_id AND is_admin());

-- Proposals are immutable once written, and only the apply/rollback functions may move them to
-- applied / failed / rolled_back. Admins can freely move between pending, approved and rejected.
CREATE OR REPLACE FUNCTION guard_taxonomy_proposal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.payload IS DISTINCT FROM OLD.payload OR NEW.kind <> OLD.kind OR NEW.ref IS DISTINCT FROM OLD.ref
       OR NEW.inspection_id <> OLD.inspection_id THEN
        RAISE EXCEPTION 'Proposals cannot be edited after they are created';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND coalesce(current_setting('app.taxonomy_apply', TRUE), '') <> 'on' THEN
        IF NEW.status NOT IN ('pending', 'approved', 'rejected') OR OLD.status NOT IN ('pending', 'approved', 'rejected', 'failed') THEN
            RAISE EXCEPTION 'Cannot change a % proposal to %', OLD.status, NEW.status;
        END IF;
        NEW.decided_at := NOW();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_taxonomy_proposal ON taxonomy_proposals;
CREATE TRIGGER trg_guard_taxonomy_proposal
    BEFORE UPDATE ON taxonomy_proposals FOR EACH ROW EXECUTE FUNCTION guard_taxonomy_proposal();

-- Per-inspection counts for the history list.
CREATE OR REPLACE VIEW taxonomy_inspection_summary WITH (security_invoker = true) AS
    SELECT i.*,
        (SELECT COUNT(*) FROM taxonomy_proposals p WHERE p.inspection_id = i.id) AS proposals_total,
        (SELECT COUNT(*) FROM taxonomy_proposals p WHERE p.inspection_id = i.id AND p.status = 'pending') AS proposals_pending,
        (SELECT COUNT(*) FROM taxonomy_proposals p WHERE p.inspection_id = i.id AND p.status = 'approved') AS proposals_approved,
        (SELECT COUNT(*) FROM taxonomy_proposals p WHERE p.inspection_id = i.id AND p.status = 'rejected') AS proposals_rejected,
        (SELECT COUNT(*) FROM taxonomy_proposals p WHERE p.inspection_id = i.id AND p.status = 'applied') AS proposals_applied,
        (SELECT COUNT(*) FROM taxonomy_proposals p WHERE p.inspection_id = i.id AND p.status = 'failed') AS proposals_failed
    FROM taxonomy_inspections i;

-- ============================================================================
-- Snapshots & change detection
-- ============================================================================

-- A hash per item covering its content AND the names/placement of its taxonomy, so renaming or
-- moving a category/subcategory/tag marks exactly the affected items for re-inspection.
CREATE OR REPLACE FUNCTION taxonomy_item_hashes()
RETURNS TABLE (item_type TEXT, item_id UUID, content_hash TEXT)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, taxonomy_private AS $$
    SELECT 'resource', r.id, md5(concat_ws(E'\x1f',
        r.title, r.description, r.url, left(coalesce(r.html_content, ''), 20000),
        array_to_string(r.tags, ','),
        (SELECT string_agg(c.id || ':' || c.name, ',' ORDER BY c.id)
            FROM resource_categories x JOIN categories c ON c.id = x.category_id WHERE x.resource_id = r.id),
        (SELECT string_agg(s.id || ':' || s.name || '@' || s.category_id, ',' ORDER BY s.id)
            FROM resource_subcategories x JOIN subcategories s ON s.id = x.subcategory_id WHERE x.resource_id = r.id),
        (SELECT string_agg(t.id || ':' || t.name, ',' ORDER BY t.id)
            FROM resource_tags x JOIN tags t ON t.id = x.tag_id WHERE x.resource_id = r.id)))
    FROM resources r
    WHERE r.user_id = auth.uid()
    UNION ALL
    SELECT 'learning', l.id, md5(concat_ws(E'\x1f',
        l.title, l.description, l.url, left(coalesce(l.html_content, ''), 20000), l.difficulty_level,
        array_to_string(l.tags, ','),
        (SELECT string_agg(c.id || ':' || c.name, ',' ORDER BY c.id)
            FROM learning_categories x JOIN categories c ON c.id = x.category_id WHERE x.learning_id = l.id),
        (SELECT string_agg(s.id || ':' || s.name || '@' || s.category_id, ',' ORDER BY s.id)
            FROM learning_subcategories x JOIN subcategories s ON s.id = x.subcategory_id WHERE x.learning_id = l.id),
        (SELECT string_agg(t.id || ':' || t.name, ',' ORDER BY t.id)
            FROM learning_tags x JOIN tags t ON t.id = x.tag_id WHERE x.learning_id = l.id)))
    FROM learning l
    WHERE l.user_id = auth.uid();
$$;

-- Items to analyse: everything (full) or only new / changed / affected items (incremental).
CREATE OR REPLACE FUNCTION taxonomy_affected_items(p_full BOOLEAN DEFAULT FALSE)
RETURNS TABLE (item_type TEXT, item_id UUID, content_hash TEXT, is_new BOOLEAN)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, taxonomy_private AS $$
    SELECT h.item_type, h.item_id, h.content_hash, st.item_id IS NULL
    FROM taxonomy_item_hashes() h
    LEFT JOIN taxonomy_item_state st
        ON st.user_id = auth.uid() AND st.item_type = h.item_type AND st.item_id = h.item_id
    WHERE p_full OR st.content_hash IS DISTINCT FROM h.content_hash;
$$;

-- The caller's taxonomy as a tree, with usage counts and sample item titles for context.
CREATE OR REPLACE FUNCTION taxonomy_snapshot()
RETURNS JSONB LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, taxonomy_private AS $$
    SELECT jsonb_build_object(
        'categories', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', c.id,
                'name', c.name,
                'description', nullif(c.description, ''),
                'item_count',
                    (SELECT COUNT(*) FROM learning_categories x WHERE x.category_id = c.id)
                  + (SELECT COUNT(*) FROM resource_categories x WHERE x.category_id = c.id),
                'sample_items', (
                    SELECT coalesce(jsonb_agg(s.title), '[]') FROM (
                        SELECT l.title FROM learning_categories x JOIN learning l ON l.id = x.learning_id WHERE x.category_id = c.id
                        UNION ALL
                        SELECT r.title FROM resource_categories x JOIN resources r ON r.id = x.resource_id WHERE x.category_id = c.id
                        LIMIT 5) s),
                'tags', (
                    SELECT coalesce(jsonb_agg(jsonb_build_object(
                        'id', t.id, 'name', t.name,
                        'usage', (SELECT COUNT(*) FROM learning_tags x WHERE x.tag_id = t.id)
                               + (SELECT COUNT(*) FROM resource_tags x WHERE x.tag_id = t.id)) ORDER BY t.name), '[]')
                    FROM tags t WHERE t.category_id = c.id AND t.subcategory_id IS NULL),
                'subcategories', (
                    SELECT coalesce(jsonb_agg(jsonb_build_object(
                        'id', s.id,
                        'name', s.name,
                        'item_count',
                            (SELECT COUNT(*) FROM learning_subcategories x WHERE x.subcategory_id = s.id)
                          + (SELECT COUNT(*) FROM resource_subcategories x WHERE x.subcategory_id = s.id),
                        'sample_items', (
                            SELECT coalesce(jsonb_agg(z.title), '[]') FROM (
                                SELECT l.title FROM learning_subcategories x JOIN learning l ON l.id = x.learning_id WHERE x.subcategory_id = s.id
                                UNION ALL
                                SELECT r.title FROM resource_subcategories x JOIN resources r ON r.id = x.resource_id WHERE x.subcategory_id = s.id
                                LIMIT 5) z),
                        'tags', (
                            SELECT coalesce(jsonb_agg(jsonb_build_object(
                                'id', t.id, 'name', t.name,
                                'usage', (SELECT COUNT(*) FROM learning_tags x WHERE x.tag_id = t.id)
                                       + (SELECT COUNT(*) FROM resource_tags x WHERE x.tag_id = t.id)) ORDER BY t.name), '[]')
                            FROM tags t WHERE t.subcategory_id = s.id)
                    ) ORDER BY s.name), '[]')
                    FROM subcategories s WHERE s.category_id = c.id)
            ) ORDER BY c.name)
            FROM categories c WHERE c.user_id = auth.uid()), '[]'),
        'total_items',
            (SELECT COUNT(*) FROM learning WHERE user_id = auth.uid())
          + (SELECT COUNT(*) FROM resources WHERE user_id = auth.uid()),
        'uncategorized_items',
            (SELECT COUNT(*) FROM learning l WHERE l.user_id = auth.uid()
                AND NOT EXISTS (SELECT 1 FROM learning_categories x WHERE x.learning_id = l.id)
                AND NOT EXISTS (SELECT 1 FROM learning_subcategories x WHERE x.learning_id = l.id))
          + (SELECT COUNT(*) FROM resources r WHERE r.user_id = auth.uid()
                AND NOT EXISTS (SELECT 1 FROM resource_categories x WHERE x.resource_id = r.id)
                AND NOT EXISTS (SELECT 1 FROM resource_subcategories x WHERE x.resource_id = r.id))
    );
$$;

-- ============================================================================
-- Apply engine: undo log helpers
-- ============================================================================
-- The engine lives in a schema the Data API does not expose, so it can only be reached through
-- the admin-checked public functions below.
CREATE SCHEMA IF NOT EXISTS taxonomy_private;
GRANT USAGE ON SCHEMA taxonomy_private TO authenticated;
-- Every mutation goes through these helpers, which record how to reverse it in a transaction-local
-- temp table. Table/column names are whitelisted; values are always bound parameters.

CREATE OR REPLACE FUNCTION taxonomy_private._tx_pk(p_tbl TEXT)
RETURNS TEXT[] LANGUAGE sql IMMUTABLE SET search_path = public, taxonomy_private AS $$
    SELECT CASE p_tbl
        WHEN 'categories' THEN ARRAY['id']
        WHEN 'subcategories' THEN ARRAY['id']
        WHEN 'tags' THEN ARRAY['id']
        WHEN 'resources' THEN ARRAY['id']
        WHEN 'learning' THEN ARRAY['id']
        WHEN 'learning_categories' THEN ARRAY['learning_id', 'category_id']
        WHEN 'resource_categories' THEN ARRAY['resource_id', 'category_id']
        WHEN 'learning_subcategories' THEN ARRAY['learning_id', 'subcategory_id']
        WHEN 'resource_subcategories' THEN ARRAY['resource_id', 'subcategory_id']
        WHEN 'learning_tags' THEN ARRAY['learning_id', 'tag_id']
        WHEN 'resource_tags' THEN ARRAY['resource_id', 'tag_id']
    END;
$$;

CREATE OR REPLACE FUNCTION taxonomy_private._tx_check_table(p_tbl TEXT)
RETURNS TEXT[] LANGUAGE plpgsql IMMUTABLE SET search_path = public, taxonomy_private AS $$
DECLARE v_pk TEXT[] := _tx_pk(p_tbl);
BEGIN
    IF v_pk IS NULL THEN
        RAISE EXCEPTION 'Table % is not managed by the taxonomy engine', p_tbl;
    END IF;
    RETURN v_pk;
END;
$$;

CREATE OR REPLACE FUNCTION taxonomy_private._tx_norm(p TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = public, taxonomy_private AS $$
    SELECT lower(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'));
$$;

CREATE OR REPLACE FUNCTION taxonomy_private._tx_begin()
RETURNS VOID LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
BEGIN
    CREATE TEMP TABLE IF NOT EXISTS _tx_undo (seq BIGSERIAL, entry JSONB NOT NULL) ON COMMIT DROP;
    CREATE TEMP TABLE IF NOT EXISTS _tx_affected (item_type TEXT, item_id UUID, PRIMARY KEY (item_type, item_id)) ON COMMIT DROP;
    TRUNCATE _tx_undo;
    TRUNCATE _tx_affected;
END;
$$;

CREATE OR REPLACE FUNCTION taxonomy_private._tx_push(p_entry JSONB)
RETURNS VOID LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
BEGIN
    INSERT INTO _tx_undo (entry) VALUES (p_entry);
END;
$$;

CREATE OR REPLACE FUNCTION taxonomy_private._tx_affect(p_type TEXT, p_id UUID)
RETURNS VOID LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
BEGIN
    INSERT INTO _tx_affected VALUES (p_type, p_id) ON CONFLICT DO NOTHING;
END;
$$;

-- Insert a row the engine created; undo = delete it.
CREATE OR REPLACE FUNCTION taxonomy_private._tx_created(p_tbl TEXT, p_id UUID)
RETURNS VOID LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
BEGIN
    PERFORM _tx_check_table(p_tbl);
    PERFORM _tx_push(jsonb_build_object('op', 'delete', 'table', p_tbl, 'pk', jsonb_build_object('id', p_id)));
END;
$$;

-- Update columns of an id-keyed row; undo = restore their previous values.
CREATE OR REPLACE FUNCTION taxonomy_private._tx_update(p_tbl TEXT, p_id UUID, p_set JSONB)
RETURNS VOID LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
DECLARE
    v_before JSONB;
    v_sets TEXT;
BEGIN
    IF _tx_check_table(p_tbl) <> ARRAY['id'] THEN
        RAISE EXCEPTION '_tx_update only supports id-keyed tables';
    END IF;
    EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE id = $1', p_tbl) INTO v_before USING p_id;
    IF v_before IS NULL THEN
        RAISE EXCEPTION 'stale: % % no longer exists', p_tbl, p_id;
    END IF;
    PERFORM _tx_push(jsonb_build_object(
        'op', 'update', 'table', p_tbl, 'pk', jsonb_build_object('id', p_id),
        'row', (SELECT jsonb_object_agg(k, v_before -> k) FROM jsonb_object_keys(p_set) k)));
    SELECT string_agg(format('%I = (jsonb_populate_record(NULL::%I, $1)).%I', k, p_tbl, k), ', ')
        INTO v_sets FROM jsonb_object_keys(p_set) k;
    EXECUTE format('UPDATE %I SET %s WHERE id = $2', p_tbl, v_sets) USING p_set, p_id;
END;
$$;

-- Delete an id-keyed row; undo = re-insert it.
CREATE OR REPLACE FUNCTION taxonomy_private._tx_delete(p_tbl TEXT, p_id UUID)
RETURNS VOID LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
DECLARE v_row JSONB;
BEGIN
    IF _tx_check_table(p_tbl) <> ARRAY['id'] THEN
        RAISE EXCEPTION '_tx_delete only supports id-keyed tables';
    END IF;
    EXECUTE format('DELETE FROM %I t WHERE id = $1 RETURNING to_jsonb(t)', p_tbl) INTO v_row USING p_id;
    IF v_row IS NOT NULL THEN
        PERFORM _tx_push(jsonb_build_object('op', 'insert', 'table', p_tbl, 'row', v_row));
    END IF;
END;
$$;

-- Add a junction row if missing; undo = remove it.
CREATE OR REPLACE FUNCTION taxonomy_private._tx_link(p_tbl TEXT, p_a UUID, p_b UUID)
RETURNS VOID LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
DECLARE
    v_pk TEXT[] := _tx_check_table(p_tbl);
    v_n INT;
BEGIN
    EXECUTE format('INSERT INTO %I (%I, %I) VALUES ($1, $2) ON CONFLICT DO NOTHING', p_tbl, v_pk[1], v_pk[2])
        USING p_a, p_b;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN
        PERFORM _tx_push(jsonb_build_object('op', 'delete', 'table', p_tbl,
            'pk', jsonb_build_object(v_pk[1], p_a, v_pk[2], p_b)));
    END IF;
END;
$$;

-- Remove a junction row; undo = put it back.
CREATE OR REPLACE FUNCTION taxonomy_private._tx_unlink(p_tbl TEXT, p_a UUID, p_b UUID)
RETURNS VOID LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
DECLARE
    v_pk TEXT[] := _tx_check_table(p_tbl);
    v_row JSONB;
BEGIN
    EXECUTE format('DELETE FROM %I t WHERE %I = $1 AND %I = $2 RETURNING to_jsonb(t)', p_tbl, v_pk[1], v_pk[2])
        INTO v_row USING p_a, p_b;
    IF v_row IS NOT NULL THEN
        PERFORM _tx_push(jsonb_build_object('op', 'insert', 'table', p_tbl, 'row', v_row));
    END IF;
END;
$$;

-- Replace (or with p_new NULL, remove) a value in an item's legacy text[] column (tags / subcategories),
-- de-duplicating and keeping order. The UI still reads these arrays, so they must stay in sync.
CREATE OR REPLACE FUNCTION taxonomy_private._tx_array_replace(p_type TEXT, p_id UUID, p_col TEXT, p_old TEXT, p_new TEXT)
RETURNS VOID LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
DECLARE
    v_tbl TEXT := CASE p_type WHEN 'resource' THEN 'resources' WHEN 'learning' THEN 'learning' END;
    v_arr TEXT[];
    v_out TEXT[];
BEGIN
    IF v_tbl IS NULL OR p_col NOT IN ('tags', 'subcategories') THEN
        RAISE EXCEPTION 'invalid array target %.%', p_type, p_col;
    END IF;
    EXECUTE format('SELECT %I FROM %I WHERE id = $1', p_col, v_tbl) INTO v_arr USING p_id;
    IF v_arr IS NULL OR NOT EXISTS (SELECT 1 FROM unnest(v_arr) v WHERE _tx_norm(v) = _tx_norm(p_old)) THEN
        RETURN;
    END IF;
    SELECT coalesce(array_agg(v ORDER BY first_pos), '{}') INTO v_out FROM (
        SELECT v, MIN(pos) AS first_pos FROM (
            SELECT CASE WHEN _tx_norm(v) = _tx_norm(p_old) THEN p_new ELSE v END AS v, pos
            FROM unnest(v_arr) WITH ORDINALITY u(v, pos)) s
        WHERE v IS NOT NULL
        GROUP BY v) d;
    PERFORM _tx_update(v_tbl, p_id, jsonb_build_object(p_col, to_jsonb(v_out)));
END;
$$;

CREATE OR REPLACE FUNCTION taxonomy_private._tx_array_add(p_type TEXT, p_id UUID, p_col TEXT, p_value TEXT)
RETURNS VOID LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
DECLARE
    v_tbl TEXT := CASE p_type WHEN 'resource' THEN 'resources' WHEN 'learning' THEN 'learning' END;
    v_arr TEXT[];
BEGIN
    IF v_tbl IS NULL OR p_col NOT IN ('tags', 'subcategories') THEN
        RAISE EXCEPTION 'invalid array target %.%', p_type, p_col;
    END IF;
    EXECUTE format('SELECT %I FROM %I WHERE id = $1', p_col, v_tbl) INTO v_arr USING p_id;
    IF EXISTS (SELECT 1 FROM unnest(coalesce(v_arr, '{}')) v WHERE _tx_norm(v) = _tx_norm(p_value)) THEN
        RETURN;
    END IF;
    PERFORM _tx_update(v_tbl, p_id, jsonb_build_object(p_col, to_jsonb(coalesce(v_arr, '{}') || p_value)));
END;
$$;

-- Replay an undo log in reverse order.
CREATE OR REPLACE FUNCTION taxonomy_private._tx_replay(p_entries JSONB)
RETURNS VOID LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
DECLARE
    e JSONB;
    v_tbl TEXT;
    v_pk TEXT[];
    v_cond TEXT;
    v_sets TEXT;
BEGIN
    FOR e IN SELECT x.value FROM jsonb_array_elements(coalesce(p_entries, '[]')) WITH ORDINALITY x(value, n) ORDER BY x.n DESC LOOP
        v_tbl := e ->> 'table';
        v_pk := _tx_check_table(v_tbl);
        IF e ->> 'op' = 'insert' THEN
            EXECUTE format('INSERT INTO %I SELECT * FROM jsonb_populate_record(NULL::%I, $1) ON CONFLICT DO NOTHING', v_tbl, v_tbl)
                USING e -> 'row';
        ELSE
            SELECT string_agg(format('%I = (jsonb_populate_record(NULL::%I, $1)).%I', c, v_tbl, c), ' AND ')
                INTO v_cond FROM unnest(v_pk) c;
            IF e ->> 'op' = 'delete' THEN
                EXECUTE format('DELETE FROM %I WHERE %s', v_tbl, v_cond) USING e -> 'pk';
            ELSIF e ->> 'op' = 'update' THEN
                SELECT string_agg(format('%I = (jsonb_populate_record(NULL::%I, $2)).%I', k, v_tbl, k), ', ')
                    INTO v_sets FROM jsonb_object_keys(e -> 'row') k;
                EXECUTE format('UPDATE %I SET %s WHERE %s', v_tbl, v_sets, v_cond) USING e -> 'pk', e -> 'row';
            ELSE
                RAISE EXCEPTION 'invalid undo op %', e ->> 'op';
            END IF;
        END IF;
    END LOOP;
END;
$$;

-- ============================================================================
-- Apply engine: lookups
-- ============================================================================

-- {"id": uuid} or {"ref": "..."} (an entity created by an applied create_* proposal of the inspection).
CREATE OR REPLACE FUNCTION taxonomy_private._tx_resolve(p_inspection UUID, p_ref JSONB)
RETURNS UUID LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
DECLARE
    v_id UUID;
    v_status TEXT;
BEGIN
    IF p_ref ? 'id' THEN
        RETURN (p_ref ->> 'id')::UUID;
    END IF;
    SELECT (result ->> 'id')::UUID, status INTO v_id, v_status
    FROM taxonomy_proposals WHERE inspection_id = p_inspection AND ref = p_ref ->> 'ref';
    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Unknown reference "%"', p_ref ->> 'ref';
    END IF;
    IF v_status <> 'applied' OR v_id IS NULL THEN
        RAISE EXCEPTION 'Depends on "%", which has not been applied yet', p_ref ->> 'ref';
    END IF;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION taxonomy_private._tx_require(p_tbl TEXT, p_id UUID)
RETURNS VOID LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
DECLARE v_found BOOLEAN;
BEGIN
    IF p_tbl NOT IN ('categories', 'subcategories', 'tags', 'resources', 'learning') THEN
        RAISE EXCEPTION 'invalid table %', p_tbl;
    END IF;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE id = $1 AND user_id = auth.uid())', p_tbl)
        INTO v_found USING p_id;
    IF NOT v_found THEN
        RAISE EXCEPTION 'stale: % % no longer exists', p_tbl, p_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION taxonomy_private._tx_clean_name(p TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE SET search_path = public, taxonomy_private AS $$
DECLARE v TEXT := regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g');
BEGIN
    IF v = '' THEN RAISE EXCEPTION 'A name is required'; END IF;
    IF length(v) > 100 THEN RAISE EXCEPTION 'Name is too long (max 100 characters)'; END IF;
    RETURN v;
END;
$$;

-- Item kind → its junction tables / key column.
CREATE OR REPLACE FUNCTION taxonomy_private._tx_item_col(p_type TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE SET search_path = public, taxonomy_private AS $$
BEGIN
    IF p_type = 'resource' THEN RETURN 'resource_id'; END IF;
    IF p_type = 'learning' THEN RETURN 'learning_id'; END IF;
    RAISE EXCEPTION 'invalid item type %', p_type;
END;
$$;

-- Items (type, id) linked to a taxonomy node through a junction table.
CREATE OR REPLACE FUNCTION taxonomy_private._tx_linked_items(p_suffix TEXT, p_col TEXT, p_node UUID)
RETURNS TABLE (item_type TEXT, item_id UUID) LANGUAGE plpgsql STABLE SET search_path = public, taxonomy_private AS $$
BEGIN
    IF p_suffix NOT IN ('categories', 'subcategories', 'tags') OR p_col NOT IN ('category_id', 'subcategory_id', 'tag_id') THEN
        RAISE EXCEPTION 'invalid link target';
    END IF;
    RETURN QUERY EXECUTE format(
        'SELECT ''learning''::TEXT, learning_id FROM %I WHERE %I = $1
         UNION ALL
         SELECT ''resource''::TEXT, resource_id FROM %I WHERE %I = $1',
        'learning_' || p_suffix, p_col, 'resource_' || p_suffix, p_col) USING p_node;
END;
$$;

-- ============================================================================
-- Apply engine: building blocks
-- ============================================================================

CREATE OR REPLACE FUNCTION taxonomy_private._tx_merge_tag_into(p_src UUID, p_tgt UUID)
RETURNS VOID LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
DECLARE
    v_src_name TEXT;
    v_tgt_name TEXT;
    it RECORD;
BEGIN
    IF p_src = p_tgt THEN RETURN; END IF;
    PERFORM _tx_require('tags', p_src);
    PERFORM _tx_require('tags', p_tgt);
    SELECT name INTO v_src_name FROM tags WHERE id = p_src;
    SELECT name INTO v_tgt_name FROM tags WHERE id = p_tgt;
    FOR it IN SELECT * FROM _tx_linked_items('tags', 'tag_id', p_src) LOOP
        PERFORM _tx_link(it.item_type || '_tags', it.item_id, p_tgt);
        PERFORM _tx_unlink(it.item_type || '_tags', it.item_id, p_src);
        PERFORM _tx_array_replace(it.item_type, it.item_id, 'tags', v_src_name, v_tgt_name);
        PERFORM _tx_affect(it.item_type, it.item_id);
    END LOOP;
    PERFORM _tx_delete('tags', p_src);
END;
$$;

-- An existing tag at a location with the same (normalised) name, if any.
CREATE OR REPLACE FUNCTION taxonomy_private._tx_find_tag(p_subcategory UUID, p_category UUID, p_name TEXT, p_exclude UUID DEFAULT NULL)
RETURNS UUID LANGUAGE sql STABLE SET search_path = public, taxonomy_private AS $$
    SELECT id FROM tags
    WHERE user_id = auth.uid()
      AND id IS DISTINCT FROM p_exclude
      AND _tx_norm(name) = _tx_norm(p_name)
      AND CASE WHEN p_subcategory IS NOT NULL THEN subcategory_id = p_subcategory
               ELSE category_id = p_category AND subcategory_id IS NULL END
    ORDER BY created_at
    LIMIT 1;
$$;

-- Move a tag to a subcategory (or, with p_subcategory NULL, to category level),
-- merging into an existing same-name tag there instead of creating a duplicate.
CREATE OR REPLACE FUNCTION taxonomy_private._tx_move_tag(p_tag UUID, p_subcategory UUID, p_category UUID)
RETURNS VOID LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
DECLARE
    v_name TEXT;
    v_existing UUID;
BEGIN
    SELECT name INTO v_name FROM tags WHERE id = p_tag;
    v_existing := _tx_find_tag(p_subcategory, p_category, v_name, p_tag);
    IF v_existing IS NOT NULL THEN
        PERFORM _tx_merge_tag_into(p_tag, v_existing);
    ELSIF p_subcategory IS NOT NULL THEN
        PERFORM _tx_update('tags', p_tag, jsonb_build_object('subcategory_id', p_subcategory, 'category_id', NULL));
    ELSE
        PERFORM _tx_update('tags', p_tag, jsonb_build_object('category_id', p_category, 'subcategory_id', NULL));
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION taxonomy_private._tx_merge_subcategory_into(p_src UUID, p_tgt UUID)
RETURNS VOID LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
DECLARE
    v_tgt_cat UUID;
    it RECORD;
    t RECORD;
BEGIN
    IF p_src = p_tgt THEN RETURN; END IF;
    PERFORM _tx_require('subcategories', p_src);
    PERFORM _tx_require('subcategories', p_tgt);
    SELECT category_id INTO v_tgt_cat FROM subcategories WHERE id = p_tgt;

    FOR it IN SELECT * FROM _tx_linked_items('subcategories', 'subcategory_id', p_src) LOOP
        PERFORM _tx_link(it.item_type || '_subcategories', it.item_id, p_tgt);
        PERFORM _tx_unlink(it.item_type || '_subcategories', it.item_id, p_src);
        -- keep the item visible under the target's category, as the forms do
        PERFORM _tx_link(it.item_type || '_categories', it.item_id, v_tgt_cat);
        PERFORM _tx_array_replace(it.item_type, it.item_id, 'subcategories', p_src::TEXT, p_tgt::TEXT);
        PERFORM _tx_affect(it.item_type, it.item_id);
    END LOOP;

    FOR t IN SELECT id FROM tags WHERE subcategory_id = p_src LOOP
        PERFORM _tx_move_tag(t.id, p_tgt, NULL);
    END LOOP;

    PERFORM _tx_delete('subcategories', p_src);
END;
$$;

CREATE OR REPLACE FUNCTION taxonomy_private._tx_rename(p_tbl TEXT, p_id UUID, p_new_name TEXT)
RETURNS JSONB LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
DECLARE
    v_name TEXT := _tx_clean_name(p_new_name);
    v_old TEXT;
    v_conflict UUID;
    r RECORD;
    it RECORD;
BEGIN
    PERFORM _tx_require(p_tbl, p_id);
    IF p_tbl = 'categories' THEN
        SELECT name INTO v_old FROM categories WHERE id = p_id;
        SELECT id INTO v_conflict FROM categories
            WHERE user_id = auth.uid() AND id <> p_id AND _tx_norm(name) = _tx_norm(v_name) LIMIT 1;
    ELSIF p_tbl = 'subcategories' THEN
        SELECT * INTO r FROM subcategories WHERE id = p_id;
        v_old := r.name;
        SELECT id INTO v_conflict FROM subcategories
            WHERE category_id = r.category_id AND id <> p_id AND _tx_norm(name) = _tx_norm(v_name) LIMIT 1;
    ELSIF p_tbl = 'tags' THEN
        SELECT * INTO r FROM tags WHERE id = p_id;
        v_old := r.name;
        v_conflict := _tx_find_tag(r.subcategory_id, r.category_id, v_name, p_id);
    ELSE
        RAISE EXCEPTION 'cannot rename %', p_tbl;
    END IF;

    IF v_conflict IS NOT NULL THEN
        RAISE EXCEPTION '"%" already exists here; merge instead of renaming', v_name;
    END IF;
    IF v_old = v_name THEN
        RETURN jsonb_build_object('id', p_id, 'unchanged', TRUE);
    END IF;

    PERFORM _tx_update(p_tbl, p_id, jsonb_build_object('name', v_name));

    -- items display names from their legacy arrays / embed taxonomy names: mark them affected
    IF p_tbl = 'tags' THEN
        FOR it IN SELECT * FROM _tx_linked_items('tags', 'tag_id', p_id) LOOP
            PERFORM _tx_array_replace(it.item_type, it.item_id, 'tags', v_old, v_name);
            PERFORM _tx_affect(it.item_type, it.item_id);
        END LOOP;
    ELSE
        FOR it IN SELECT * FROM _tx_linked_items(p_tbl, CASE p_tbl WHEN 'categories' THEN 'category_id' ELSE 'subcategory_id' END, p_id) LOOP
            PERFORM _tx_affect(it.item_type, it.item_id);
        END LOOP;
    END IF;
    RETURN jsonb_build_object('id', p_id, 'old_name', v_old, 'new_name', v_name);
END;
$$;

-- ============================================================================
-- Apply engine: operations (one per proposal kind)
-- ============================================================================

CREATE OR REPLACE FUNCTION taxonomy_private._tx_op_create_category(p_insp UUID, p JSONB)
RETURNS JSONB LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
DECLARE
    v_name TEXT := _tx_clean_name(p ->> 'name');
    v_id UUID;
BEGIN
    SELECT id INTO v_id FROM categories
        WHERE user_id = auth.uid() AND _tx_norm(name) = _tx_norm(v_name) ORDER BY created_at LIMIT 1;
    IF v_id IS NOT NULL THEN
        RETURN jsonb_build_object('id', v_id, 'reused_existing', TRUE);
    END IF;
    INSERT INTO categories (user_id, name, description, color)
        VALUES (auth.uid(), v_name, coalesce(p ->> 'description', ''), coalesce(p ->> 'color', '#6366f1'))
        RETURNING id INTO v_id;
    PERFORM _tx_created('categories', v_id);
    RETURN jsonb_build_object('id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION taxonomy_private._tx_op_merge_categories(p_insp UUID, p JSONB)
RETURNS JSONB LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
DECLARE
    v_target UUID := _tx_resolve(p_insp, p -> 'target');
    v_src UUID;
    v_existing UUID;
    it RECORD;
    s RECORD;
    t RECORD;
    v_merged INT := 0;
BEGIN
    PERFORM _tx_require('categories', v_target);
    FOR v_src IN SELECT (jsonb_array_elements_text(p -> 'source_ids'))::UUID LOOP
        CONTINUE WHEN v_src = v_target;
        PERFORM _tx_require('categories', v_src);

        -- 1. item links
        FOR it IN SELECT * FROM _tx_linked_items('categories', 'category_id', v_src) LOOP
            PERFORM _tx_link(it.item_type || '_categories', it.item_id, v_target);
            PERFORM _tx_unlink(it.item_type || '_categories', it.item_id, v_src);
            PERFORM _tx_affect(it.item_type, it.item_id);
        END LOOP;

        -- 2. subcategories: merge into a same-name subcategory of the target, else re-parent
        FOR s IN SELECT id, name FROM subcategories WHERE category_id = v_src LOOP
            SELECT id INTO v_existing FROM subcategories
                WHERE category_id = v_target AND _tx_norm(name) = _tx_norm(s.name) LIMIT 1;
            IF v_existing IS NOT NULL THEN
                PERFORM _tx_merge_subcategory_into(s.id, v_existing);
            ELSE
                PERFORM _tx_update('subcategories', s.id, jsonb_build_object('category_id', v_target));
                FOR it IN SELECT * FROM _tx_linked_items('subcategories', 'subcategory_id', s.id) LOOP
                    PERFORM _tx_affect(it.item_type, it.item_id);
                END LOOP;
            END IF;
        END LOOP;

        -- 3. category-level tags. Subcategory tags that (legacy) also carry this category_id are
        --    detached from it, otherwise deleting the category would cascade-delete them.
        FOR t IN SELECT id, subcategory_id FROM tags WHERE category_id = v_src LOOP
            IF t.subcategory_id IS NULL THEN
                PERFORM _tx_move_tag(t.id, NULL, v_target);
            ELSE
                PERFORM _tx_update('tags', t.id, jsonb_build_object('category_id', NULL));
            END IF;
        END LOOP;

        PERFORM _tx_delete('categories', v_src);
        v_merged := v_merged + 1;
    END LOOP;

    IF nullif(btrim(p ->> 'new_name'), '') IS NOT NULL THEN
        PERFORM _tx_rename('categories', v_target, p ->> 'new_name');
    END IF;
    RETURN jsonb_build_object('id', v_target, 'merged', v_merged);
END;
$$;

CREATE OR REPLACE FUNCTION taxonomy_private._tx_op_create_subcategory(p_insp UUID, p JSONB)
RETURNS JSONB LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
DECLARE
    v_category UUID := _tx_resolve(p_insp, p -> 'category');
    v_name TEXT := _tx_clean_name(p ->> 'name');
    v_id UUID;
BEGIN
    PERFORM _tx_require('categories', v_category);
    SELECT id INTO v_id FROM subcategories
        WHERE category_id = v_category AND _tx_norm(name) = _tx_norm(v_name) LIMIT 1;
    IF v_id IS NOT NULL THEN
        RETURN jsonb_build_object('id', v_id, 'reused_existing', TRUE);
    END IF;
    INSERT INTO subcategories (user_id, category_id, name, description)
        VALUES (auth.uid(), v_category, v_name, nullif(p ->> 'description', ''))
        RETURNING id INTO v_id;
    PERFORM _tx_created('subcategories', v_id);
    RETURN jsonb_build_object('id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION taxonomy_private._tx_op_move_subcategory(p_insp UUID, p JSONB)
RETURNS JSONB LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
DECLARE
    v_sub UUID := (p ->> 'subcategory_id')::UUID;
    v_to UUID := _tx_resolve(p_insp, p -> 'to_category');
    v_row subcategories%ROWTYPE;
    v_existing UUID;
    it RECORD;
BEGIN
    PERFORM _tx_require('subcategories', v_sub);
    PERFORM _tx_require('categories', v_to);
    SELECT * INTO v_row FROM subcategories WHERE id = v_sub;
    IF v_row.category_id = v_to THEN
        RAISE EXCEPTION 'Subcategory is already in that category';
    END IF;
    SELECT id INTO v_existing FROM subcategories
        WHERE category_id = v_to AND _tx_norm(name) = _tx_norm(v_row.name) LIMIT 1;
    IF v_existing IS NOT NULL THEN
        PERFORM _tx_merge_subcategory_into(v_sub, v_existing);
        RETURN jsonb_build_object('id', v_existing, 'merged_into_existing', TRUE);
    END IF;
    PERFORM _tx_update('subcategories', v_sub, jsonb_build_object('category_id', v_to));
    FOR it IN SELECT * FROM _tx_linked_items('subcategories', 'subcategory_id', v_sub) LOOP
        PERFORM _tx_link(it.item_type || '_categories', it.item_id, v_to);
        PERFORM _tx_affect(it.item_type, it.item_id);
    END LOOP;
    RETURN jsonb_build_object('id', v_sub);
END;
$$;

CREATE OR REPLACE FUNCTION taxonomy_private._tx_op_merge_subcategories(p_insp UUID, p JSONB)
RETURNS JSONB LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
DECLARE
    v_target UUID := _tx_resolve(p_insp, p -> 'target');
    v_src UUID;
    v_merged INT := 0;
BEGIN
    PERFORM _tx_require('subcategories', v_target);
    FOR v_src IN SELECT (jsonb_array_elements_text(p -> 'source_ids'))::UUID LOOP
        CONTINUE WHEN v_src = v_target;
        PERFORM _tx_merge_subcategory_into(v_src, v_target);
        v_merged := v_merged + 1;
    END LOOP;
    IF nullif(btrim(p ->> 'new_name'), '') IS NOT NULL THEN
        PERFORM _tx_rename('subcategories', v_target, p ->> 'new_name');
    END IF;
    RETURN jsonb_build_object('id', v_target, 'merged', v_merged);
END;
$$;

CREATE OR REPLACE FUNCTION taxonomy_private._tx_op_merge_tags(p_insp UUID, p JSONB)
RETURNS JSONB LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
DECLARE
    v_target UUID := (p ->> 'target_id')::UUID;
    v_src UUID;
    v_merged INT := 0;
BEGIN
    PERFORM _tx_require('tags', v_target);
    FOR v_src IN SELECT (jsonb_array_elements_text(p -> 'source_ids'))::UUID LOOP
        CONTINUE WHEN v_src = v_target;
        PERFORM _tx_merge_tag_into(v_src, v_target);
        v_merged := v_merged + 1;
    END LOOP;
    IF nullif(btrim(p ->> 'new_name'), '') IS NOT NULL THEN
        PERFORM _tx_rename('tags', v_target, p ->> 'new_name');
    END IF;
    RETURN jsonb_build_object('id', v_target, 'merged', v_merged);
END;
$$;

CREATE OR REPLACE FUNCTION taxonomy_private._tx_op_reassign_item(p_insp UUID, p JSONB)
RETURNS JSONB LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
DECLARE
    v_type TEXT := p ->> 'item_type';
    v_item UUID := (p ->> 'item_id')::UUID;
    v_col TEXT := _tx_item_col(v_type);
    v_id UUID;
    v_cat UUID;
    v_remaining INT;
    r JSONB;
BEGIN
    PERFORM _tx_require(CASE v_type WHEN 'resource' THEN 'resources' ELSE 'learning' END, v_item);

    FOR r IN SELECT * FROM jsonb_array_elements(coalesce(p -> 'add_categories', '[]')) LOOP
        v_id := _tx_resolve(p_insp, r);
        PERFORM _tx_require('categories', v_id);
        PERFORM _tx_link(v_type || '_categories', v_item, v_id);
    END LOOP;

    FOR r IN SELECT * FROM jsonb_array_elements(coalesce(p -> 'add_subcategories', '[]')) LOOP
        v_id := _tx_resolve(p_insp, r);
        PERFORM _tx_require('subcategories', v_id);
        SELECT category_id INTO v_cat FROM subcategories WHERE id = v_id;
        PERFORM _tx_link(v_type || '_subcategories', v_item, v_id);
        PERFORM _tx_link(v_type || '_categories', v_item, v_cat);
        PERFORM _tx_array_add(v_type, v_item, 'subcategories', v_id::TEXT);
    END LOOP;

    FOR v_id IN SELECT (jsonb_array_elements_text(coalesce(p -> 'remove_subcategory_ids', '[]')))::UUID LOOP
        PERFORM _tx_unlink(v_type || '_subcategories', v_item, v_id);
        PERFORM _tx_array_replace(v_type, v_item, 'subcategories', v_id::TEXT, NULL);
    END LOOP;

    -- removing a category also removes the item's subcategories inside it
    FOR v_cat IN SELECT (jsonb_array_elements_text(coalesce(p -> 'remove_category_ids', '[]')))::UUID LOOP
        PERFORM _tx_unlink(v_type || '_categories', v_item, v_cat);
        FOR v_id IN EXECUTE format(
            'SELECT x.subcategory_id FROM %I x JOIN subcategories s ON s.id = x.subcategory_id
             WHERE x.%I = $1 AND s.category_id = $2', v_type || '_subcategories', v_col) USING v_item, v_cat LOOP
            PERFORM _tx_unlink(v_type || '_subcategories', v_item, v_id);
            PERFORM _tx_array_replace(v_type, v_item, 'subcategories', v_id::TEXT, NULL);
        END LOOP;
    END LOOP;

    EXECUTE format('SELECT (SELECT COUNT(*) FROM %I WHERE %I = $1) + (SELECT COUNT(*) FROM %I WHERE %I = $1)',
        v_type || '_categories', v_col, v_type || '_subcategories', v_col) INTO v_remaining USING v_item;
    IF v_remaining = 0 THEN
        RAISE EXCEPTION 'This change would leave the item without any category';
    END IF;

    PERFORM _tx_affect(v_type, v_item);
    RETURN jsonb_build_object('id', v_item);
END;
$$;

CREATE OR REPLACE FUNCTION taxonomy_private._tx_op_set_item_tags(p_insp UUID, p JSONB)
RETURNS JSONB LANGUAGE plpgsql SET search_path = public, taxonomy_private AS $$
DECLARE
    v_type TEXT := p ->> 'item_type';
    v_item UUID := (p ->> 'item_id')::UUID;
    v_tag UUID;
    v_sub UUID;
    v_cat UUID;
    v_name TEXT;
    v_created JSONB := '[]';
    r JSONB;
BEGIN
    PERFORM _tx_item_col(v_type);
    PERFORM _tx_require(CASE v_type WHEN 'resource' THEN 'resources' ELSE 'learning' END, v_item);

    FOR r IN SELECT * FROM jsonb_array_elements(coalesce(p -> 'add_tags', '[]')) LOOP
        IF r ? 'id' THEN
            v_tag := (r ->> 'id')::UUID;
            PERFORM _tx_require('tags', v_tag);
        ELSE
            v_name := _tx_clean_name(r ->> 'name');
            v_sub := CASE WHEN r ? 'subcategory' THEN _tx_resolve(p_insp, r -> 'subcategory') END;
            v_cat := CASE WHEN v_sub IS NULL AND r ? 'category' THEN _tx_resolve(p_insp, r -> 'category') END;
            IF v_sub IS NULL AND v_cat IS NULL THEN
                RAISE EXCEPTION 'New tag "%" needs a category or subcategory', v_name;
            END IF;
            v_tag := _tx_find_tag(v_sub, v_cat, v_name);
            IF v_tag IS NULL THEN
                INSERT INTO tags (user_id, subcategory_id, category_id, name)
                    VALUES (auth.uid(), v_sub, v_cat, v_name) RETURNING id INTO v_tag;
                PERFORM _tx_created('tags', v_tag);
                v_created := v_created || to_jsonb(v_tag);
            END IF;
        END IF;
        SELECT name INTO v_name FROM tags WHERE id = v_tag;
        PERFORM _tx_link(v_type || '_tags', v_item, v_tag);
        PERFORM _tx_array_add(v_type, v_item, 'tags', v_name);
    END LOOP;

    FOR v_tag IN SELECT (jsonb_array_elements_text(coalesce(p -> 'remove_tag_ids', '[]')))::UUID LOOP
        SELECT name INTO v_name FROM tags WHERE id = v_tag;
        PERFORM _tx_unlink(v_type || '_tags', v_item, v_tag);
        IF v_name IS NOT NULL THEN
            PERFORM _tx_array_replace(v_type, v_item, 'tags', v_name, NULL);
        END IF;
    END LOOP;

    PERFORM _tx_affect(v_type, v_item);
    RETURN jsonb_build_object('id', v_item, 'created_tags', v_created);
END;
$$;

-- ============================================================================
-- Public API
-- ============================================================================

CREATE OR REPLACE FUNCTION taxonomy_private._tx_kind_order(p_kind TEXT)
RETURNS INT LANGUAGE sql IMMUTABLE SET search_path = public, taxonomy_private AS $$
    SELECT CASE p_kind
        WHEN 'create_category' THEN 1
        WHEN 'create_subcategory' THEN 2
        WHEN 'rename_category' THEN 3
        WHEN 'rename_subcategory' THEN 3
        WHEN 'rename_tag' THEN 3
        WHEN 'move_subcategory' THEN 4
        WHEN 'merge_categories' THEN 5
        WHEN 'merge_subcategories' THEN 6
        WHEN 'merge_tags' THEN 7
        WHEN 'reassign_item' THEN 8
        WHEN 'set_item_tags' THEN 9
        ELSE 10
    END;
$$;

-- Apply one proposal atomically. Failures are recorded on the proposal (status 'failed') and
-- leave the data untouched.
CREATE OR REPLACE FUNCTION apply_taxonomy_proposal(p_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, taxonomy_private AS $$
DECLARE
    pr taxonomy_proposals%ROWTYPE;
    v_result JSONB;
    v_err TEXT;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Only admins can apply taxonomy changes' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO pr FROM taxonomy_proposals WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Proposal % not found', p_id;
    END IF;
    IF pr.status NOT IN ('pending', 'approved', 'failed') THEN
        RETURN jsonb_build_object('id', pr.id, 'kind', pr.kind, 'status', pr.status,
            'error', 'Proposal is already ' || pr.status, 'affected_items', '[]'::JSONB);
    END IF;

    PERFORM set_config('app.taxonomy_apply', 'on', TRUE);
    PERFORM _tx_begin();
    BEGIN
        v_result := CASE pr.kind
            WHEN 'create_category' THEN _tx_op_create_category(pr.inspection_id, pr.payload)
            WHEN 'rename_category' THEN _tx_rename('categories', (pr.payload ->> 'category_id')::UUID, pr.payload ->> 'new_name')
            WHEN 'merge_categories' THEN _tx_op_merge_categories(pr.inspection_id, pr.payload)
            WHEN 'create_subcategory' THEN _tx_op_create_subcategory(pr.inspection_id, pr.payload)
            WHEN 'rename_subcategory' THEN _tx_rename('subcategories', (pr.payload ->> 'subcategory_id')::UUID, pr.payload ->> 'new_name')
            WHEN 'move_subcategory' THEN _tx_op_move_subcategory(pr.inspection_id, pr.payload)
            WHEN 'merge_subcategories' THEN _tx_op_merge_subcategories(pr.inspection_id, pr.payload)
            WHEN 'rename_tag' THEN _tx_rename('tags', (pr.payload ->> 'tag_id')::UUID, pr.payload ->> 'new_name')
            WHEN 'merge_tags' THEN _tx_op_merge_tags(pr.inspection_id, pr.payload)
            WHEN 'reassign_item' THEN _tx_op_reassign_item(pr.inspection_id, pr.payload)
            WHEN 'set_item_tags' THEN _tx_op_set_item_tags(pr.inspection_id, pr.payload)
        END;

        UPDATE taxonomy_proposals SET
            status = 'applied',
            applied_at = NOW(),
            error = NULL,
            result = v_result || jsonb_build_object('affected_items', (
                SELECT coalesce(jsonb_agg(jsonb_build_object('type', item_type, 'id', item_id)), '[]') FROM _tx_affected)),
            undo = (SELECT coalesce(jsonb_agg(entry ORDER BY seq), '[]') FROM _tx_undo)
        WHERE id = pr.id;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
        UPDATE taxonomy_proposals SET status = 'failed', error = v_err WHERE id = pr.id;
    END;
    PERFORM set_config('app.taxonomy_apply', 'off', TRUE);

    RETURN (SELECT jsonb_build_object('id', id, 'kind', kind, 'status', status, 'error', error,
                'affected_items', coalesce(result -> 'affected_items', '[]'))
            FROM taxonomy_proposals WHERE id = pr.id);
END;
$$;

-- Apply several proposals in dependency order (creates → renames → moves → merges → item changes).
-- With p_atomic, any failure rolls the whole batch back; otherwise each proposal stands alone.
CREATE OR REPLACE FUNCTION apply_taxonomy_proposals(p_ids UUID[], p_atomic BOOLEAN DEFAULT FALSE)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, taxonomy_private AS $$
DECLARE
    v_id UUID;
    v_res JSONB;
    v_results JSONB := '[]';
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Only admins can apply taxonomy changes' USING ERRCODE = '42501';
    END IF;
    FOR v_id IN
        SELECT id FROM taxonomy_proposals WHERE id = ANY(p_ids)
        ORDER BY _tx_kind_order(kind), created_at, seq
    LOOP
        v_res := apply_taxonomy_proposal(v_id);
        IF p_atomic AND v_res ->> 'status' <> 'applied' THEN
            RAISE EXCEPTION 'Batch cancelled, nothing was changed. "%" failed: %',
                (SELECT summary FROM taxonomy_proposals WHERE id = v_id), v_res ->> 'error';
        END IF;
        v_results := v_results || v_res;
    END LOOP;
    RETURN v_results;
END;
$$;

-- Undo an applied proposal by replaying its undo log. Best effort: if later edits make that
-- impossible, nothing is changed and the reason is returned as an error.
CREATE OR REPLACE FUNCTION rollback_taxonomy_proposal(p_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, taxonomy_private AS $$
DECLARE
    pr taxonomy_proposals%ROWTYPE;
    v_dependent TEXT;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Only admins can roll back taxonomy changes' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO pr FROM taxonomy_proposals WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Proposal % not found', p_id;
    END IF;
    IF pr.status <> 'applied' THEN
        RAISE EXCEPTION 'Only applied changes can be undone (this one is %)', pr.status;
    END IF;
    IF pr.ref IS NOT NULL THEN
        SELECT summary INTO v_dependent FROM taxonomy_proposals d
        WHERE d.inspection_id = pr.inspection_id AND d.id <> pr.id AND d.status = 'applied'
          AND jsonb_path_exists(d.payload, '$.** ? (@.ref == $r)', jsonb_build_object('r', pr.ref))
        LIMIT 1;
        IF v_dependent IS NOT NULL THEN
            RAISE EXCEPTION 'Undo "%" first; it uses what this change created', v_dependent;
        END IF;
    END IF;

    PERFORM set_config('app.taxonomy_apply', 'on', TRUE);
    BEGIN
        PERFORM _tx_replay(pr.undo);
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Could not undo this change because the data has changed since: %', SQLERRM;
    END;
    UPDATE taxonomy_proposals SET status = 'rolled_back', rolled_back_at = NOW() WHERE id = pr.id;
    PERFORM set_config('app.taxonomy_apply', 'off', TRUE);

    RETURN jsonb_build_object('id', pr.id, 'status', 'rolled_back',
        'affected_items', coalesce(pr.result -> 'affected_items', '[]'));
END;
$$;

-- ============================================================================
-- Related content: show genuinely similar items, with a lower floor so sparse libraries still
-- get suggestions (the UI shows the similarity score).
-- ============================================================================

CREATE OR REPLACE FUNCTION related_content(
    p_item_type TEXT,
    p_item_id UUID,
    match_count INT DEFAULT 6,
    min_similarity FLOAT DEFAULT 0.4
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

-- ============================================================================
-- Grants
-- ============================================================================

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA taxonomy_private FROM PUBLIC;
-- Needed because the public functions run as the caller; the schema itself is not API-exposed.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA taxonomy_private TO authenticated;

GRANT EXECUTE ON FUNCTION is_admin, taxonomy_item_hashes, taxonomy_affected_items, taxonomy_snapshot,
    apply_taxonomy_proposal, apply_taxonomy_proposals, rollback_taxonomy_proposal, related_content TO authenticated;
GRANT SELECT ON taxonomy_inspection_summary TO authenticated;
