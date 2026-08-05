import { supabase, type Category, type Subcategory, type Tag } from './supabase';

// ---------------------------------------------------------------------------
// Dashboard data shapes
// ---------------------------------------------------------------------------

export interface DashboardResource {
  id: string;
  title: string;
  url: string;
  category_ids: string[];
  subcategory_ids: string[];
}

export interface DashboardLearning {
  id: string;
  title: string;
  url: string;
  difficulty_level: string;
  category_ids: string[];
  subcategory_ids: string[];
}

export interface DashboardData {
  categories: Category[];
  subcategories: Subcategory[];
  tags: Tag[];
  resources: DashboardResource[];
  learning: DashboardLearning[];
}

// ---------------------------------------------------------------------------
// Chunked junction-table fetcher
// ---------------------------------------------------------------------------
// WHY chunking:  PostgREST serialises .in() into a URL query string:
//   ?id=in.(uuid1,uuid2,...)
// At ~150+ UUIDs (each 36 chars + comma) the URL exceeds the default
// nginx/PostgREST limit (~8 KB) and the query silently returns 0 rows.
// We split into chunks of CHUNK_SIZE to stay well under that ceiling.
//
// WHY explicit .limit():  Supabase JS client defaults to 1 000 rows per
// request.  With 100 IDs and potentially many junction rows per ID the
// default can silently truncate.  We set CHUNK_SIZE * 50 as a ceiling
// (100 × 50 = 5 000 rows) — far above any realistic fan-out.
// ---------------------------------------------------------------------------

const CHUNK_SIZE = 100; // IDs per chunk — safe URL length + row budget

async function fetchChunked<T>(
  ids: string[],
  buildQuery: (chunk: string[]) => any
): Promise<T[]> {
  if (ids.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + CHUNK_SIZE));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      // Apply explicit limit to override the Supabase 1 000-row default.
      const res = await buildQuery(chunk).limit(CHUNK_SIZE * 50);
      if (res.error) {
        console.error('[taxonomyDashboard] fetchChunked error:', res.error);
        throw res.error;
      }
      return (res.data || []) as T[];
    })
  );

  return results.flat();
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  // ── Phase 1: user-scoped base entities ─────────────────────────────────────
  // These tables have a user_id column so the filter is direct; no chunking needed.
  const [categoriesRes, subcategoriesRes, tagsRes, resourcesRes, learningRes] = await Promise.all([
    supabase.from('categories').select('*').eq('user_id', userId).order('name').limit(5000),
    supabase.from('subcategories').select('*').eq('user_id', userId).order('name').limit(5000),
    supabase.from('tags').select('*').eq('user_id', userId).order('name').limit(10000),
    supabase.from('resources').select('id, title, url').eq('user_id', userId).order('title').limit(5000),
    supabase.from('learning').select('id, title, url, difficulty_level').eq('user_id', userId).order('title').limit(5000),
  ]);

  if (categoriesRes.error) throw categoriesRes.error;
  if (subcategoriesRes.error) throw subcategoriesRes.error;
  if (tagsRes.error) throw tagsRes.error;
  if (resourcesRes.error) throw resourcesRes.error;
  if (learningRes.error) throw learningRes.error;

  const rawResources = resourcesRes.data || [];
  const rawLearning  = learningRes.data  || [];
  const resourceIds  = rawResources.map((r: any) => r.id as string);
  const learningIds  = rawLearning.map((l: any) => l.id as string);

  // ── Phase 2: junction tables (no user_id — must filter by owned IDs) ────────
  // fetchChunked splits into 100-ID batches with an explicit per-batch .limit()
  // so neither URL-length nor the 1 000-row default can silently truncate rows.
  const [
    resourceCatRows,
    resourceSubRows,
    learningCatRows,
    learningSubRows,
  ] = await Promise.all([
    fetchChunked<{ resource_id: string; category_id: string }>(
      resourceIds,
      (chunk) => supabase.from('resource_categories').select('resource_id, category_id').in('resource_id', chunk)
    ),
    fetchChunked<{ resource_id: string; subcategory_id: string }>(
      resourceIds,
      (chunk) => supabase.from('resource_subcategories').select('resource_id, subcategory_id').in('resource_id', chunk)
    ),
    fetchChunked<{ learning_id: string; category_id: string }>(
      learningIds,
      (chunk) => supabase.from('learning_categories').select('learning_id, category_id').in('learning_id', chunk)
    ),
    fetchChunked<{ learning_id: string; subcategory_id: string }>(
      learningIds,
      (chunk) => supabase.from('learning_subcategories').select('learning_id, subcategory_id').in('learning_id', chunk)
    ),
  ]);

  // DEV-only summary: shows exact row counts in browser DevTools console.
  // If any count is 0 when you expect rows, a query is silently failing.
  if (import.meta.env.DEV) {
    console.group('[TaxonomyDashboard] getDashboardData');
    console.table({
      categories:  { fetched: (categoriesRes.data || []).length },
      subcategories: { fetched: (subcategoriesRes.data || []).length },
      tags:        { fetched: (tagsRes.data || []).length },
      resources:   { fetched: rawResources.length, rc_rows: resourceCatRows.length, rs_rows: resourceSubRows.length },
      learning:    { fetched: rawLearning.length,  lc_rows: learningCatRows.length, ls_rows: learningSubRows.length },
    });
    console.groupEnd();
  }

  // ── Phase 3: build ID→[associated-ids] lookup maps ──────────────────────────
  const resourceCatMap: Record<string, string[]> = {};
  resourceCatRows.forEach(({ resource_id, category_id }) => {
    (resourceCatMap[resource_id] ??= []).push(category_id);
  });

  const resourceSubMap: Record<string, string[]> = {};
  resourceSubRows.forEach(({ resource_id, subcategory_id }) => {
    (resourceSubMap[resource_id] ??= []).push(subcategory_id);
  });

  const learningCatMap: Record<string, string[]> = {};
  learningCatRows.forEach(({ learning_id, category_id }) => {
    (learningCatMap[learning_id] ??= []).push(category_id);
  });

  const learningSubMap: Record<string, string[]> = {};
  learningSubRows.forEach(({ learning_id, subcategory_id }) => {
    (learningSubMap[learning_id] ??= []).push(subcategory_id);
  });

  // ── Phase 4: assemble typed arrays ──────────────────────────────────────────
  const resources: DashboardResource[] = rawResources.map((r: any) => ({
    id: r.id,
    title: r.title,
    url: r.url,
    category_ids: resourceCatMap[r.id] ?? [],
    subcategory_ids: resourceSubMap[r.id] ?? [],
  }));

  const learning: DashboardLearning[] = rawLearning.map((l: any) => ({
    id: l.id,
    title: l.title,
    url: l.url,
    difficulty_level: l.difficulty_level,
    category_ids: learningCatMap[l.id] ?? [],
    subcategory_ids: learningSubMap[l.id] ?? [],
  }));

  return {
    categories: categoriesRes.data ?? [],
    subcategories: subcategoriesRes.data ?? [],
    tags: tagsRes.data ?? [],
    resources,
    learning,
  };
}

