import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from './db';
import { ADMIN, OTHER, seedLibrary } from './fixtures';

let db: Db;
let ids: Record<string, string>;
let inspection: string;

async function one<T = Record<string, unknown>>(sql: string, params?: unknown[], user = ADMIN) {
  return (await db.as<T>(user, sql, params))[0];
}

async function propose(kind: string, payload: unknown, ref: string | null = null) {
  const row = await one<{ id: string }>(
    `INSERT INTO taxonomy_proposals (inspection_id, kind, ref, payload, summary, fingerprint)
     VALUES ($1, $2, $3, $4, $2, md5(random()::text)) RETURNING id`,
    [inspection, kind, ref, JSON.stringify(payload)]);
  return row.id;
}

const apply = (id: string) => one<{ status: string; error: string | null; affected_items: unknown[] }>(
  'SELECT r.* FROM jsonb_to_record(apply_taxonomy_proposal($1)) AS r(status text, error text, affected_items jsonb)', [id]);

/** Every taxonomy-relevant row of the admin, for before/after comparisons. */
async function userState() {
  const q = (sql: string) => db.admin(sql, [ADMIN]);
  return {
    categories: await q('SELECT id, name, description FROM categories WHERE user_id = $1 ORDER BY id'),
    subcategories: await q('SELECT id, name, category_id FROM subcategories WHERE user_id = $1 ORDER BY id'),
    tags: await q('SELECT id, name, category_id, subcategory_id FROM tags WHERE user_id = $1 ORDER BY id'),
    resources: await q('SELECT id, tags, subcategories FROM resources WHERE user_id = $1 ORDER BY id'),
    learning: await q('SELECT id, tags, subcategories FROM learning WHERE user_id = $1 ORDER BY id'),
    links: await db.admin(`
      SELECT 'lc' t, learning_id::text a, category_id::text b FROM learning_categories
      UNION ALL SELECT 'rc', resource_id::text, category_id::text FROM resource_categories
      UNION ALL SELECT 'ls', learning_id::text, subcategory_id::text FROM learning_subcategories
      UNION ALL SELECT 'rs', resource_id::text, subcategory_id::text FROM resource_subcategories
      UNION ALL SELECT 'lt', learning_id::text, tag_id::text FROM learning_tags
      UNION ALL SELECT 'rt', resource_id::text, tag_id::text FROM resource_tags
      ORDER BY 1, 2, 3`),
  };
}

beforeEach(async () => {
  db = await createDb();

  ids = await seedLibrary(db);
  inspection = (await one<{ id: string }>(`INSERT INTO taxonomy_inspections (mode) VALUES ('full') RETURNING id`)).id;
});

describe('access control', () => {
  it('hides inspection data from non-admins and refuses to apply', async () => {
    await db.admin(`INSERT INTO categories (user_id, name) VALUES ('${OTHER}', 'x')`);
    expect(await db.as(OTHER, 'SELECT * FROM taxonomy_inspections')).toHaveLength(0);
    await expect(db.as(OTHER, `INSERT INTO taxonomy_inspections (mode) VALUES ('full')`)).rejects.toThrow(/row-level security/);
    const pid = await propose('rename_category', { category_id: ids.azure, new_name: 'Azure Cloud' });
    await expect(db.as(OTHER, 'SELECT apply_taxonomy_proposal($1)', [pid])).rejects.toThrow(/Only admins/);
    expect(await db.as(OTHER, 'SELECT is_admin() AS a')).toEqual([{ a: false }]);
  });

  it("cannot touch another user's records even with a forged id", async () => {
    const pid = await propose('rename_category', { category_id: ids.otherCat, new_name: 'Hijacked' });
    const res = await apply(pid);
    expect(res.status).toBe('failed');
    expect(res.error).toMatch(/no longer exists/);
    expect((await db.admin<{ name: string }>('SELECT name FROM categories WHERE id = $1', [ids.otherCat]))[0].name).toBe('Other user category');
  });

  it('keeps the engine internals out of the public schema', async () => {
    const exposed = await db.admin("SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND proname LIKE '\\_tx\\_%'");
    expect(exposed).toEqual([]);
  });
});

