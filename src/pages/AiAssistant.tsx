import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUp,
  BookOpen,
  Copy as CopyIcon,
  Database,
  GraduationCap,
  MessageSquare,
  RefreshCw,
  Search,
  Sparkles,
  Wand2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  AiError,
  askLibrary,
  findNearDuplicates,
  getIndexStatus,
  indexContent,
  itemPath,
  searchContent,
  type AskTurn,
  type ContentMatch,
  type DuplicatePair,
  type IndexStatus,
} from '../lib/ai';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/Skeleton';
import { stripHtml } from '../utils/text';
import { cn } from '../utils/cn';
import { useIsAdmin } from '../hooks/useIsAdmin';

type Mode = 'ask' | 'search';

interface ChatMessage extends AskTurn {
  sources?: ContentMatch[];
}

const SUGGESTIONS = [
  'What have I saved about Docker?',
  'Which learning items are good for beginners?',
  'Summarise my resources on security',
];

function TypeIcon({ type, className }: { type: ContentMatch['item_type']; className?: string }) {
  const Icon = type === 'resource' ? BookOpen : GraduationCap;
  return <Icon className={className} />;
}

function SourceChip({ item }: { item: ContentMatch }) {
  return (
    <Link
      to={itemPath(item.item_type, item.item_id)}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
    >
      <TypeIcon type={item.item_type} className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{item.title}</span>
    </Link>
  );
}

function SetupNotice() {
  return (
    <div className="flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
      <div className="space-y-1">
        <p className="font-semibold text-foreground">AI isn't set up yet</p>
        <p className="text-muted-foreground">
          Apply the <code>add_ai_embeddings</code> migration, deploy the <code>ai</code> Edge Function and set its{' '}
          <code>GEMINI_API_KEY</code> secret. See the README's "AI features" section.
        </p>
      </div>
    </div>
  );
}

