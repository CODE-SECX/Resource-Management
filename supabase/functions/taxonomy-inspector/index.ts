// AI Library Organizer: inspects the caller's taxonomy and items with Gemini and stores reviewable,
// validated change proposals. Applying them is done by the database (apply_taxonomy_proposals),
// never here: this function only reads data and writes inspection records.
//
// Actions (POST JSON, admin only):
//   { action: "start", mode: "full" | "incremental" }  → creates an inspection and runs it in the background
//   { action: "resume", inspection_id }                → continues an interrupted / paused inspection
//
// Runs are chunked and checkpointed (taxonomy_inspection_items.processed), so a run that hits the
// Edge Function time limit pauses itself and the admin UI resumes it automatically.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { GEMINI_API_KEY, GEMINI_MODEL, HttpError, generateJson, htmlToText } from '../_shared/gemini.ts';
import { corsHeaders, errorResponse, json, userClient } from '../_shared/http.ts';
import {
  ITEMS_SCHEMA, ITEMS_SYSTEM_PROMPT, STRUCTURE_SCHEMA, STRUCTURE_SYSTEM_PROMPT,
  indexTaxonomy, planFromDrafts, renderTaxonomy, structureSignature, summarize,
  validateItems, validateStructure,
  type Draft, type ItemContext, type ProposalKind, type RawItemProposal, type RawStructureProposal,
  type Snapshot, type StructurePlan, type TaxonomyIndex,
} from '../_shared/taxonomy.ts';

const CHUNK_SIZE = 20;          // items per model call
const TIME_BUDGET_MS = 110_000; // pause before the platform's wall-clock limit
const STALE_AFTER_MS = 90_000;  // a "running" inspection without a heartbeat for this long is resumable
const ITEM_TEXT_CHARS = 900;

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
const background = (p: Promise<unknown>) => (typeof EdgeRuntime !== 'undefined' ? EdgeRuntime.waitUntil(p) : p);

interface Inspection {
  id: string;
  mode: 'full' | 'incremental';
  status: string;
  analyze_structure: boolean;
  structure_done: boolean;
  current_structure: Snapshot;
  items_processed: number;
  item_count: number;
  stats: Record<string, unknown>;
  log: { at: string; level: string; message: string }[];
  attempts: number;
  started_at: string | null;
  heartbeat_at: string | null;
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const must = <T>({ data, error }: { data: T | null; error: { message: string } | null }, what: string): T => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data as T;
};

// ---------------------------------------------------------------------------
// Start / resume
// ---------------------------------------------------------------------------

async function start(db: SupabaseClient, mode: 'full' | 'incremental') {
  // Don't run two inspections at once.
  const active = must(await db.from('taxonomy_inspections').select('id, status, heartbeat_at, created_at')
    .in('status', ['queued', 'running']).order('created_at', { ascending: false }).limit(1), 'load active');
  if (active?.length) {
    const a = active[0];
    const last = new Date(a.heartbeat_at ?? a.created_at).getTime();
    if (Date.now() - last < STALE_AFTER_MS) return { inspection_id: a.id, already_running: true };
    background(run(db, a.id));
    return { inspection_id: a.id, resumed: true };
  }

  const [scope, snapshot, last] = await Promise.all([
    db.rpc('taxonomy_affected_items', { p_full: mode === 'full' }).then((r) => must(r, 'affected items') as { item_type: string; item_id: string; content_hash: string; is_new: boolean }[]),
    db.rpc('taxonomy_snapshot').then((r) => must(r, 'snapshot') as Snapshot),
    db.from('taxonomy_inspections').select('structure_fingerprint').eq('status', 'completed').eq('structure_done', true)
      .order('created_at', { ascending: false }).limit(1).then((r) => must(r, 'last inspection')),
  ]);

  const fingerprint = await sha256(structureSignature(snapshot));
  const structureChanged = last?.[0]?.structure_fingerprint !== fingerprint;
  const analyzeStructure = mode === 'full' || structureChanged || scope.some((s) => s.is_new);

  const inspection = must(await db.from('taxonomy_inspections').insert({
    mode,
    model: GEMINI_MODEL,
    item_count: scope.length,
    analyze_structure: analyzeStructure,
    structure_done: !analyzeStructure,
    structure_fingerprint: fingerprint,
    current_structure: snapshot,
    stats: { new_items: scope.filter((s) => s.is_new).length, changed_items: scope.filter((s) => !s.is_new).length, structure_changed: structureChanged },
  }).select('id').single(), 'create inspection') as { id: string };

  for (let i = 0; i < scope.length; i += 500) {
    must(await db.from('taxonomy_inspection_items').insert(scope.slice(i, i + 500).map((s, j) => ({
      inspection_id: inspection.id,
      item_type: s.item_type,
      item_id: s.item_id,
      content_hash: s.content_hash,
      chunk: Math.floor((i + j) / CHUNK_SIZE),
    }))), 'record scope');
  }

  if (!analyzeStructure && scope.length === 0) {
    must(await db.from('taxonomy_inspections').update({
      status: 'completed', completed_at: new Date().toISOString(),
      summary: 'Nothing new or changed since the last inspection.',
      log: [{ at: new Date().toISOString(), level: 'info', message: 'No new or changed items; skipped.' }],
    }).eq('id', inspection.id), 'complete');
    return { inspection_id: inspection.id, nothing_to_do: true };
  }

  background(run(db, inspection.id));
  return { inspection_id: inspection.id };
}