// ---------------------------------------------------------------------------
// Tag assignment mutations (copy semantics — tag is assigned to target too)
// ---------------------------------------------------------------------------

/** Assign (copy) a tag by name to a subcategory. Idempotent. */
export async function assignTagToSubcategory(
  userId: string,
  tagName: string,
  targetSubcategoryId: string
): Promise<Tag> {
  const { data, error } = await supabase
    .from('tags')
    .upsert(
      [{ user_id: userId, subcategory_id: targetSubcategoryId, name: tagName.trim() }],
      { onConflict: 'user_id,subcategory_id,name', ignoreDuplicates: false }
    )
    .select('*')
    .single();
  if (error) throw error;
  return data as Tag;
}

/** Assign (copy) a tag by name to a category (category-level tag). Idempotent. */
export async function assignTagToCategory(
  userId: string,
  tagName: string,
  targetCategoryId: string
): Promise<Tag> {
  const { data, error } = await supabase
    .from('tags')
    .upsert(
      [{ user_id: userId, category_id: targetCategoryId, name: tagName.trim() }],
      { onConflict: 'user_id,category_id,name', ignoreDuplicates: false }
    )
    .select('*')
    .single();
  if (error) throw error;
  return data as Tag;
}

// ---------------------------------------------------------------------------
// Item assignment mutations (additive — existing associations are kept)
// ---------------------------------------------------------------------------

/** Add a resource → category association (idempotent). */
export async function assignResourceToCategory(
  resourceId: string,
  targetCategoryId: string
): Promise<void> {
  const { error } = await supabase
    .from('resource_categories')
    .upsert(
      [{ resource_id: resourceId, category_id: targetCategoryId }],
      { onConflict: 'resource_id,category_id', ignoreDuplicates: true }
    );
  if (error) throw error;
}

/** Add a learning item → category association (idempotent). */
export async function assignLearningToCategory(
  learningId: string,
  targetCategoryId: string
): Promise<void> {
  const { error } = await supabase
    .from('learning_categories')
    .upsert(
      [{ learning_id: learningId, category_id: targetCategoryId }],
      { onConflict: 'learning_id,category_id', ignoreDuplicates: true }
    );
  if (error) throw error;
}

/** Add a resource → subcategory association (idempotent). */
export async function assignResourceToSubcategory(
  resourceId: string,
  targetSubcategoryId: string
): Promise<void> {
  const { error } = await supabase
    .from('resource_subcategories')
    .upsert(
      [{ resource_id: resourceId, subcategory_id: targetSubcategoryId }],
      { onConflict: 'resource_id,subcategory_id', ignoreDuplicates: true }
    );
  if (error) throw error;
}