export default function AiAssistant() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = useIsAdmin();
  const [mode, setMode] = useState<Mode>('ask');
  const [notConfigured, setNotConfigured] = useState(false);

  // Index health
  const [status, setStatus] = useState<IndexStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Ask
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  // Search
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ContentMatch[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Duplicates
  const [duplicates, setDuplicates] = useState<DuplicatePair[] | null>(null);
  const [scanning, setScanning] = useState(false);

  const handleError = useCallback((e: unknown, fallback: string) => {
    if (e instanceof AiError && (e.code === 'ai_not_configured' || e.code === 'ai_unreachable')) {
      setNotConfigured(true);
      return;
    }
    toast.error(e instanceof Error && e.message ? e.message : fallback);
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await getIndexStatus());
    } catch (e) {
      console.warn('AI index status unavailable', e);
      setNotConfigured(true);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Scroll the thread itself (not the page) to the newest message.
  useEffect(() => {
    const el = threadRef.current;
    if (el && (messages.length > 0 || asking)) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, asking]);

  const syncIndex = async () => {
    setSyncing(true);
    let indexed = 0;
    try {
      // The function embeds a batch per call; keep going until nothing is stale.
      for (let i = 0; i < 50; i++) {
        const res = await indexContent();
        indexed += res.indexed;
        await loadStatus();
        if (res.remaining === 0) break;
      }
      toast.success(indexed ? `Indexed ${indexed} item${indexed === 1 ? '' : 's'}` : 'Everything is already up to date');
    } catch (e) {
      handleError(e, 'Indexing failed');
    } finally {
      setSyncing(false);
    }
  };

  const ask = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || asking) return;
      const history = messages.map(({ role, text }) => ({ role, text }));
      setMessages((prev) => [...prev, { role: 'user', text: q }]);
      setQuestion('');
      setAsking(true);
      try {
        const res = await askLibrary(q, history);
        setMessages((prev) => [...prev, { role: 'model', text: res.answer, sources: res.sources }]);
      } catch (e) {
        setMessages((prev) => prev.slice(0, -1));
        setQuestion(q);
        handleError(e, 'The assistant could not answer');
      } finally {
        setAsking(false);
      }
    },
    [asking, messages, handleError]
  );

  // /ai?q=... (from the global search bar) asks straight away.
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setMode('ask');
      setSearchParams({}, { replace: true });
      ask(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const runSearch = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      setResults((await searchContent(query.trim())).results);
    } catch (err) {
      handleError(err, 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const scanDuplicates = async () => {
    setScanning(true);
    try {
      setDuplicates(await findNearDuplicates());
    } catch (e) {
      handleError(e, 'Duplicate scan failed');
    } finally {
      setScanning(false);
    }
  };

  const coverage = status && status.total_items > 0 ? status.indexed_items / status.total_items : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Assistant"
        subtitle="Ask questions and search across your library. Answers come only from your own content."
      />

      {notConfigured && <SetupNotice />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Ask / Search */}
        <section className="flex min-h-[560px] flex-col rounded-2xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div role="tablist" className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
              {([
                ['ask', 'Ask', MessageSquare],
                ['search', 'Search', Search],
              ] as const).map(([value, label, Icon]) => (
                <button
                  key={value}
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => setMode(value)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    mode === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
            {mode === 'ask' && messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                New conversation
              </button>
            )}
          </div>

          {mode === 'ask' ? (
            <>
              <div ref={threadRef} className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6" aria-live="polite">
                {messages.length === 0 && !asking && (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                      <Sparkles className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="text-lg font-semibold text-foreground">Ask your library anything</h2>
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">
                      The assistant finds the most relevant items you've saved and answers from them, with links.
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          onClick={() => ask(s)}
                          className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) =>
                  m.role === 'user' ? (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                        {m.text}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="flex gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{m.text}</div>
                        {m.sources && m.sources.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {m.sources.map((s) => (
                              <SourceChip key={`${s.item_type}:${s.item_id}`} item={s} />
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => navigator.clipboard.writeText(m.text).then(() => toast.success('Answer copied'))}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <CopyIcon className="h-3 w-3" /> Copy
                        </button>
                      </div>
                    </div>
                  )
                )}

                {asking && (
                  <div className="flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Sparkles className="h-4 w-4 animate-pulse text-primary" />
                    </div>
                    <div className="flex-1 space-y-2 pt-1">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(question);
                }}
                className="border-t border-border p-3 sm:p-4"
              >
                <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/40">
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        ask(question);
                      }
                    }}
                    rows={1}
                    maxLength={1000}
                    placeholder="Ask about anything in your library…"
                    className="max-h-40 flex-1 resize-none border-none bg-transparent py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
                  />
                  <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={!question.trim() || asking} aria-label="Ask">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Answers use only your indexed content. Enter to send, Shift+Enter for a new line.
                </p>
              </form>
            </>
          ) : (
            <div className="flex-1 p-4 sm:p-6">
              <form onSubmit={runSearch} className="mb-5 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Describe what you're looking for…"
                    className="input-primary py-2.5 pl-10"
                  />
                </div>
                <Button type="submit" loading={searching} disabled={!query.trim()}>
                  Search
                </Button>
              </form>

              {searching ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-20 rounded-xl" />
                  ))}
                </div>
              ) : results === null ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Search by meaning, not just keywords. Try “guides for setting up CI”.
                </p>
              ) : results.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No matching content found.</p>
              ) : (
                <ul className="space-y-2">
                  {results.map((r) => (
                    <li key={`${r.item_type}:${r.item_id}`}>
                      <Link
                        to={itemPath(r.item_type, r.item_id)}
                        className="block rounded-xl border border-border p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <TypeIcon type={r.item_type} className="h-3.5 w-3.5" />
                            {r.item_type === 'resource' ? 'Resource' : 'Learning'}
                          </span>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                            {r.match === 'title' ? 'Title match' : `${Math.round(r.similarity * 100)}% match`}
                          </span>
                        </div>
                        <div className="font-medium text-foreground">{r.title}</div>
                        {r.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{stripHtml(r.description)}</p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* Side panel */}
        <aside className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="mb-4 flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Knowledge index</h2>
            </div>
            {status ? (
              <>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-foreground">{Math.round(coverage * 100)}%</span>
                  <span className="text-xs text-muted-foreground">
                    {status.indexed_items} / {status.total_items} items
                  </span>
                </div>
                <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${coverage * 100}%` }} />
                </div>
                <p className="mb-4 text-xs text-muted-foreground">
                  {status.last_indexed_at
                    ? `Last updated ${new Date(status.last_indexed_at).toLocaleString()}`
                    : 'Not indexed yet'}
                  . New and edited items are indexed automatically when saved.
                </p>
              </>
            ) : (
              <Skeleton className="mb-4 h-16" />
            )}
            <Button variant="outline" className="w-full" onClick={syncIndex} loading={syncing}>
              {!syncing && <RefreshCw className="h-4 w-4" />}
              {syncing ? 'Indexing…' : 'Sync index'}
            </Button>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="mb-1 flex items-center gap-2">
              <CopyIcon className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Duplicate items</h2>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">Items that say almost the same thing — candidates to merge or delete.</p>
            {duplicates && (
              duplicates.length === 0 ? (
                <p className="mb-4 text-sm text-muted-foreground">No near-duplicates found.</p>
              ) : (
                <ul className="mb-4 max-h-80 space-y-2 overflow-y-auto">
                  {duplicates.map((d) => (
                    <li key={`${d.a_id}-${d.b_id}`} className="rounded-lg border border-border p-3 text-sm">
                      <div className="mb-1 text-xs font-medium text-primary">{Math.round(d.similarity * 100)}% similar</div>
                      <Link to={itemPath(d.a_type, d.a_id)} className="block truncate text-foreground hover:text-primary">
                        {d.a_title}
                      </Link>
                      <Link to={itemPath(d.b_type, d.b_id)} className="block truncate text-foreground hover:text-primary">
                        {d.b_title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            )}
            <Button variant="outline" className="w-full" onClick={scanDuplicates} loading={scanning}>
              Scan library
            </Button>
          </section>

          {isAdmin && (
            <Link
              to="/ai/organize"
              className="group block rounded-2xl border border-border bg-card p-5 shadow-card transition-colors hover:border-primary/40"
            >
              <div className="mb-1 flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground group-hover:text-primary">Library Organizer</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Find duplicate categories, inconsistent names, misfiled items and missing tags, then review and apply fixes.
              </p>
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