async function resume(db: SupabaseClient, inspectionId: string) {
  const insp = must(await db.from('taxonomy_inspections').select('id, status, heartbeat_at, created_at').eq('id', inspectionId).single(), 'load inspection') as { status: string; heartbeat_at: string | null; created_at: string };
  if (['completed', 'cancelled'].includes(insp.status)) throw new HttpError(409, `Inspection is already ${insp.status}`);
  const last = new Date(insp.heartbeat_at ?? insp.created_at).getTime();
  if (insp.status === 'running' && Date.now() - last < STALE_AFTER_MS) return { inspection_id: inspectionId, already_running: true };
  background(run(db, inspectionId));
  return { inspection_id: inspectionId, resumed: true };
}

// ---------------------------------------------------------------------------
// The run itself
// ---------------------------------------------------------------------------

async function run(db: SupabaseClient, inspectionId: string) {
  const startedAt = Date.now();
  const staleCutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();

  // Claim the run (guards against two workers on the same inspection).
  const claimed = must(await db.from('taxonomy_inspections')
    .update({ status: 'running', heartbeat_at: new Date().toISOString(), error: null })
    .eq('id', inspectionId)
    .in('status', ['queued', 'running', 'failed'])
    .or(`status.neq.running,heartbeat_at.is.null,heartbeat_at.lt.${staleCutoff}`)
    .select('*'), 'claim') as Inspection[];
  if (!claimed.length) return;
  let insp = claimed[0];

  const log: Inspection['log'] = insp.log ?? [];
  const note = (level: 'info' | 'warn' | 'error', message: string) => {
    log.push({ at: new Date().toISOString(), level, message });
    console[level === 'info' ? 'log' : level](`[inspection ${inspectionId}] ${message}`);
  };
  const save = async (fields: Record<string, unknown>) => {
    must(await db.from('taxonomy_inspections').update({ ...fields, log: log.slice(-100), heartbeat_at: new Date().toISOString() }).eq('id', inspectionId), 'save progress');
  };

  try {
    await save({ attempts: insp.attempts + 1, started_at: insp.started_at ?? new Date().toISOString() });
    note('info', `Run ${insp.attempts + 1} started (${insp.mode}, ${insp.item_count} items in scope)`);

    const snapshot = insp.current_structure;
    const idx = indexTaxonomy(snapshot);
    const skip = await knownFingerprints(db, inspectionId);
    let seq = await nextSeq(db, inspectionId);
    const stats = { ...insp.stats, dropped: (insp.stats.dropped as number) ?? 0 };

    // 1. Structure (once per inspection)
    if (insp.analyze_structure && !insp.structure_done) {
      note('info', 'Analysing category / subcategory / tag structure');
      const raw = await generateJson<{ summary?: string; proposals?: RawStructureProposal[] }>({
        system: STRUCTURE_SYSTEM_PROMPT,
        schema: STRUCTURE_SCHEMA,
        prompt: `Library: ${snapshot.total_items} items, ${snapshot.uncategorized_items} uncategorised.\n\nTaxonomy:\n${renderTaxonomy(snapshot, idx)}`,
      });
      const { drafts, dropped } = validateStructure(raw, idx, { skipFingerprints: skip });
      seq = await storeDrafts(db, inspectionId, drafts, seq);
      stats.dropped = (stats.dropped as number) + dropped.length;
      if (dropped.length) note('info', `Discarded ${dropped.length} invalid or duplicate structure suggestion(s)`);
      note('info', `Structure analysis produced ${drafts.length} proposal(s)`);
      insp = { ...insp, structure_done: true };
      await save({ structure_done: true, stats });
    }

    // 2. Items, chunk by chunk (checkpointed)
    const plan = await currentPlan(db, inspectionId);
    const pending = must(await db.from('taxonomy_inspection_items').select('chunk').eq('inspection_id', inspectionId).eq('processed', false), 'pending chunks') as { chunk: number }[];
    const chunks = [...new Set(pending.map((p) => p.chunk))].sort((a, b) => a - b);
    let processed = insp.items_processed;

    for (const chunk of chunks) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        note('info', 'Pausing to stay within the time limit; will resume automatically');
        await save({ status: 'queued', items_processed: processed, stats });
        return;
      }
      const status = must(await db.from('taxonomy_inspections').select('status').eq('id', inspectionId).single(), 'status') as { status: string };
      if (status.status === 'cancelled') { note('info', 'Cancelled by admin'); await save({}); return; }

      const rows = must(await db.from('taxonomy_inspection_items').select('item_type, item_id, content_hash')
        .eq('inspection_id', inspectionId).eq('chunk', chunk), 'chunk items') as { item_type: 'resource' | 'learning'; item_id: string; content_hash: string }[];
      const { contexts, prompt } = await loadItems(db, rows, idx);

      if (contexts.length) {
        const raw = await generateJson<{ proposals?: RawItemProposal[] }>({
          system: ITEMS_SYSTEM_PROMPT,
          schema: ITEMS_SCHEMA,
          prompt: `Taxonomy:\n${renderTaxonomy(snapshot, idx, false)}\n\n${renderPlan(plan, idx)}\n\nItems:\n${prompt}`,
        });
        const { drafts, dropped } = validateItems(raw, idx, contexts, plan, { skipFingerprints: skip });
        seq = await storeDrafts(db, inspectionId, drafts, seq);
        stats.dropped = (stats.dropped as number) + dropped.length;
      }

      // checkpoint: these items are now inspected
      must(await db.from('taxonomy_inspection_items').update({ processed: true }).eq('inspection_id', inspectionId).eq('chunk', chunk), 'mark chunk');
      const loaded = new Set(contexts.map((c) => c.id)); // skip items deleted since the run started
      must(await db.from('taxonomy_item_state').upsert(rows.filter((r) => loaded.has(r.item_id)).map((r) => ({
        item_type: r.item_type, item_id: r.item_id, content_hash: r.content_hash,
        last_inspection_id: inspectionId, inspected_at: new Date().toISOString(),
      })), { onConflict: 'user_id,item_type,item_id' }), 'item state');
      processed += rows.length;
      await save({ items_processed: processed, stats });
    }

    // 3. Done
    const kinds = must(await db.from('taxonomy_proposals').select('kind').eq('inspection_id', inspectionId), 'counts') as { kind: ProposalKind }[];
    const counts: Partial<Record<ProposalKind, number>> = {};
    kinds.forEach((k) => (counts[k.kind] = (counts[k.kind] ?? 0) + 1));
    note('info', `Completed with ${kinds.length} proposal(s)`);
    await save({ status: 'completed', completed_at: new Date().toISOString(), items_processed: processed, summary: summarize(counts), stats: { ...stats, by_kind: counts } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    note('error', message);
    await save({ status: 'failed', error: message }).catch((e) => console.error('could not record failure', e));
  }
}