/** Add a learning item → subcategory association (idempotent). */
export async function assignLearningToSubcategory(
  learningId: string,
  targetSubcategoryId: string
): Promise<void> {
  const { error } = await supabase
    .from('learning_subcategories')
    .upsert(
      [{ learning_id: learningId, subcategory_id: targetSubcategoryId }],
      { onConflict: 'learning_id,subcategory_id', ignoreDuplicates: true }
    );
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// TRUE MOVE mutations — removes old association, inserts new one
//
// Strategy: INSERT new FIRST (safety-first), then DELETE all OTHER associations.
// If DELETE fails, item appears in both places (harmless).
// If INSERT fails, nothing changes (no data loss).
//
// Tags are stored directly on the tags row (subcategory_id / category_id column)
// so moving a tag is a single UPDATE — no junction table involved.
//
// Resources and Learning use junction tables so we INSERT then clean up old rows.
// ---------------------------------------------------------------------------

/**
 * Move a tag to a new subcategory or category.
 * Updates the tag's subcategory_id/category_id in-place.
 * The tag keeps its ID, name, and description.
 */
export async function moveTagTo(
  tagId: string,
  toKind: 'category' | 'subcategory',
  toId: string
): Promise<void> {
  const update =
    toKind === 'subcategory'
      ? { subcategory_id: toId, category_id: null }
      : { category_id: toId, subcategory_id: null };

  const { error } = await supabase
    .from('tags')
    .update(update)
    .eq('id', tagId);
  if (error) throw error;
}

/**
 * Move a resource to a new category or subcategory.
 * Inserts the new association, then deletes all old category AND subcategory
 * associations for this resource (leaving only the new one).
 */
export async function moveResourceTo(
  resourceId: string,
  toKind: 'category' | 'subcategory',
  toId: string
): Promise<void> {
  // 1. Insert new association first (safety: destination exists before old is gone)
  if (toKind === 'subcategory') {
    const { error } = await supabase
      .from('resource_subcategories')
      .upsert([{ resource_id: resourceId, subcategory_id: toId }], {
        onConflict: 'resource_id,subcategory_id',
        ignoreDuplicates: true,
      });
    if (error) throw error;

    // 2. Remove all category associations
    const { error: e2 } = await supabase
      .from('resource_categories')
      .delete()
      .eq('resource_id', resourceId);
    if (e2) throw e2;

    // 3. Remove all OTHER subcategory associations
    const { error: e3 } = await supabase
      .from('resource_subcategories')
      .delete()
      .eq('resource_id', resourceId)
      .neq('subcategory_id', toId);
    if (e3) throw e3;
  } else {
    const { error } = await supabase
      .from('resource_categories')
      .upsert([{ resource_id: resourceId, category_id: toId }], {
        onConflict: 'resource_id,category_id',
        ignoreDuplicates: true,
      });
    if (error) throw error;

    // 2. Remove all subcategory associations
    const { error: e2 } = await supabase
      .from('resource_subcategories')
      .delete()
      .eq('resource_id', resourceId);
    if (e2) throw e2;

    // 3. Remove all OTHER category associations
    const { error: e3 } = await supabase
      .from('resource_categories')
      .delete()
      .eq('resource_id', resourceId)
      .neq('category_id', toId);
    if (e3) throw e3;
  }
}

/**
 * Move a learning item to a new category or subcategory.
 * Same INSERT-first, then DELETE-old strategy as moveResourceTo.
 */
export async function moveLearningTo(
  learningId: string,
  toKind: 'category' | 'subcategory',
  toId: string
): Promise<void> {
  if (toKind === 'subcategory') {
    const { error } = await supabase
      .from('learning_subcategories')
      .upsert([{ learning_id: learningId, subcategory_id: toId }], {
        onConflict: 'learning_id,subcategory_id',
        ignoreDuplicates: true,
      });
    if (error) throw error;

    const { error: e2 } = await supabase
      .from('learning_categories')
      .delete()
      .eq('learning_id', learningId);
    if (e2) throw e2;

    const { error: e3 } = await supabase
      .from('learning_subcategories')
      .delete()
      .eq('learning_id', learningId)
      .neq('subcategory_id', toId);
    if (e3) throw e3;
  } else {
    const { error } = await supabase
      .from('learning_categories')
      .upsert([{ learning_id: learningId, category_id: toId }], {
        onConflict: 'learning_id,category_id',
        ignoreDuplicates: true,
      });
    if (error) throw error;

    const { error: e2 } = await supabase
      .from('learning_subcategories')
      .delete()
      .eq('learning_id', learningId);
    if (e2) throw e2;

    const { error: e3 } = await supabase
      .from('learning_categories')
      .delete()
      .eq('learning_id', learningId)
      .neq('category_id', toId);
    if (e3) throw e3;
  }
}