describe('merge_categories', () => {
  it('folds a duplicate category into the target without losing or duplicating anything', async () => {
    const pid = await propose('merge_categories', { target: { id: ids.azure }, source_ids: [ids.mac] });
    const res = await apply(pid);
    expect(res).toMatchObject({ status: 'applied', error: null });

    const s = await userState();
    expect(s.categories.map((c) => c.name).sort()).toEqual(['Azure', 'Kubernetes']);
    // " functions " merged into "Functions"; AKS re-parented
    expect(s.subcategories.map((x) => [x.name, x.category_id]).sort()).toEqual([['AKS', ids.azure], ['Functions', ids.azure]]);
    // duplicate tags merged, legacy k8s tag kept (not cascade-deleted) and detached from the old category
    expect(s.tags.map((t) => t.name).sort()).toEqual(['Cloud', 'k8s', 'serverless']);
    expect(s.tags.find((t) => t.name === 'k8s')).toMatchObject({ subcategory_id: ids.aks, category_id: null });

    const links = s.links.map((l) => `${l.t}:${l.a}:${l.b}`);
    expect(links).toContain(`lc:${ids.l1}:${ids.azure}`);
    expect(links).toContain(`ls:${ids.l1}:${ids.fnAzure}`);
    expect(links).toContain(`lt:${ids.l1}:${ids.tServerless}`);
    expect(links).toContain(`rc:${ids.r1}:${ids.azure}`);
    // legacy arrays the UI reads are rewritten too
    expect(s.learning[0]).toMatchObject({ tags: ['serverless'], subcategories: [ids.fnAzure] });

    const affected = (res.affected_items as { id: string }[]).map((a) => a.id).sort();
    expect(affected).toEqual([ids.l1, ids.r1].sort());
  });

  it('rolls back to exactly the previous state', async () => {
    const before = await userState();
    const pid = await propose('merge_categories', { target: { id: ids.azure }, source_ids: [ids.mac], new_name: 'Microsoft Azure' });
    expect((await apply(pid)).status).toBe('applied');
    expect(await userState()).not.toEqual(before);

    const rb = await one<{ r: { status: string } }>('SELECT rollback_taxonomy_proposal($1) AS r', [pid]);
    expect(rb.r.status).toBe('rolled_back');
    expect(await userState()).toEqual(before);
    await expect(db.as(ADMIN, 'SELECT rollback_taxonomy_proposal($1)', [pid])).rejects.toThrow(/Only applied/);
  });
});

describe('dependencies, ordering and batches', () => {
  it('resolves refs to newly created entities and refuses to run out of order', async () => {
    const create = await propose('create_category', { name: 'Cloud Native' }, 'cloud-native');
    const reassign = await propose('reassign_item', {
      item_type: 'resource', item_id: ids.r1, add_categories: [{ ref: 'cloud-native' }], remove_category_ids: [ids.mac],
    });
    const early = await apply(reassign);
    expect(early.status).toBe('failed');
    expect(early.error).toMatch(/has not been applied yet/);

    const out = await one<{ r: { status: string }[] }>('SELECT apply_taxonomy_proposals($1) AS r', [[reassign, create]]);
    expect(out.r.map((x) => x.status)).toEqual(['applied', 'applied']);
    const cats = await db.as<{ name: string }>(ADMIN, `SELECT c.name FROM resource_categories x JOIN categories c ON c.id = x.category_id WHERE x.resource_id = $1`, [ids.r1]);
    expect(cats.map((c) => c.name)).toEqual(['Cloud Native']);
    // removing the category also removed the item's subcategory inside it
    expect(await db.as(ADMIN, 'SELECT * FROM resource_subcategories WHERE resource_id = $1', [ids.r1])).toEqual([]);
    expect((await db.admin<{ subcategories: string[] }>('SELECT subcategories FROM resources WHERE id = $1', [ids.r1]))[0].subcategories).toEqual([]);

    await expect(db.as(ADMIN, 'SELECT rollback_taxonomy_proposal($1)', [create])).rejects.toThrow(/Undo .* first/);
  });

  it('reuses an existing category instead of creating a duplicate', async () => {
    const res = await apply(await propose('create_category', { name: '  azure ' }, 'az'));
    expect(res.status).toBe('applied');
    expect(await db.as(ADMIN, "SELECT * FROM categories WHERE lower(name) = 'azure'")).toHaveLength(1);
  });

  it('atomic batches change nothing when any proposal fails', async () => {
    const before = await userState();
    const good = await propose('rename_category', { category_id: ids.k8s, new_name: 'Kubernetes & Containers' });
    const bad = await propose('rename_category', { category_id: ids.mac, new_name: 'azure' }); // collides with "Azure"
    await expect(db.as(ADMIN, 'SELECT apply_taxonomy_proposals($1, TRUE)', [[good, bad]])).rejects.toThrow(/Batch cancelled.*merge instead/);
    expect(await userState()).toEqual(before);

    // non-atomic: the good one still applies, the bad one is recorded as failed
    const out = await one<{ r: { status: string; error: string }[] }>('SELECT apply_taxonomy_proposals($1) AS r', [[good, bad]]);
    expect(out.r.map((x) => x.status).sort()).toEqual(['applied', 'failed']);
    expect((await db.as<{ status: string; error: string }>(ADMIN, 'SELECT status, error FROM taxonomy_proposals WHERE id = $1', [bad]))[0].error).toMatch(/merge instead/);
  });
});