// Fingerprints of proposals that are rejected anywhere, or still open in other inspections,
// so the AI doesn't keep re-suggesting the same things.
async function knownFingerprints(db: SupabaseClient, inspectionId: string) {
  const rows = must(await db.from('taxonomy_proposals').select('fingerprint, status, inspection_id')
    .or(`status.eq.rejected,status.eq.pending,status.eq.approved,inspection_id.eq.${inspectionId}`).limit(5000), 'fingerprints') as { fingerprint: string }[];
  return new Set(rows.map((r) => r.fingerprint));
}

async function nextSeq(db: SupabaseClient, inspectionId: string) {
  const rows = must(await db.from('taxonomy_proposals').select('seq').eq('inspection_id', inspectionId).order('seq', { ascending: false }).limit(1), 'seq') as { seq: number }[];
  return (rows[0]?.seq ?? 0) + 1;
}

async function storeDrafts(db: SupabaseClient, inspectionId: string, drafts: Draft[], seq: number) {
  if (!drafts.length) return seq;
  must(await db.from('taxonomy_proposals').insert(drafts.map((d, i) => ({
    inspection_id: inspectionId,
    seq: seq + i,
    kind: d.kind,
    ref: d.ref,
    payload: d.payload,
    summary: d.summary,
    rationale: d.rationale,
    confidence: d.confidence,
    fingerprint: d.fingerprint,
  }))), 'store proposals');
  return seq + drafts.length;
}

async function currentPlan(db: SupabaseClient, inspectionId: string): Promise<StructurePlan> {
  const rows = must(await db.from('taxonomy_proposals').select('kind, ref, payload').eq('inspection_id', inspectionId)
    .in('kind', ['create_category', 'create_subcategory', 'merge_categories', 'merge_subcategories', 'merge_tags']), 'plan') as Pick<Draft, 'kind' | 'ref' | 'payload'>[];
  return planFromDrafts(rows);
}

