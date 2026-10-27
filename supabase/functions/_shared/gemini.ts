// Gemini REST client shared by the Edge Functions: retries, JSON output, embeddings.

export const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
export const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.1-flash-lite';
export const EMBEDDING_MODEL = Deno.env.get('GEMINI_EMBEDDING_MODEL') ?? 'gemini-embedding-2';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
export const EMBEDDING_DIMS = 768; // must match content_embeddings.embedding
const EMBED_BATCH_SIZE = 20;
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** POST to a Gemini model method, retrying transient failures with exponential backoff + jitter. */
export async function gemini<T>(model: string, method: string, body: unknown, retries = 3): Promise<T> {
  let lastStatus = 0;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(Math.min(8000, 600 * 2 ** (attempt - 1)) + Math.random() * 400);
    let res: Response;
    try {
      res = await fetch(`${GEMINI_BASE}/${model}:${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.warn(`Gemini ${model}:${method} network error (attempt ${attempt + 1})`, err);
      lastStatus = 0;
      continue;
    }
    if (res.ok) return res.json() as Promise<T>;
    lastStatus = res.status;
    const detail = await res.text();
    console.error(`Gemini ${model}:${method} failed (attempt ${attempt + 1})`, res.status, detail.slice(0, 500));
    if (!RETRYABLE.has(res.status)) break;
  }
  throw new HttpError(
    lastStatus === 429 ? 429 : 502,
    lastStatus === 429 ? 'AI rate limit reached, try again shortly' : 'AI provider error',
  );
}

type GenerateResponse = { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };

/** Ask for structured JSON matching `schema`; retries once if the model returns unparseable output. */
export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  history?: { role: 'user' | 'model'; text: string }[];
  temperature?: number;
}): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const data = await gemini<GenerateResponse>(GEMINI_MODEL, 'generateContent', {
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [
        ...(opts.history ?? []).map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
        { role: 'user', parts: [{ text: opts.prompt }] },
      ],
      generationConfig: {
        temperature: opts.temperature ?? 0.2,
        responseMimeType: 'application/json',
        responseSchema: opts.schema,
      },
    });
    const raw = data.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? '').join('') ?? '';
    try {
      return JSON.parse(raw) as T;
    } catch {
      console.warn('Gemini returned invalid JSON, retrying', raw.slice(0, 200));
    }
  }
  throw new HttpError(502, 'AI returned an invalid response');
}

// Truncate (Matryoshka) to EMBEDDING_DIMS and L2-normalise, whatever the model returned.
function normalise(values: number[]): number[] {
  const v = values.slice(0, EMBEDDING_DIMS);
  const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export async function embed(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const data = await gemini<{ embeddings: { values: number[] }[] }>(EMBEDDING_MODEL, 'batchEmbedContents', {
      requests: batch.map((text) => ({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: EMBEDDING_DIMS,
      })),
    });
    out.push(...data.embeddings.map((e) => normalise(e.values)));
  }
  return out;
}

export const toVector = (values: number[]) => `[${values.join(',')}]`;

export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|tr|h[1-6]|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}
