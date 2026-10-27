import { describe, expect, it } from 'vitest';
import {
  indexTaxonomy, planFromDrafts, renderTaxonomy, summarize, validateItems, validateStructure,
  type ItemContext, type Snapshot,
} from '../functions/_shared/taxonomy';

const snapshot: Snapshot = {
  total_items: 5,
  uncategorized_items: 0,
  categories: [
    {
      id: 'c-azure', name: 'Azure', description: null, item_count: 3, sample_items: ['Functions pricing'],
      tags: [{ id: 't-cloud', name: 'cloud', usage: 2 }],
      subcategories: [{ id: 's-fn', name: 'Functions', item_count: 2, sample_items: [], tags: [{ id: 't-sls', name: 'serverless', usage: 2 }] }],
    },
    {
      id: 'c-mac', name: 'Microsoft Azure Cloud', description: null, item_count: 2, sample_items: ['AKS networking'],
      tags: [],
      subcategories: [{ id: 's-aks', name: 'aks', item_count: 1, sample_items: [], tags: [{ id: 't-k8s', name: 'k8s', usage: 1 }] }],
    },
    { id: 'c-k8s', name: 'Kubernetes', description: null, item_count: 0, sample_items: [], tags: [], subcategories: [] },
  ],
};
const idx = indexTaxonomy(snapshot);
// C1 Azure, T1 cloud, S1 Functions, T2 serverless, C2 MAC, S2 aks, T3 k8s, C3 Kubernetes

describe('aliasing', () => {
  it('assigns stable short aliases and renders them for the prompt', () => {
    expect(['C1', 'T1', 'S1', 'T2', 'C2', 'S2', 'T3', 'C3'].map((a) => idx.byAlias.get(a)?.id))
      .toEqual(['c-azure', 't-cloud', 's-fn', 't-sls', 'c-mac', 's-aks', 't-k8s', 'c-k8s']);
    const text = renderTaxonomy(snapshot, idx);
    expect(text).toContain('C2 "Microsoft Azure Cloud" (2 items)');
    expect(text).toContain('  S1 "Functions" (2 items) | tags: T2 "serverless" (2)');
  });
});

describe('validateStructure', () => {
  it('turns a valid merge into a payload with real ids and records the redirect', () => {
    const { drafts, plan } = validateStructure({ proposals: [
      { kind: 'merge_categories', target: 'C1', sources: ['C2', 'C2', 'C1', 'X9'], rationale: 'Same cloud', confidence: 0.9 },
    ] }, idx);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      kind: 'merge_categories',
      payload: { target: { id: 'c-azure' }, source_ids: ['c-mac'] },
      summary: 'Merge categories “Microsoft Azure Cloud” into “Azure”',
    });
    expect(plan.redirects.get('c-mac')).toEqual({ id: 'c-azure' });
  });

  it('drops hallucinated, colliding, duplicate, low-confidence and previously rejected proposals', () => {
    const rejected = validateStructure({ proposals: [{ kind: 'rename_category', target: 'C3', name: 'K8s', rationale: '', confidence: 1 }] }, idx).drafts[0].fingerprint;
    const { drafts, dropped } = validateStructure({ proposals: [
      { kind: 'rename_category', target: 'C9', name: 'Ghost', rationale: '', confidence: 1 },          // unknown alias
      { kind: 'rename_category', target: 'C2', name: 'azure', rationale: '', confidence: 1 },          // collides with sibling
      { kind: 'create_category', target: 'NEW:az', name: 'AZURE', rationale: '', confidence: 1 },      // exists already
      { kind: 'rename_subcategory', target: 'S2', name: 'AKS', rationale: '', confidence: 0.2 },       // low confidence
      { kind: 'rename_category', target: 'C3', name: 'K8s', rationale: '', confidence: 1 },            // rejected before
      { kind: 'merge_tags', target: 'T1', sources: ['T1'], rationale: '', confidence: 1 },             // nothing to merge
      { kind: 'rename_subcategory', target: 'S2', name: 'AKS', rationale: 'Official casing', confidence: 0.8 },
      { kind: 'move_subcategory', target: 'S2', parent: 'C3', rationale: '', confidence: 0.9 },        // S2 already used
    ] }, idx, { skipFingerprints: new Set([rejected]) });
    expect(drafts.map((d) => d.summary)).toEqual(['Rename subcategory “aks” to “AKS”']);
    expect(dropped.map((d) => d.reason)).toEqual([
      'a category with this name already exists',
      'unknown node or missing name',
      'new name collides with a sibling; should be a merge',
      'low confidence',
      'previously rejected or already proposed',
      'node already used by another proposal',
      'no valid merge sources',
    ]);
  });

  it('lets later proposals reference new nodes regardless of output order', () => {
    const { drafts, plan } = validateStructure({ proposals: [
      { kind: 'move_subcategory', target: 'S2', parent: 'NEW:containers', rationale: '', confidence: 0.9 },
      { kind: 'create_subcategory', target: 'NEW:ci', name: 'CI/CD', parent: 'NEW:containers', rationale: '', confidence: 0.9 },
      { kind: 'create_category', target: 'NEW:Containers', name: 'Containers', rationale: '', confidence: 0.9 },
    ] }, idx);
    expect(drafts.map((d) => d.kind)).toEqual(['create_category', 'create_subcategory', 'move_subcategory']);
    expect(drafts[1].payload).toEqual({ category: { ref: 'containers' }, name: 'CI/CD' });
    expect(drafts[2].payload).toEqual({ subcategory_id: 's-aks', to_category: { ref: 'containers' } });
    expect(planFromDrafts(drafts)).toEqual(plan);
  });
});

