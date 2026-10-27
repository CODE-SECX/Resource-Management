import { supabase } from './supabase';

export type ContentType = 'resource' | 'learning';

export interface ContentMatch {
  item_type: ContentType;
  item_id: string;
  title: string;
  description: string | null;
  url: string | null;
  tags: string[] | null;
  similarity: number;
  /** 'title' = exact title hit, 'semantic' = meaning-based match */
  match?: 'title' | 'semantic';
}

export interface AskTurn {
  role: 'user' | 'model';
  text: string;
}

export interface IndexStatus {
  total_items: number;
  indexed_items: number;
  last_indexed_at: string | null;
}

export interface DuplicatePair {
  a_type: ContentType;
  a_id: string;
  a_title: string;
  b_type: ContentType;
  b_id: string;
  b_title: string;
  similarity: number;
}

export class AiError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

export const itemPath = (type: ContentType, id: string) =>
  type === 'resource' ? `/resources/${id}` : `/learning/${id}`;

async function callAi<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai', { body });
  if (error) {
    // FunctionsHttpError carries the function's JSON error body in `context`
    let message = 'AI request failed';
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

/** Embed new/changed items. With `items`, only those are checked. */
export function indexContent(items?: { type: ContentType; id: string }[], limit?: number) {
  return callAi<{ indexed: number; remaining: number; total: number }>({ action: 'index', items, limit });
}

/** Re-index one item after it was created or edited. Never throws. */
export function reindexItem(type: ContentType, id: string) {
  indexContent([{ type, id }]).catch((e) => console.warn('AI re-index skipped:', e.message));
}

export function searchContent(query: string, type?: ContentType) {
  return callAi<{ results: ContentMatch[] }>({ action: 'search', query, type });
}

export function askLibrary(question: string, history: AskTurn[] = []) {
  return callAi<{ answer: string; sources: ContentMatch[] }>({ action: 'ask', question, history });
}

export async function getRelatedContent(type: ContentType, id: string, count = 6) {
  const { data, error } = await supabase.rpc('related_content', {
    p_item_type: type,
    p_item_id: id,
    match_count: count,
  });
  if (error) throw error;
  return (data ?? []) as ContentMatch[];
}

export async function getIndexStatus(): Promise<IndexStatus> {
  const { data, error } = await supabase.rpc('ai_index_status');
  if (error) throw error;
  return (data?.[0] ?? { total_items: 0, indexed_items: 0, last_indexed_at: null }) as IndexStatus;
}

export async function findNearDuplicates(threshold = 0.92) {
  const { data, error } = await supabase.rpc('find_near_duplicates', { threshold });
  if (error) throw error;
  return (data ?? []) as DuplicatePair[];
}

export async function isIndexed(type: ContentType, id: string) {
  const { count } = await supabase
    .from('content_embeddings')
    .select('id', { count: 'exact', head: true })
    .eq('item_type', type)
    .eq('item_id', id);
  return (count ?? 0) > 0;
}
