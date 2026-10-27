// End-to-end: the real taxonomy-inspector Edge Function code, against the real schema (PGlite),
// with Gemini mocked.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb, type Db } from './db';
import { ADMIN, OTHER, seedLibrary } from './fixtures';
import { testClient } from './postgrest';
import { indexTaxonomy, type Snapshot } from '../functions/_shared/taxonomy';

type Handler = (req: Request) => Promise<Response>;
type Reply = (prompt: string) => unknown | Response;

let handler: Handler;
const background: Promise<unknown>[] = [];
let db: Db;
let ids: Record<string, string>;
let structureReply: Reply;
let itemsReply: Reply;
const calls = { structure: 0, items: 0 };

vi.stubGlobal('Deno', {
  env: { get: (k: string) => ({ GEMINI_API_KEY: 'test-key', SUPABASE_URL: 'http://db', SUPABASE_ANON_KEY: 'anon' } as Record<string, string>)[k] },
  serve: (h: Handler) => { handler = h; },
});
vi.stubGlobal('EdgeRuntime', { waitUntil: (p: Promise<unknown>) => background.push(p) });
vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
  const body = JSON.parse(init.body as string);
  const isStructure = body.systemInstruction.parts[0].text.includes('information architect');
  const prompt = body.contents.at(-1).parts[0].text as string;
  calls[isStructure ? 'structure' : 'items']++;
  const out = (isStructure ? structureReply : itemsReply)(prompt);
  if (out instanceof Response) return out;
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }] }));
});

beforeAll(async () => {
  await import('../functions/taxonomy-inspector/index.ts');
});

beforeEach(async () => {
  db = await createDb();
  ids = await seedLibrary(db);
  globalThis.__clientFor = (auth: string) => testClient(db, auth.replace(/^Bearer /, ''));
  calls.structure = calls.items = 0;
  structureReply = () => ({ summary: '', proposals: [] });
  itemsReply = () => ({ proposals: [] });
});
afterEach(() => { background.length = 0; });

async function call(body: unknown, user = ADMIN) {
  const res = await handler(new Request('http://fn', { method: 'POST', headers: { Authorization: `Bearer ${user}` }, body: JSON.stringify(body) }));
  const data = await res.json();
  await Promise.all(background.splice(0)); // let the background run finish
  return { status: res.status, data };
}

const inspection = async (id: string) => (await db.as<Record<string, unknown>>(ADMIN, 'SELECT * FROM taxonomy_inspections WHERE id = $1', [id]))[0];
const proposals = (id: string) => db.as<{ kind: string; status: string; summary: string; id: string }>(ADMIN, 'SELECT * FROM taxonomy_proposals WHERE inspection_id = $1 ORDER BY seq', [id]);

/** Alias of a node by name, as the model sees it for the current taxonomy. */
async function aliasOf(name: string) {
  const snap = (await db.as<{ s: Snapshot }>(ADMIN, 'SELECT taxonomy_snapshot() AS s'))[0].s;
  return indexTaxonomy(snap).nodes.find((n) => n.name === name)!.alias;
}
const itemAlias = (prompt: string, title: string) => prompt.match(new RegExp(`(I\\d+) \\[\\w+[^\\]]*\\] "${title}"`))![1];