describe('validateItems', () => {
  const items: ItemContext[] = [
    { alias: 'I1', type: 'resource', id: 'r-aks', title: 'AKS networking', categoryIds: ['c-mac'], subcategoryIds: ['s-aks'], tagIds: ['t-k8s'] },
    { alias: 'I2', type: 'learning', id: 'l-fn', title: 'Durable Functions', categoryIds: ['c-azure'], subcategoryIds: ['s-fn'], tagIds: [] },
  ];
  const plan = validateStructure({ proposals: [
    { kind: 'merge_categories', target: 'C1', sources: ['C2'], rationale: '', confidence: 0.9 },
    { kind: 'create_subcategory', target: 'NEW:aks', name: 'AKS', parent: 'C3', rationale: '', confidence: 0.9 },
  ] }, idx).plan;

  it('maps placements through planned merges and new nodes', () => {
    const { drafts } = validateItems({ proposals: [
      { item: 'I1', add_subcategories: ['NEW:aks'], add_categories: ['C2'], remove_categories: ['C2'], rationale: 'It is about Kubernetes', confidence: 0.8 },
    ] }, idx, items, plan);
    expect(drafts).toHaveLength(1);
    // C2 is being merged into C1, so "add C2" becomes "add C1"
    expect(drafts[0].payload).toEqual({
      item_type: 'resource', item_id: 'r-aks',
      add_categories: [{ id: 'c-azure' }], remove_category_ids: ['c-mac'],
      add_subcategories: [{ ref: 'aks' }], remove_subcategory_ids: [],
    });
  });

  it('reuses existing tags by name, defaults new tag locations, and ignores no-ops', () => {
    const { drafts, dropped } = validateItems({ proposals: [
      { item: 'I2', new_tags: [{ name: 'Serverless' }, { name: 'durable-functions' }], add_tags: ['T2'], rationale: '', confidence: 0.9 },
      { item: 'I1', add_tags: ['T3'], rationale: '', confidence: 0.9 },                     // already tagged
      { item: 'I9', add_tags: ['T1'], rationale: '', confidence: 0.9 },                     // unknown item
      { item: 'I2', remove_subcategories: ['S1'], remove_categories: ['C1'], rationale: '', confidence: 0.9 }, // duplicate item
    ] }, idx, items, plan);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].payload).toEqual({
      item_type: 'learning', item_id: 'l-fn',
      add_tags: [{ id: 't-sls' }, { name: 'durable-functions', subcategory: { id: 's-fn' } }],
      remove_tag_ids: [],
    });
    expect(dropped.map((d) => d.reason)).toEqual(['no effective change', 'unknown item', 'duplicate item']);
  });

  it('never leaves an item without a category', () => {
    const { drafts, dropped } = validateItems({ proposals: [
      { item: 'I2', remove_categories: ['C1'], rationale: '', confidence: 0.9 },
    ] }, idx, items, plan);
    expect(drafts).toEqual([]);
    expect(dropped[0].reason).toBe('would leave the item uncategorised');
  });
});

it('summarises proposal counts', () => {
  expect(summarize({ merge_categories: 1, merge_tags: 2, set_item_tags: 1 })).toBe('Recommended 3 merges, 1 tag update.');
  expect(summarize({})).toMatch(/No changes recommended/);
});
