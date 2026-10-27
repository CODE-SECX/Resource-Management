// Pure logic for the AI Library Organizer: aliasing the taxonomy for prompts, the response schemas,
// and validating model output into typed proposals the database engine can apply.
// No Deno / network APIs here, so it is unit-tested with Vitest (supabase/tests).

// ---------------------------------------------------------------------------
// Snapshot (shape of taxonomy_snapshot())
// ---------------------------------------------------------------------------

export interface SnapTag { id: string; name: string; usage: number }
export interface SnapSubcategory { id: string; name: string; item_count: number; sample_items: string[]; tags: SnapTag[] }
export interface SnapCategory {
  id: string;
  name: string;
  description: string | null;
  item_count: number;
  sample_items: string[];
  tags: SnapTag[];
  subcategories: SnapSubcategory[];
}
export interface Snapshot { categories: SnapCategory[]; total_items: number; uncategorized_items: number }

export type NodeKind = 'category' | 'subcategory' | 'tag';

export interface TaxNode {
  alias: string;
  kind: NodeKind;
  id: string;
  name: string;
  /** category of a subcategory; subcategory (or category, for category-level tags) of a tag */
  parentId: string | null;
  itemCount: number;
}

export interface TaxonomyIndex {
  byAlias: Map<string, TaxNode>;
  byId: Map<string, TaxNode>;
  nodes: TaxNode[];
}

/** Short aliases (C1, S1, T1) keep prompts small and stop the model from inventing UUIDs. */
export function indexTaxonomy(snapshot: Snapshot): TaxonomyIndex {
  const nodes: TaxNode[] = [];
  let c = 0, s = 0, t = 0;
  const addTags = (tags: SnapTag[], parentId: string) => {
    for (const tag of tags) nodes.push({ alias: `T${++t}`, kind: 'tag', id: tag.id, name: tag.name, parentId, itemCount: tag.usage });
  };
  for (const cat of snapshot.categories) {
    nodes.push({ alias: `C${++c}`, kind: 'category', id: cat.id, name: cat.name, parentId: null, itemCount: cat.item_count });
    addTags(cat.tags, cat.id);
    for (const sub of cat.subcategories) {
      nodes.push({ alias: `S${++s}`, kind: 'subcategory', id: sub.id, name: sub.name, parentId: cat.id, itemCount: sub.item_count });
      addTags(sub.tags, sub.id);
    }
  }
  return {
    nodes,
    byAlias: new Map(nodes.map((n) => [n.alias, n])),
    byId: new Map(nodes.map((n) => [n.id, n])),
  };
}

const quote = (s: string) => JSON.stringify(s);

export function renderTaxonomy(snapshot: Snapshot, idx: TaxonomyIndex, withSamples = true): string {
  const a = (id: string) => idx.byId.get(id)!.alias;
  const tagList = (tags: SnapTag[]) =>
    tags.length ? ` | tags: ${tags.map((t) => `${a(t.id)} ${quote(t.name)} (${t.usage})`).join(', ')}` : '';
  const samples = (titles: string[]) =>
    withSamples && titles.length ? `\n      e.g. ${titles.slice(0, 5).map(quote).join('; ')}` : '';
  const lines: string[] = [];
  for (const cat of snapshot.categories) {
    lines.push(`${a(cat.id)} ${quote(cat.name)} (${cat.item_count} items)${cat.description ? ` — ${cat.description}` : ''}${tagList(cat.tags)}${samples(cat.sample_items)}`);
    for (const sub of cat.subcategories) {
      lines.push(`  ${a(sub.id)} ${quote(sub.name)} (${sub.item_count} items)${tagList(sub.tags)}${samples(sub.sample_items)}`);
    }
  }
  return lines.join('\n') || '(no categories yet)';
}

/** Stable text describing the structure only (ids, names, placement), hashed to detect changes. */
export function structureSignature(snapshot: Snapshot): string {
  return JSON.stringify(snapshot.categories.map((c) => [
    c.id, c.name,
    c.tags.map((t) => [t.id, t.name]),
    c.subcategories.map((s) => [s.id, s.name, s.tags.map((t) => [t.id, t.name])]),
  ]));
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

export function cleanName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const v = name.replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '').replace(/\s+/g, ' ');
  if (!v || v.length > 80) return null;
  return v;
}

