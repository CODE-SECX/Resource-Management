// AI endpoint: embeds content with Gemini, runs semantic search, and answers
// questions grounded only in the caller's own resources & learning items.
//
// Secrets (supabase secrets set ...):
//   GEMINI_API_KEY          required
//   GEMINI_MODEL            default gemini-3.1-flash-lite
//   GEMINI_EMBEDDING_MODEL  default gemini-embedding-2
//
// All database access uses the caller's JWT, so RLS scopes everything to their rows.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { EMBEDDING_MODEL, GEMINI_API_KEY, HttpError, embed, generateJson, htmlToText, toVector } from '../_shared/gemini.ts';
import { corsHeaders, errorResponse, json, userClient } from '../_shared/http.ts';

const DEFAULT_INDEX_LIMIT = 40; // items embedded per request; the client loops for more
const MAX_DOC_CHARS = 12_000;
const MAX_QUESTION_CHARS = 1_000;

type ItemType = 'resource' | 'learning';

interface ContentItem {
  item_type: ItemType;
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  html_content: string | null;
  difficulty_level?: string | null;
  categories: string[];
  subcategories: string[];
  tags: string[];
}

interface Match {
  item_type: ItemType;
  item_id: string;
  title: string;
  description: string | null;
  url: string | null;
  tags: string[] | null;
  similarity: number;
}

// gemini-embedding-2 takes the retrieval task as a text prefix (no taskType field).
// Taxonomy names come from the junction tables, so similar items cluster by topic as well as text.
function documentText(item: ContentItem): string {
  const lines = [
    `Type: ${item.item_type === 'resource' ? 'Resource' : 'Learning item'}`,
    item.difficulty_level ? `Skill level: ${item.difficulty_level}` : '',
    item.categories.length ? `Categories: ${item.categories.join(', ')}` : '',
    item.subcategories.length ? `Topics: ${item.subcategories.join(', ')}` : '',
    item.tags.length ? `Tags: ${item.tags.join(', ')}` : '',
    item.url ? `URL: ${item.url}` : '',
    htmlToText(item.description),
    htmlToText(item.html_content),
  ].filter(Boolean);
  return `title: ${item.title || 'none'} | text: ${lines.join('\n')}`.slice(0, MAX_DOC_CHARS);
}

function queryText(query: string): string {
  return `task: search result | query: ${query}`;
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function loadItems(db: SupabaseClient, only?: { type: ItemType; id: string }[]): Promise<ContentItem[]> {
  const ids = (type: ItemType) => only?.filter((o) => o.type === type).map((o) => o.id);
  const fetchTable = async (type: ItemType) => {
    const wanted = ids(type);
    if (wanted && wanted.length === 0) return [];
    const p = type === 'resource' ? 'resource' : 'learning';
    let query = db
      .from(type === 'resource' ? 'resources' : 'learning')
      .select(`id, title, description, url, html_content${type === 'learning' ? ', difficulty_level' : ''}, ` +
        `${p}_categories(categories(name)), ${p}_subcategories(subcategories(name)), ${p}_tags(tags(name))`);
    if (wanted) query = query.in('id', wanted);
    const { data, error } = await query;
    if (error) throw error;
    const names = (rows: unknown, key: string) =>
      ((rows ?? []) as Record<string, { name: string } | null>[]).map((r) => r[key]?.name).filter((n): n is string => !!n).sort();
    return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
      item_type: type,
      id: row.id as string,
      title: row.title as string,
      description: row.description as string | null,
      url: row.url as string | null,
      html_content: row.html_content as string | null,
      difficulty_level: row.difficulty_level as string | null | undefined,
      categories: names(row[`${p}_categories`], 'categories'),
      subcategories: names(row[`${p}_subcategories`], 'subcategories'),
      tags: names(row[`${p}_tags`], 'tags'),
    }));
  };
  const [resources, learning] = await Promise.all([fetchTable('resource'), fetchTable('learning')]);
  return [...resources, ...learning];
}

async function indexContent(db: SupabaseClient, userId: string, body: { items?: { type: ItemType; id: string }[]; limit?: number }) {
  const fullSync = !body.items;
  const items = await loadItems(db, body.items);

  const { data: existing, error } = await db.from('content_embeddings').select('item_type, item_id, content_hash');
  if (error) throw error;
  const known = new Map((existing ?? []).map((e) => [`${e.item_type}:${e.item_id}`, e.content_hash as string]));

  const stale: { item: ContentItem; text: string; hash: string }[] = [];
  for (const item of items) {
    const text = documentText(item);
    const hash = await sha256(`${EMBEDDING_MODEL}\n${text}`);
    if (known.get(`${item.item_type}:${item.id}`) !== hash) stale.push({ item, text, hash });
  }

  const limit = Math.min(Math.max(body.limit ?? DEFAULT_INDEX_LIMIT, 1), 100);
  const batch = stale.slice(0, limit);
  if (batch.length > 0) {
    const vectors = await embed(batch.map((s) => s.text));
    const rows = batch.map((s, i) => ({
      user_id: userId,
      item_type: s.item.item_type,
      item_id: s.item.id,
      embedding: toVector(vectors[i]),
      content_hash: s.hash,
      model: EMBEDDING_MODEL,
      updated_at: new Date().toISOString(),
    }));
    const { error: upsertError } = await db.from('content_embeddings').upsert(rows, { onConflict: 'item_type,item_id' });
    if (upsertError) throw upsertError;
  }

  // On a full sync, drop embeddings whose item no longer exists.
  if (fullSync) {
    const live = new Set(items.map((i) => `${i.item_type}:${i.id}`));
    const orphans = (existing ?? []).filter((e) => !live.has(`${e.item_type}:${e.item_id}`));
    for (const type of ['resource', 'learning'] as const) {
      const orphanIds = orphans.filter((o) => o.item_type === type).map((o) => o.item_id);
      if (orphanIds.length) await db.from('content_embeddings').delete().eq('item_type', type).in('item_id', orphanIds);
    }
  }

  return { indexed: batch.length, remaining: stale.length - batch.length, total: items.length };
}