describe('item changes', () => {
  it('reuses existing tags, keeps the legacy array in sync, and removes tags', async () => {
    const pid = await propose('set_item_tags', {
      item_type: 'resource', item_id: ids.r1,
      add_tags: [{ name: 'SERVERLESS', subcategory: { id: ids.fnAzure } }, { name: 'networking', subcategory: { id: ids.aks } }],
      remove_tag_ids: [ids.tK8sLegacy],
    });
    expect((await apply(pid)).status).toBe('applied');
    const tags = await db.as<{ name: string }>(ADMIN, 'SELECT t.name FROM resource_tags x JOIN tags t ON t.id = x.tag_id WHERE x.resource_id = $1 ORDER BY 1', [ids.r1]);
    expect(tags.map((t) => t.name)).toEqual(['networking', 'serverless']);
    expect(await db.as(ADMIN, "SELECT * FROM tags WHERE lower(name) = 'serverless' AND subcategory_id = $1", [ids.fnAzure])).toHaveLength(1);
    expect((await db.admin<{ tags: string[] }>('SELECT tags FROM resources WHERE id = $1', [ids.r1]))[0].tags).toEqual(['serverless', 'networking']);
  });

  it('refuses to leave an item uncategorised', async () => {
    const res = await apply(await propose('reassign_item', { item_type: 'resource', item_id: ids.r2, remove_category_ids: [ids.azure] }));
    expect(res.status).toBe('failed');
    expect(res.error).toMatch(/without any category/);
  });
});

describe('proposal integrity', () => {
  it('blocks editing payloads and forging applied status', async () => {
    const pid = await propose('rename_category', { category_id: ids.k8s, new_name: 'K8s' });
    await expect(db.as(ADMIN, `UPDATE taxonomy_proposals SET payload = '{}' WHERE id = $1`, [pid])).rejects.toThrow(/cannot be edited/);
    await expect(db.as(ADMIN, `UPDATE taxonomy_proposals SET status = 'applied' WHERE id = $1`, [pid])).rejects.toThrow(/Cannot change/);
    await db.as(ADMIN, `UPDATE taxonomy_proposals SET status = 'rejected' WHERE id = $1`, [pid]);
    expect((await one<{ status: string; decided_at: string }>('SELECT status, decided_at FROM taxonomy_proposals WHERE id = $1', [pid]))).toMatchObject({ status: 'rejected' });
  });
});

describe('incremental change detection', () => {
  it('only reports items affected by content or taxonomy changes', async () => {
    const all = await db.as<{ item_id: string; content_hash: string }>(ADMIN, 'SELECT * FROM taxonomy_affected_items(FALSE)');
    expect(all).toHaveLength(3); // never inspected; other user's item is invisible
    for (const it of all) {
      await db.as(ADMIN, `INSERT INTO taxonomy_item_state (item_type, item_id, content_hash) SELECT item_type, item_id, content_hash FROM taxonomy_affected_items(FALSE) WHERE item_id = $1`, [it.item_id]);
    }
    expect(await db.as(ADMIN, 'SELECT * FROM taxonomy_affected_items(FALSE)')).toHaveLength(0);
    expect(await db.as(ADMIN, 'SELECT * FROM taxonomy_affected_items(TRUE)')).toHaveLength(3);

    // renaming a tag used only by r2 re-surfaces just r2
    await apply(await propose('rename_tag', { tag_id: ids.tServerless, new_name: 'Serverless computing' }));
    expect((await db.as<{ item_id: string }>(ADMIN, 'SELECT item_id FROM taxonomy_affected_items(FALSE)')).map((r) => r.item_id)).toEqual([ids.r2]);

    // moving AKS to Kubernetes re-surfaces r1 as well
    await apply(await propose('move_subcategory', { subcategory_id: ids.aks, to_category: { id: ids.k8s } }));
    expect((await db.as<{ item_id: string }>(ADMIN, 'SELECT item_id FROM taxonomy_affected_items(FALSE) ORDER BY 1')).map((r) => r.item_id).sort()).toEqual([ids.r1, ids.r2].sort());
  });

  it('snapshots the structure with usage counts', async () => {
    const snap = (await one<{ s: { categories: { name: string; item_count: number; subcategories: unknown[] }[]; total_items: number } }>('SELECT taxonomy_snapshot() AS s')).s;
    expect(snap.total_items).toBe(3);
    expect(snap.categories.map((c) => [c.name, c.item_count])).toEqual([['Azure', 1], ['Kubernetes', 0], ['Microsoft Azure Cloud', 2]]);
  });
});