export const normName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

const NEW_PREFIX = /^NEW:/i;
export const isNewRef = (s: unknown): s is string => typeof s === 'string' && NEW_PREFIX.test(s.trim());
export const refSlug = (s: string) =>
  s.trim().replace(NEW_PREFIX, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);

// ---------------------------------------------------------------------------
// Model response schemas (Gemini OpenAPI subset)
// ---------------------------------------------------------------------------

export const STRUCTURE_KINDS = [
  'merge_categories', 'rename_category', 'create_category',
  'merge_subcategories', 'rename_subcategory', 'create_subcategory', 'move_subcategory',
  'merge_tags', 'rename_tag',
] as const;
export type StructureKind = typeof STRUCTURE_KINDS[number];
export type ProposalKind = StructureKind | 'reassign_item' | 'set_item_tags';

const STRING = { type: 'STRING' };
const STRINGS = { type: 'ARRAY', items: STRING };

export const STRUCTURE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: STRING,
    proposals: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          kind: { type: 'STRING', enum: [...STRUCTURE_KINDS] },
          target: STRING,
          sources: STRINGS,
          name: STRING,
          parent: STRING,
          rationale: STRING,
          confidence: { type: 'NUMBER' },
        },
        required: ['kind', 'target', 'rationale', 'confidence'],
      },
    },
  },
  required: ['summary', 'proposals'],
};

export const ITEMS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    proposals: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          item: STRING,
          add_categories: STRINGS,
          remove_categories: STRINGS,
          add_subcategories: STRINGS,
          remove_subcategories: STRINGS,
          add_tags: STRINGS,
          new_tags: {
            type: 'ARRAY',
            items: { type: 'OBJECT', properties: { name: STRING, location: STRING }, required: ['name'] },
          },
          remove_tags: STRINGS,
          rationale: STRING,
          confidence: { type: 'NUMBER' },
        },
        required: ['item', 'rationale', 'confidence'],
      },
    },
  },
  required: ['proposals'],
};

