import { supabase } from './supabase';
import { AiError, indexContent, type ContentType } from './ai';

export type InspectionMode = 'full' | 'incremental';
export type InspectionStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'applied' | 'failed' | 'rolled_back';
export type ProposalKind =
  | 'create_category' | 'rename_category' | 'merge_categories'
  | 'create_subcategory' | 'rename_subcategory' | 'move_subcategory' | 'merge_subcategories'
  | 'rename_tag' | 'merge_tags'
  | 'reassign_item' | 'set_item_tags';

export interface SnapshotTag { id: string; name: string; usage: number }
export interface SnapshotSubcategory { id: string; name: string; item_count: number; tags: SnapshotTag[] }
export interface SnapshotCategory {
  id: string;
  name: string;
  item_count: number;
  tags: SnapshotTag[];
  subcategories: SnapshotSubcategory[];
}
export interface TaxonomySnapshot { categories: SnapshotCategory[]; total_items: number; uncategorized_items: number }

export interface InspectionSummary {
  id: string;
  mode: InspectionMode;
  status: InspectionStatus;
  item_count: number;
  items_processed: number;
  analyze_structure: boolean;
  structure_done: boolean;
  summary: string | null;
  error: string | null;
  stats: { new_items?: number; changed_items?: number; dropped?: number; structure_changed?: boolean };
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  heartbeat_at: string | null;
  proposals_total: number;
  proposals_pending: number;
  proposals_approved: number;
  proposals_rejected: number;
  proposals_applied: number;
  proposals_failed: number;
}

export interface Inspection extends InspectionSummary {
  current_structure: TaxonomySnapshot | null;
  log: { at: string; level: 'info' | 'warn' | 'error'; message: string }[];
}

export interface Proposal {
  id: string;
  inspection_id: string;
  seq: number;
  kind: ProposalKind;
  ref: string | null;
  payload: Record<string, unknown>;
  summary: string;
  rationale: string | null;
  confidence: number | null;
  status: ProposalStatus;
  error: string | null;
  result: { affected_items?: { type: ContentType; id: string }[] } | null;
  created_at: string;
  decided_at: string | null;
  applied_at: string | null;
}

export interface ApplyResult {
  id: string;
  kind: ProposalKind;
  status: ProposalStatus;
  error: string | null;
  affected_items: { type: ContentType; id: string }[];
}

/** A "running" inspection with no heartbeat for this long has been interrupted and can resume. */
export const STALE_AFTER_MS = 90_000;

export async function checkIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) return false;
  return data === true;
}

const SUMMARY_COLUMNS =
  'id, mode, status, item_count, items_processed, analyze_structure, structure_done, summary, error, stats, created_at, started_at, completed_at, heartbeat_at, ' +
  'proposals_total, proposals_pending, proposals_approved, proposals_rejected, proposals_applied, proposals_failed';

export async function listInspections(limit = 50): Promise<InspectionSummary[]> {
  const { data, error } = await supabase
    .from('taxonomy_inspection_summary')
    .select(SUMMARY_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as InspectionSummary[];
}

export async function getInspection(id: string): Promise<Inspection> {
  const { data, error } = await supabase
    .from('taxonomy_inspection_summary')
    .select(`${SUMMARY_COLUMNS}, current_structure, log`)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as unknown as Inspection;
}

export async function getProposals(inspectionId: string): Promise<Proposal[]> {
  const { data, error } = await supabase
    .from('taxonomy_proposals')
    .select('id, inspection_id, seq, kind, ref, payload, summary, rationale, confidence, status, error, result, created_at, decided_at, applied_at')
    .eq('inspection_id', inspectionId)
    .order('seq');
  if (error) throw error;
  return (data ?? []) as Proposal[];
}

/** Items that are new or changed since they were last inspected. */
export async function countChangedItems(): Promise<number> {
  const { data, error } = await supabase.rpc('taxonomy_affected_items', { p_full: false });
  if (error) throw error;
  return (data ?? []).length;
}

async function invokeInspector<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('taxonomy-inspector', { body });
  if (error) {
    let message = 'Inspection request failed';
    let code: string | undefined;
    try {
      const payload = await (error as { context?: Response }).context?.json();
      message = payload?.error ?? message;
      code = payload?.code;
    } catch {
      if (error.message?.includes('Failed to send')) code = 'ai_unreachable';
    }
    throw new AiError(message, code);
  }
  return data as T;
}

export function startInspection(mode: InspectionMode) {
  return invokeInspector<{ inspection_id: string; already_running?: boolean; resumed?: boolean; nothing_to_do?: boolean }>({ action: 'start', mode });
}

export function resumeInspection(inspectionId: string) {
  return invokeInspector<{ inspection_id: string; already_running?: boolean; resumed?: boolean }>({ action: 'resume', inspection_id: inspectionId });
}

export async function cancelInspection(inspectionId: string) {
  const { error } = await supabase.from('taxonomy_inspections').update({ status: 'cancelled' }).eq('id', inspectionId);
  if (error) throw error;
}

/** Approve / reject / reset proposals (only allowed from pending, approved, rejected or failed). */
export async function decideProposals(ids: string[], status: 'pending' | 'approved' | 'rejected') {
  const { error } = await supabase
    .from('taxonomy_proposals')
    .update({ status })
    .in('id', ids)
    .in('status', ['pending', 'approved', 'rejected', 'failed']);
  if (error) throw error;
}

/** Re-embed items whose taxonomy changed so "Related content" and AI search stay accurate. */
function refreshEmbeddings(results: { affected_items?: { type: ContentType; id: string }[] }[]) {
  const items = new Map<string, { type: ContentType; id: string }>();
  results.forEach((r) => r.affected_items?.forEach((i) => items.set(`${i.type}:${i.id}`, i)));
  if (items.size) indexContent([...items.values()], 100).catch((e) => console.warn('Embedding refresh skipped:', e.message));
}

/** Apply proposals in dependency order. With `atomic`, any failure cancels the whole batch. */
export async function applyProposals(ids: string[], atomic = false): Promise<ApplyResult[]> {
  const { data, error } = await supabase.rpc('apply_taxonomy_proposals', { p_ids: ids, p_atomic: atomic });
  if (error) throw error;
  const results = (data ?? []) as ApplyResult[];
  refreshEmbeddings(results);
  return results;
}

export async function rollbackProposal(id: string) {
  const { data, error } = await supabase.rpc('rollback_taxonomy_proposal', { p_id: id });
  if (error) throw error;
  refreshEmbeddings([data as ApplyResult]);
  return data as ApplyResult;
}