async function semanticSearch(db: SupabaseClient, query: string, opts: { limit?: number; type?: ItemType; minSimilarity?: number }) {
  const [vector] = await embed([queryText(query)]);
  const { data, error } = await db.rpc('match_content', {
    query_embedding: toVector(vector),
    match_count: opts.limit ?? 10,
    min_similarity: opts.minSimilarity ?? 0.35,
    filter_type: opts.type ?? null,
  });
  if (error) throw error;
  return (data ?? []) as Match[];
}

// Exact title hits catch acronyms / names that embeddings can rank low.
async function keywordSearch(db: SupabaseClient, query: string): Promise<Match[]> {
  const term = query.replace(/[,()"\\%*]/g, ' ').trim();
  if (!term) return [];
  const run = async (type: ItemType) => {
    const { data } = await db
      .from(type === 'resource' ? 'resources' : 'learning')
      .select('id, title, description, url, tags')
      .ilike('title', `%${term}%`)
      .limit(5);
    return (data ?? []).map((r) => ({ item_type: type, item_id: r.id, title: r.title, description: r.description, url: r.url, tags: r.tags, similarity: 1 }));
  };
  return (await Promise.all([run('resource'), run('learning')])).flat();
}

async function search(db: SupabaseClient, body: { query?: string; type?: ItemType; limit?: number }) {
  const query = (body.query ?? '').trim().slice(0, MAX_QUESTION_CHARS);
  if (!query) throw new HttpError(400, 'query is required');
  const [semantic, keyword] = await Promise.all([
    semanticSearch(db, query, { limit: body.limit ?? 20, type: body.type }),
    keywordSearch(db, query),
  ]);
  const seen = new Set<string>();
  const results = [...keyword.map((k) => ({ ...k, match: 'title' as const })), ...semantic.map((s) => ({ ...s, match: 'semantic' as const }))]
    .filter((r) => (!body.type || r.item_type === body.type))
    .filter((r) => {
      const key = `${r.item_type}:${r.item_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return { results };
}

const ASK_SYSTEM_PROMPT = `You are the assistant inside a personal knowledge base of saved resources and learning items.
Answer ONLY from the numbered library items provided in the user's message. Never use outside knowledge, and never invent items, links or facts.
If the items don't contain the answer, say plainly that nothing in the library covers it, and suggest what the user might add.
Be concise and well structured (short paragraphs or bullet points, plain text, no markdown headings).
Refer to items by their title. In "source_ids" list the numbers of every item you relied on, most relevant first.`;

async function ask(db: SupabaseClient, body: { question?: string; history?: { role: 'user' | 'model'; text: string }[] }) {
  const question = (body.question ?? '').trim().slice(0, MAX_QUESTION_CHARS);
  if (!question) throw new HttpError(400, 'question is required');

  const matches = await semanticSearch(db, question, { limit: 8, minSimilarity: 0.3 });
  if (matches.length === 0) {
    return {
      answer: "I couldn't find anything in your library about that. Try different wording, or make sure your content is indexed on the AI page.",
      sources: [],
    };
  }

  const context = matches
    .map((m, i) => [
      `[${i + 1}] ${m.title} (${m.item_type})`,
      m.url ? `URL: ${m.url}` : '',
      m.tags?.length ? `Tags: ${m.tags.join(', ')}` : '',
      htmlToText(m.description).slice(0, 1500),
    ].filter(Boolean).join('\n'))
    .join('\n\n');

  const history = (body.history ?? []).slice(-6).map((h) => ({
    role: h.role === 'model' ? 'model' as const : 'user' as const,
    text: h.text.slice(0, 2000),
  }));

  const parsed = await generateJson<{ answer?: string; source_ids?: number[] }>({
    system: ASK_SYSTEM_PROMPT,
    history,
    prompt: `Library items:\n\n${context}\n\nQuestion: ${question}`,
    schema: {
      type: 'OBJECT',
      properties: {
        answer: { type: 'STRING' },
        source_ids: { type: 'ARRAY', items: { type: 'INTEGER' } },
      },
      required: ['answer', 'source_ids'],
    },
  });

  const sources = (parsed.source_ids ?? [])
    .map((n) => matches[n - 1])
    .filter((m): m is Match => Boolean(m))
    .filter((m, i, all) => all.findIndex((x) => x.item_id === m.item_id) === i);

  return { answer: parsed.answer?.trim() || 'No answer was generated.', sources };
}

// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    if (!GEMINI_API_KEY) throw new HttpError(503, 'AI is not configured: set the GEMINI_API_KEY secret', 'ai_not_configured');
    const { db, userId } = await userClient(req);

    const body = await req.json().catch(() => ({}));
    switch (body.action) {
      case 'index':
        return json(await indexContent(db, userId, body));
      case 'search':
        return json(await search(db, body));
      case 'ask':
        return json(await ask(db, body));
      default:
        throw new HttpError(400, `Unknown action: ${body.action}`);
    }
  } catch (err) {
    return errorResponse(err);
  }
});