describe('taxonomy-inspector', () => {
  it('refuses non-admins', async () => {
    const res = await call({ action: 'start', mode: 'full' }, OTHER);
    expect(res.status).toBe(403);
  });

  it('runs a full inspection end to end and its proposals apply cleanly', async () => {
    const [azure, mac, k8s, aks] = await Promise.all(['Azure', 'Microsoft Azure Cloud', 'Kubernetes', 'AKS'].map(aliasOf));
    structureReply = () => ({
      summary: 'Two Azure categories',
      proposals: [
        { kind: 'merge_categories', target: azure, sources: [mac], rationale: 'Same cloud provider', confidence: 0.95 },
        { kind: 'rename_category', target: 'C99', name: 'Ghost', rationale: 'hallucinated', confidence: 0.9 },
      ],
    });
    itemsReply = (prompt) => ({
      proposals: [{
        item: itemAlias(prompt, 'AKS networking'),
        add_categories: [k8s],
        new_tags: [{ name: 'networking', location: aks }],
        rationale: 'AKS is managed Kubernetes', confidence: 0.85,
      }],
    });

    const res = await call({ action: 'start', mode: 'full' });
    expect(res.status).toBe(200);
    const insp = await inspection(res.data.inspection_id);
    expect(insp).toMatchObject({ status: 'completed', mode: 'full', item_count: 3, items_processed: 3, structure_done: true });
    expect(insp.summary).toBe('Recommended 1 merge, 1 item reassignment, 1 tag update.');
    expect((insp.stats as { dropped: number }).dropped).toBe(1);
    expect((insp.current_structure as Snapshot).categories).toHaveLength(3);

    const ps = await proposals(res.data.inspection_id);
    expect(ps.map((p) => p.kind)).toEqual(['merge_categories', 'reassign_item', 'set_item_tags']);
    expect(ps[1].summary).toBe('“AKS networking”: add to “Kubernetes”');
    expect(await db.as(ADMIN, 'SELECT * FROM taxonomy_item_state')).toHaveLength(3);

    const applied = (await db.as<{ r: { status: string }[] }>(ADMIN, 'SELECT apply_taxonomy_proposals($1) AS r', [ps.map((p) => p.id)]))[0].r;
    expect(applied.map((a) => a.status)).toEqual(['applied', 'applied', 'applied']);
    const cats = await db.as<{ name: string }>(ADMIN, 'SELECT c.name FROM resource_categories x JOIN categories c ON c.id = x.category_id WHERE x.resource_id = $1 ORDER BY 1', [ids.r1]);
    expect(cats.map((c) => c.name)).toEqual(['Azure', 'Kubernetes']);
  });

  it('incremental runs skip unchanged libraries and only revisit affected items', async () => {
    const first = await call({ action: 'start', mode: 'full' });
    expect((await inspection(first.data.inspection_id)).status).toBe('completed');

    const noop = await call({ action: 'start', mode: 'incremental' });
    expect(noop.data.nothing_to_do).toBe(true);
    expect((await inspection(noop.data.inspection_id)).summary).toMatch(/Nothing new/);

    // rename a tag used only by "Functions pricing" → only that item is in scope next time
    await db.admin(`UPDATE tags SET name = 'Serverless Computing' WHERE id = $1`, [ids.tServerless]);
    let seenTitles: string[] = [];
    itemsReply = (prompt) => { seenTitles = [...prompt.matchAll(/\] "([^"]+)"/g)].map((m) => m[1]); return { proposals: [] }; };
    const inc = await call({ action: 'start', mode: 'incremental' });
    const insp = await inspection(inc.data.inspection_id);
    expect(insp).toMatchObject({ status: 'completed', mode: 'incremental', item_count: 1 });
    expect(seenTitles).toEqual(['Functions pricing']);
  });

  it('does not re-suggest rejected recommendations', async () => {
    const [azure, mac] = await Promise.all(['Azure', 'Microsoft Azure Cloud'].map(aliasOf));
    structureReply = () => ({ summary: '', proposals: [{ kind: 'merge_categories', target: azure, sources: [mac], rationale: 'dup', confidence: 0.9 }] });
    const first = await call({ action: 'start', mode: 'full' });
    const [merge] = await proposals(first.data.inspection_id);
    await db.as(ADMIN, `UPDATE taxonomy_proposals SET status = 'rejected' WHERE id = $1`, [merge.id]);

    const second = await call({ action: 'start', mode: 'full' });
    expect(await proposals(second.data.inspection_id)).toEqual([]);
    expect(((await inspection(second.data.inspection_id)).stats as { dropped: number }).dropped).toBe(1);
  });

  it('records failures and resumes from its checkpoint', async () => {
    itemsReply = () => new Response('bad request', { status: 400 });
    const res = await call({ action: 'start', mode: 'full' });
    const failed = await inspection(res.data.inspection_id);
    expect(failed).toMatchObject({ status: 'failed', error: 'AI provider error', structure_done: true, items_processed: 0 });
    expect((failed.log as { level: string }[]).some((l) => l.level === 'error')).toBe(true);
    expect(calls.structure).toBe(1);

    itemsReply = () => ({ proposals: [] });
    const resumed = await call({ action: 'resume', inspection_id: res.data.inspection_id });
    expect(resumed.data.resumed).toBe(true);
    expect(await inspection(res.data.inspection_id)).toMatchObject({ status: 'completed', items_processed: 3, attempts: 2 });
    expect(calls.structure).toBe(1); // structure analysis was not repeated
  });

  it('retries transient AI errors', async () => {
    let n = 0;
    itemsReply = () => (++n === 1 ? new Response('busy', { status: 503 }) : { proposals: [] });
    const res = await call({ action: 'start', mode: 'full' });
    expect((await inspection(res.data.inspection_id)).status).toBe('completed');
    expect(calls.items).toBe(2);
  });

  it('will not start a second inspection while one is running', async () => {
    await db.as(ADMIN, `INSERT INTO taxonomy_inspections (mode, status, heartbeat_at) VALUES ('full', 'running', now())`);
    const res = await call({ action: 'start', mode: 'full' });
    expect(res.data.already_running).toBe(true);
    expect(calls.structure).toBe(0);
  });
});