export interface RawStructureProposal {
  kind?: string; target?: string; sources?: string[]; name?: string; parent?: string; rationale?: string; confidence?: number;
}
export interface RawItemProposal {
  item?: string;
  add_categories?: string[]; remove_categories?: string[];
  add_subcategories?: string[]; remove_subcategories?: string[];
  add_tags?: string[]; new_tags?: { name?: string; location?: string }[]; remove_tags?: string[];
  rationale?: string; confidence?: number;
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

export const STRUCTURE_SYSTEM_PROMPT = `You are a meticulous information architect reviewing the taxonomy (categories → subcategories → tags) of a technical knowledge base of learning materials and resources.

Goals, in priority order:
1. Duplicates and overlaps: find categories, subcategories or tags that mean the same thing or overlap heavily (e.g. "Azure" vs "Microsoft Azure Cloud", "K8s" vs "Kubernetes", "functions" vs "Functions") and merge them into the best existing one.
2. Naming consistency: fix casing, spelling, abbreviations, singular/plural and stray punctuation with renames. Use Title Case for categories and subcategories and the official spelling of technologies ("Kubernetes", "GitHub Actions", "Azure DevOps"). Tags may be lowercase.
3. Placement: move a subcategory to another category only when it clearly belongs there.
4. New nodes: create a category or subcategory only when a clear group of existing content has no suitable home. Always prefer reusing what exists.

Rules:
- Be conservative. Leave anything that is already well organised alone; an empty proposal list is a perfectly good answer.
- Judge meaning from names, descriptions and the sample item titles, not keywords alone.
- Refer to existing nodes only by the aliases shown (C1, S4, T9). For a new node use target "NEW:<short-slug>" plus a name, and refer to it as NEW:<short-slug> in later proposals.
- Each existing node may appear in at most one proposal.
- Merge into the node with more items or the clearer name. Set "name" on a merge only if the merged node should also be renamed.
- Every proposal needs a one-sentence rationale and a confidence between 0 and 1.

Proposal kinds:
- merge_categories / merge_subcategories / merge_tags: target = node to keep, sources = nodes folded into it, optional name.
- rename_category / rename_subcategory / rename_tag: target = node, name = new name.
- create_category: target = NEW:<slug>, name.
- create_subcategory: target = NEW:<slug>, name, parent = category alias or NEW:<slug> of a new category.
- move_subcategory: target = subcategory alias, parent = destination category alias or NEW:<slug>.`;

export const ITEMS_SYSTEM_PROMPT = `You check whether individual items in a technical knowledge base are filed correctly in its taxonomy (categories → subcategories → tags).

For each item, compare its actual content with its current placement. Propose changes ONLY for items that are clearly misfiled, missing an obvious placement, or missing important tags. Most items need no change: leave them out.

Rules:
- Prefer existing categories, subcategories and tags (aliases like C1, S4, T9). Use NEW:<slug> only for nodes listed under "Planned new nodes".
- Planned merges are handled separately; don't move items between nodes that are being merged.
- Don't remove a placement unless it is clearly wrong; an item may legitimately belong to several.
- Tags: add at most 3 high-value tags per item (technologies, tools, concepts). Reuse existing tag aliases where they fit. New tag names are short and lowercase unless a proper noun; give each new tag a location (the S… subcategory or C… category it belongs under).
- Every proposal needs a one-sentence rationale and a confidence between 0 and 1.`;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type NodeRef = { id: string } | { ref: string };

export interface Draft {
  kind: ProposalKind;
  ref: string | null;
  payload: Record<string, unknown>;
  summary: string;
  rationale: string;
  confidence: number;
  fingerprint: string;
}

export interface Dropped { reason: string; proposal: unknown }

/** What the structure stage plans, so the item stage can use new nodes and avoid merged ones. */
export interface StructurePlan {
  newNodes: Map<string, { kind: 'category' | 'subcategory'; name: string; parent?: NodeRef }>;
  /** merge sources → the node they are merged into */
  redirects: Map<string, NodeRef>;
}

export const emptyPlan = (): StructurePlan => ({ newNodes: new Map(), redirects: new Map() });

const KIND_ORDER: Record<string, number> = {
  create_category: 1, create_subcategory: 2, rename_category: 3, rename_subcategory: 3, rename_tag: 3,
  move_subcategory: 4, merge_categories: 5, merge_subcategories: 6, merge_tags: 7,
};

const clampConfidence = (c: unknown) => (typeof c === 'number' && Number.isFinite(c) ? Math.max(0, Math.min(1, c)) : 0);
const rationaleOf = (r: unknown) => (typeof r === 'string' ? r.trim().slice(0, 500) : '');
const refKey = (r: NodeRef, plan: StructurePlan) =>
  'id' in r ? r.id : `new:${normName(plan.newNodes.get(r.ref)?.name ?? r.ref)}`;

/** Rebuild the plan from stored proposal payloads (used when an inspection resumes). */
export function planFromDrafts(drafts: Pick<Draft, 'kind' | 'ref' | 'payload'>[]): StructurePlan {
  const plan = emptyPlan();
  for (const d of drafts) {
    const p = d.payload as Record<string, never>;
    if (d.kind === 'create_category' && d.ref) plan.newNodes.set(d.ref, { kind: 'category', name: p.name });
    if (d.kind === 'create_subcategory' && d.ref) plan.newNodes.set(d.ref, { kind: 'subcategory', name: p.name, parent: p.category });
    if (d.kind === 'merge_categories' || d.kind === 'merge_subcategories') {
      for (const s of p.source_ids as string[]) plan.redirects.set(s, p.target);
    }
    if (d.kind === 'merge_tags') for (const s of p.source_ids as string[]) plan.redirects.set(s, { id: p.target_id });
  }
  return plan;
}

export function validateStructure(
  raw: { proposals?: RawStructureProposal[] } | null | undefined,
  idx: TaxonomyIndex,
  opts: { skipFingerprints?: Set<string>; minConfidence?: number; maxProposals?: number } = {},
): { drafts: Draft[]; dropped: Dropped[]; plan: StructurePlan } {
  const minConfidence = opts.minConfidence ?? 0.5;
  const skip = opts.skipFingerprints ?? new Set<string>();
  const drafts: Draft[] = [];
  const dropped: Dropped[] = [];
  const plan = emptyPlan();
  const used = new Set<string>(); // existing node ids already claimed by a proposal
  const createdNames = new Set<string>();

  const list = [...(raw?.proposals ?? [])].sort((a, b) => (KIND_ORDER[a.kind ?? ''] ?? 99) - (KIND_ORDER[b.kind ?? ''] ?? 99));

  const existing = (alias: unknown, kind: NodeKind) => {
    const node = typeof alias === 'string' ? idx.byAlias.get(alias.trim().toUpperCase()) : undefined;
    return node && node.kind === kind ? node : undefined;
  };
  /** existing alias or NEW:<slug> of a node planned earlier in this response */
  const resolve = (alias: unknown, kind: 'category' | 'subcategory'): NodeRef | undefined => {
    if (isNewRef(alias)) {
      const slug = refSlug(alias);
      return plan.newNodes.get(slug)?.kind === kind ? { ref: slug } : undefined;
    }
    const node = existing(alias, kind);
    return node ? { id: node.id } : undefined;
  };
  const label = (r: NodeRef) => ('id' in r ? idx.byId.get(r.id)!.name : plan.newNodes.get(r.ref)!.name);
  const siblingsOf = (node: TaxNode) => idx.nodes.filter((n) => n.kind === node.kind && n.parentId === node.parentId && n.id !== node.id);

  for (const p of list) {
    const drop = (reason: string) => dropped.push({ reason, proposal: p });
    const kind = p.kind as StructureKind;
    if (!STRUCTURE_KINDS.includes(kind)) { drop('unknown kind'); continue; }
    const confidence = clampConfidence(p.confidence);
    if (confidence < minConfidence) { drop('low confidence'); continue; }
    const rationale = rationaleOf(p.rationale);
    let draft: Omit<Draft, 'rationale' | 'confidence'> | null = null;

    if (kind === 'create_category' || kind === 'create_subcategory') {
      const name = cleanName(p.name);
      if (!isNewRef(p.target) || !name) { drop('create needs target NEW:<slug> and a name'); continue; }
      const slug = refSlug(p.target);
      if (!slug || plan.newNodes.has(slug)) { drop('duplicate or empty reference'); continue; }
      if (kind === 'create_category') {
        if (idx.nodes.some((n) => n.kind === 'category' && normName(n.name) === normName(name)) || createdNames.has(`c:${normName(name)}`)) {
          drop('a category with this name already exists'); continue;
        }
        plan.newNodes.set(slug, { kind: 'category', name });
        createdNames.add(`c:${normName(name)}`);
        draft = { kind, ref: slug, payload: { name }, summary: `Create category “${name}”`, fingerprint: `create_category|${normName(name)}` };
      } else {
        const parent = resolve(p.parent, 'category');
        if (!parent) { drop('unknown parent category'); continue; }
        const parentId = 'id' in parent ? parent.id : null;
        if (parentId && idx.nodes.some((n) => n.kind === 'subcategory' && n.parentId === parentId && normName(n.name) === normName(name))) {
          drop('that subcategory already exists'); continue;
        }
        plan.newNodes.set(slug, { kind: 'subcategory', name, parent });
        draft = {
          kind, ref: slug, payload: { category: parent, name },
          summary: `Create subcategory “${name}” in “${label(parent)}”`,
          fingerprint: `create_subcategory|${refKey(parent, plan)}|${normName(name)}`,
        };
      }
    } else if (kind === 'rename_category' || kind === 'rename_subcategory' || kind === 'rename_tag') {
      const nodeKind: NodeKind = kind === 'rename_category' ? 'category' : kind === 'rename_subcategory' ? 'subcategory' : 'tag';
      const node = existing(p.target, nodeKind);
      const name = cleanName(p.name);
      if (!node || !name) { drop('unknown node or missing name'); continue; }
      if (name === node.name) { drop('name unchanged'); continue; }
      if (used.has(node.id)) { drop('node already used by another proposal'); continue; }
      if (siblingsOf(node).some((n) => normName(n.name) === normName(name))) { drop('new name collides with a sibling; should be a merge'); continue; }
      used.add(node.id);
      const key = nodeKind === 'category' ? 'category_id' : nodeKind === 'subcategory' ? 'subcategory_id' : 'tag_id';
      draft = {
        kind, ref: null, payload: { [key]: node.id, new_name: name },
        summary: `Rename ${nodeKind} “${node.name}” to “${name}”`,
        fingerprint: `${kind}|${node.id}|${normName(name)}|${name}`,
      };
    } else if (kind === 'merge_categories' || kind === 'merge_subcategories' || kind === 'merge_tags') {
      const nodeKind: NodeKind = kind === 'merge_categories' ? 'category' : kind === 'merge_subcategories' ? 'subcategory' : 'tag';
      const target: NodeRef | undefined = nodeKind === 'tag'
        ? (existing(p.target, 'tag') ? { id: existing(p.target, 'tag')!.id } : undefined)
        : resolve(p.target, nodeKind);
      if (!target) { drop('unknown merge target'); continue; }
      const targetId = 'id' in target ? target.id : null;
      const sources = [...new Set((p.sources ?? []).map((s) => existing(s, nodeKind)).filter((n): n is TaxNode => !!n && n.id !== targetId))];
      if (sources.length === 0) { drop('no valid merge sources'); continue; }
      if ((targetId && used.has(targetId)) || sources.some((s) => used.has(s.id))) { drop('node already used by another proposal'); continue; }
      const newName = cleanName(p.name);
      if (targetId) used.add(targetId);
      sources.forEach((s) => used.add(s.id));
      sources.forEach((s) => plan.redirects.set(s.id, target));
      const sourceIds = sources.map((s) => s.id).sort();
      const renamed = newName && newName !== label(target) ? newName : null;
      draft = {
        kind, ref: null,
        payload: nodeKind === 'tag'
          ? { target_id: targetId, source_ids: sourceIds, ...(renamed ? { new_name: renamed } : {}) }
          : { target, source_ids: sourceIds, ...(renamed ? { new_name: renamed } : {}) },
        summary: `Merge ${nodeKind === 'category' ? 'categories' : nodeKind === 'subcategory' ? 'subcategories' : 'tags'} ${sources.map((s) => `“${s.name}”`).join(', ')} into “${label(target)}”${renamed ? ` and rename it “${renamed}”` : ''}`,
        fingerprint: `${kind}|${refKey(target, plan)}|${sourceIds.join(',')}|${renamed ? normName(renamed) : ''}`,
      };
    } else if (kind === 'move_subcategory') {
      const node = existing(p.target, 'subcategory');
      const parent = resolve(p.parent, 'category');
      if (!node || !parent) { drop('unknown subcategory or destination'); continue; }
      if ('id' in parent && parent.id === node.parentId) { drop('already in that category'); continue; }
      if (used.has(node.id)) { drop('node already used by another proposal'); continue; }
      used.add(node.id);
      draft = {
        kind, ref: null, payload: { subcategory_id: node.id, to_category: parent },
        summary: `Move subcategory “${node.name}” from “${idx.byId.get(node.parentId!)!.name}” to “${label(parent)}”`,
        fingerprint: `move_subcategory|${node.id}|${refKey(parent, plan)}`,
      };
    }

    if (!draft) { drop('invalid proposal'); continue; }
    if (skip.has(draft.fingerprint)) { drop('previously rejected or already proposed'); continue; }
    skip.add(draft.fingerprint);
    drafts.push({ ...draft, rationale, confidence });
    if (drafts.length >= (opts.maxProposals ?? 80)) break;
  }

  return { drafts, dropped, plan };
}

export interface ItemContext {
  alias: string;
  type: 'resource' | 'learning';
  id: string;
  title: string;
  categoryIds: string[];
  subcategoryIds: string[];
  tagIds: string[];
}

export function validateItems(
  raw: { proposals?: RawItemProposal[] } | null | undefined,
  idx: TaxonomyIndex,
  items: ItemContext[],
  plan: StructurePlan,
  opts: { skipFingerprints?: Set<string>; minConfidence?: number } = {},
): { drafts: Draft[]; dropped: Dropped[] } {
  const minConfidence = opts.minConfidence ?? 0.6;
  const skip = opts.skipFingerprints ?? new Set<string>();
  const byAlias = new Map(items.map((i) => [i.alias, i]));
  const drafts: Draft[] = [];
  const dropped: Dropped[] = [];
  const seenItems = new Set<string>();

  const node = (alias: unknown, kind: NodeKind) => {
    const n = typeof alias === 'string' ? idx.byAlias.get(alias.trim().toUpperCase()) : undefined;
    return n && n.kind === kind ? n : undefined;
  };
  /** existing (following planned merges) or planned new node */
  const resolve = (alias: unknown, kind: 'category' | 'subcategory'): NodeRef | undefined => {
    if (isNewRef(alias)) {
      const slug = refSlug(alias);
      return plan.newNodes.get(slug)?.kind === kind ? { ref: slug } : undefined;
    }
    const n = node(alias, kind);
    if (!n) return undefined;
    return plan.redirects.get(n.id) ?? { id: n.id };
  };
  const label = (r: NodeRef) => ('id' in r ? idx.byId.get(r.id)?.name ?? '?' : plan.newNodes.get(r.ref)?.name ?? r.ref);
  const key = (r: NodeRef) => ('id' in r ? r.id : `ref:${r.ref}`);
  const uniq = (refs: (NodeRef | undefined)[]) => {
    const out = new Map<string, NodeRef>();
    refs.forEach((r) => r && out.set(key(r), r));
    return [...out.values()];
  };

  for (const p of raw?.proposals ?? []) {
    const drop = (reason: string) => dropped.push({ reason, proposal: p });
    const item = typeof p.item === 'string' ? byAlias.get(p.item.trim().toUpperCase()) : undefined;
    if (!item) { drop('unknown item'); continue; }
    if (seenItems.has(item.id)) { drop('duplicate item'); continue; }
    seenItems.add(item.id);
    const confidence = clampConfidence(p.confidence);
    if (confidence < minConfidence) { drop('low confidence'); continue; }
    const rationale = rationaleOf(p.rationale);
    const title = `“${item.title}”`;

    // --- placement
    const addCats = uniq((p.add_categories ?? []).map((a) => resolve(a, 'category')))
      .filter((r) => !('id' in r && item.categoryIds.includes(r.id)));
    const removeCats = [...new Set((p.remove_categories ?? []).map((a) => node(a, 'category')?.id)
      .filter((id): id is string => !!id && item.categoryIds.includes(id) && !addCats.some((r) => 'id' in r && r.id === id)))];
    const addSubs = uniq((p.add_subcategories ?? []).map((a) => resolve(a, 'subcategory')))
      .filter((r) => !('id' in r && item.subcategoryIds.includes(r.id)));
    const removeSubs = [...new Set((p.remove_subcategories ?? []).map((a) => node(a, 'subcategory')?.id)
      .filter((id): id is string => !!id && item.subcategoryIds.includes(id) && !addSubs.some((r) => 'id' in r && r.id === id)))];

    const remainingCats = item.categoryIds.filter((id) => !removeCats.includes(id)).length + addCats.length;
    const remainingSubs = item.subcategoryIds.filter((id) => !removeSubs.includes(id) && !removeCats.includes(idx.byId.get(id)?.parentId ?? '')).length + addSubs.length;
    const placementChanges = addCats.length + removeCats.length + addSubs.length + removeSubs.length;

    if (placementChanges > 0) {
      if (remainingCats + remainingSubs === 0) {
        drop('would leave the item uncategorised');
      } else {
        const parts = [
          addCats.length || addSubs.length ? `add to ${[...addCats, ...addSubs].map((r) => `“${label(r)}”`).join(', ')}` : '',
          removeCats.length || removeSubs.length ? `remove from ${[...removeCats, ...removeSubs].map((id) => `“${idx.byId.get(id)!.name}”`).join(', ')}` : '',
        ].filter(Boolean);
        const fp = `reassign_item|${item.type}:${item.id}|+${[...addCats, ...addSubs].map(key).sort()}|-${[...removeCats, ...removeSubs].sort()}`;
        if (skip.has(fp)) drop('previously rejected or already proposed');
        else {
          skip.add(fp);
          drafts.push({
            kind: 'reassign_item', ref: null,
            payload: {
              item_type: item.type, item_id: item.id,
              add_categories: addCats, remove_category_ids: removeCats,
              add_subcategories: addSubs, remove_subcategory_ids: removeSubs,
            },
            summary: `${title}: ${parts.join('; ')}`,
            rationale, confidence, fingerprint: fp,
          });
        }
      }
    }

    // --- tags
    const addTagIds = [...new Set((p.add_tags ?? []).map((a) => node(a, 'tag'))
      .filter((n): n is TaxNode => !!n)
      .map((n) => ('id' in (plan.redirects.get(n.id) ?? {}) ? (plan.redirects.get(n.id) as { id: string }).id : n.id))
      .filter((id) => !item.tagIds.includes(id)))];
    const linkedNames = new Set(item.tagIds.map((id) => normName(idx.byId.get(id)?.name ?? '')));
    const newTags: { name: string; subcategory?: NodeRef; category?: NodeRef }[] = [];
    for (const t of (p.new_tags ?? []).slice(0, 5)) {
      const name = cleanName(t.name);
      if (!name || linkedNames.has(normName(name))) continue;
      let loc: { subcategory?: NodeRef; category?: NodeRef } | undefined;
      const sub = resolve(t.location, 'subcategory');
      const cat = sub ? undefined : resolve(t.location, 'category');
      if (sub) loc = { subcategory: sub };
      else if (cat) loc = { category: cat };
      else {
        const firstSub = addSubs[0] ?? (item.subcategoryIds[0] ? { id: item.subcategoryIds[0] } : undefined);
        const firstCat = addCats[0] ?? (item.categoryIds[0] ? { id: item.categoryIds[0] } : undefined);
        loc = firstSub ? { subcategory: firstSub } : firstCat ? { category: firstCat } : undefined;
      }
      if (!loc) continue;
      // reuse an existing tag with this name at that location
      const locId = loc.subcategory && 'id' in loc.subcategory ? loc.subcategory.id : loc.category && 'id' in loc.category ? loc.category.id : null;
      const existingTag = locId ? idx.nodes.find((n) => n.kind === 'tag' && n.parentId === locId && normName(n.name) === normName(name)) : undefined;
      if (existingTag) {
        if (!item.tagIds.includes(existingTag.id) && !addTagIds.includes(existingTag.id)) addTagIds.push(existingTag.id);
      } else if (!newTags.some((x) => normName(x.name) === normName(name))) {
        newTags.push({ name, ...loc });
      }
      linkedNames.add(normName(name));
    }
    const removeTagIds = [...new Set((p.remove_tags ?? []).map((a) => node(a, 'tag')?.id)
      .filter((id): id is string => !!id && item.tagIds.includes(id)))];

    if (addTagIds.length + newTags.length + removeTagIds.length > 0) {
      const added = [...addTagIds.map((id) => idx.byId.get(id)!.name), ...newTags.map((t) => t.name)];
      const removed = removeTagIds.map((id) => idx.byId.get(id)!.name);
      const fp = `set_item_tags|${item.type}:${item.id}|+${[...addTagIds, ...newTags.map((t) => `new:${normName(t.name)}`)].sort()}|-${removeTagIds.sort()}`;
      if (skip.has(fp)) drop('previously rejected or already proposed');
      else {
        skip.add(fp);
        drafts.push({
          kind: 'set_item_tags', ref: null,
          payload: { item_type: item.type, item_id: item.id, add_tags: [...addTagIds.map((id) => ({ id })), ...newTags], remove_tag_ids: removeTagIds },
          summary: `${title}: ${[added.length ? `add tags ${added.join(', ')}` : '', removed.length ? `remove tags ${removed.join(', ')}` : ''].filter(Boolean).join('; ')}`,
          rationale, confidence, fingerprint: fp,
        });
      }
    }

    if (placementChanges === 0 && addTagIds.length + newTags.length + removeTagIds.length === 0) drop('no effective change');
  }

  return { drafts, dropped };
}

/** One-line description of an inspection's outcome. */
export function summarize(counts: Partial<Record<ProposalKind, number>>): string {
  const n = (k: ProposalKind) => counts[k] ?? 0;
  const parts = [
    [n('merge_categories') + n('merge_subcategories') + n('merge_tags'), 'merge'],
    [n('rename_category') + n('rename_subcategory') + n('rename_tag'), 'rename'],
    [n('create_category') + n('create_subcategory'), 'new node'],
    [n('move_subcategory'), 'move'],
    [n('reassign_item'), 'item reassignment'],
    [n('set_item_tags'), 'tag update'],
  ].filter(([c]) => (c as number) > 0).map(([c, w]) => `${c} ${w}${c === 1 ? '' : 's'}`);
  return parts.length ? `Recommended ${parts.join(', ')}.` : 'Everything looks well organised. No changes recommended.';
}