function renderPlan(plan: StructurePlan, idx: TaxonomyIndex) {
  const lines: string[] = [];
  for (const [slug, n] of plan.newNodes) {
    const parent = n.parent ? ('id' in n.parent ? ` in ${idx.byId.get(n.parent.id)?.alias}` : ` in NEW:${n.parent.ref}`) : '';
    lines.push(`NEW:${slug} "${n.name}" (${n.kind}${parent})`);
  }
  const merges: string[] = [];
  for (const [src, target] of plan.redirects) {
    merges.push(`${idx.byId.get(src)?.alias} → ${'id' in target ? idx.byId.get(target.id)?.alias : `NEW:${target.ref}`}`);
  }
  return `Planned new nodes:\n${lines.join('\n') || '(none)'}\n\nPlanned merges (already handled):\n${merges.join(', ') || '(none)'}`;
}

async function loadItems(
  db: SupabaseClient,
  rows: { item_type: 'resource' | 'learning'; item_id: string }[],
  idx: TaxonomyIndex,
): Promise<{ contexts: ItemContext[]; prompt: string }> {
  const fetchType = async (type: 'resource' | 'learning') => {
    const ids = rows.filter((r) => r.item_type === type).map((r) => r.item_id);
    if (!ids.length) return [];
    const p = type === 'resource' ? 'resource' : 'learning';
    const data = must(await db.from(type === 'resource' ? 'resources' : 'learning')
      .select(`id, title, description, url, html_content${type === 'learning' ? ', difficulty_level' : ''}, ${p}_categories(category_id), ${p}_subcategories(subcategory_id), ${p}_tags(tag_id)`)
      .in('id', ids), `load ${type}`) as unknown as Record<string, unknown>[];
    return data.map((d) => ({ type, d }));
  };
  const all = [...await fetchType('resource'), ...await fetchType('learning')];

  const contexts: ItemContext[] = [];
  const blocks: string[] = [];
  all.forEach(({ type, d }, i) => {
    const p = type === 'resource' ? 'resource' : 'learning';
    const ctx: ItemContext = {
      alias: `I${i + 1}`,
      type,
      id: d.id as string,
      title: d.title as string,
      categoryIds: ((d[`${p}_categories`] as { category_id: string }[]) ?? []).map((x) => x.category_id).filter((id) => idx.byId.has(id)),
      subcategoryIds: ((d[`${p}_subcategories`] as { subcategory_id: string }[]) ?? []).map((x) => x.subcategory_id).filter((id) => idx.byId.has(id)),
      tagIds: ((d[`${p}_tags`] as { tag_id: string }[]) ?? []).map((x) => x.tag_id).filter((id) => idx.byId.has(id)),
    };
    contexts.push(ctx);
    const a = (id: string) => `${idx.byId.get(id)!.alias} "${idx.byId.get(id)!.name}"`;
    const text = [htmlToText(d.description as string), htmlToText(d.html_content as string)].filter(Boolean).join('\n').slice(0, ITEM_TEXT_CHARS);
    blocks.push([
      `${ctx.alias} [${type}${d.difficulty_level ? `, ${d.difficulty_level}` : ''}] ${JSON.stringify(ctx.title)}`,
      d.url ? `  url: ${d.url}` : '',
      `  categories: ${ctx.categoryIds.map(a).join(', ') || '(none)'}`,
      `  subcategories: ${ctx.subcategoryIds.map(a).join(', ') || '(none)'}`,
      `  tags: ${ctx.tagIds.map(a).join(', ') || '(none)'}`,
      text ? `  content: ${text.replace(/\n+/g, ' ')}` : '',
    ].filter(Boolean).join('\n'));
  });
  return { contexts, prompt: blocks.join('\n\n') };
}

// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    if (!GEMINI_API_KEY) throw new HttpError(503, 'AI is not configured: set the GEMINI_API_KEY secret', 'ai_not_configured');
    const { db } = await userClient(req);
    const { data: isAdmin } = await db.rpc('is_admin');
    if (!isAdmin) throw new HttpError(403, 'Only admins can run library inspections', 'forbidden');

    const body = await req.json().catch(() => ({}));
    switch (body.action) {
      case 'start':
        return json(await start(db, body.mode === 'full' ? 'full' : 'incremental'));
      case 'resume':
        if (typeof body.inspection_id !== 'string') throw new HttpError(400, 'inspection_id is required');
        return json(await resume(db, body.inspection_id));
      default:
        throw new HttpError(400, `Unknown action: ${body.action}`);
    }
  } catch (err) {
    return errorResponse(err);
  }
});
