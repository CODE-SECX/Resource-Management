import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  ChevronRight,
  Download,
  FolderPlus,
  FolderTree,
  GitMerge,
  History,
  Loader2,
  MoveRight,
  PencilLine,
  Play,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  Tags,
  Undo2,
  Wand2,
  X,
  type LucideIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/Skeleton';
import { Modal } from '../components/Modal';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { AiError } from '../lib/ai';
import {
  STALE_AFTER_MS,
  applyProposals,
  cancelInspection,
  countChangedItems,
  decideProposals,
  getInspection,
  getProposals,
  listInspections,
  resumeInspection,
  rollbackProposal,
  startInspection,
  type Inspection,
  type InspectionMode,
  type InspectionSummary,
  type Proposal,
  type ProposalKind,
  type ProposalStatus,
} from '../lib/taxonomyInspector';
import { cn } from '../utils/cn';

type Tab = 'recommendations' | 'structure' | 'history' | 'log';
type StatusFilter = 'actionable' | ProposalStatus | 'all';

const GROUPS: { id: string; label: string; icon: LucideIcon; kinds: ProposalKind[] }[] = [
  { id: 'merge', label: 'Duplicates to merge', icon: GitMerge, kinds: ['merge_categories', 'merge_subcategories', 'merge_tags'] },
  { id: 'rename', label: 'Naming fixes', icon: PencilLine, kinds: ['rename_category', 'rename_subcategory', 'rename_tag'] },
  { id: 'create', label: 'New categories & subcategories', icon: FolderPlus, kinds: ['create_category', 'create_subcategory'] },
  { id: 'move', label: 'Restructure', icon: MoveRight, kinds: ['move_subcategory'] },
  { id: 'items', label: 'Item placement', icon: ArrowRightLeft, kinds: ['reassign_item'] },
  { id: 'tags', label: 'Tags', icon: Tags, kinds: ['set_item_tags'] },
];

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  approved: 'bg-primary/10 text-primary',
  rejected: 'bg-muted text-muted-foreground line-through',
  applied: 'bg-success/15 text-success',
  failed: 'bg-destructive/10 text-destructive',
  rolled_back: 'bg-warning/15 text-warning',
  queued: 'bg-muted text-muted-foreground',
  running: 'bg-primary/10 text-primary',
  completed: 'bg-success/15 text-success',
  cancelled: 'bg-muted text-muted-foreground',
};

const isActive = (i: InspectionSummary | null) => !!i && (i.status === 'queued' || i.status === 'running');
const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—');

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize', STATUS_STYLES[status] ?? STATUS_STYLES.pending)}>
      {status.replace('_', ' ')}
    </span>
  );
}

function ConfidenceBadge({ value }: { value: number | null }) {
  if (value == null) return null;
  const [label, style] = value >= 0.85 ? ['High', 'text-success'] : value >= 0.65 ? ['Medium', 'text-primary'] : ['Low', 'text-warning'];
  return <span className={cn('text-xs font-medium', style)} title={`Confidence ${Math.round(value * 100)}%`}>{label} confidence</span>;
}

interface ConfirmState {
  title: string;
  description: string;
  items: string[];
  confirmLabel: string;
  allowAtomic: boolean;
  onConfirm: (atomic: boolean) => Promise<void>;
}

export default function LibraryOrganizer() {
  const isAdmin = useIsAdmin();
  const [tab, setTab] = useState<Tab>('recommendations');
  const [inspections, setInspections] = useState<InspectionSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Inspection | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [changedItems, setChangedItems] = useState<number | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('actionable');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [atomic, setAtomic] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const resuming = useRef(false);

  const handleError = useCallback((e: unknown, fallback: string) => {
    if (e instanceof AiError && (e.code === 'ai_not_configured' || e.code === 'ai_unreachable')) {
      setNotConfigured(true);
      return;
    }
    toast.error(e instanceof Error && e.message ? e.message : fallback);
  }, []);

  const loadList = useCallback(async () => {
    try {
      const list = await listInspections();
      setInspections(list);
      setSelectedId((cur) => cur ?? list[0]?.id ?? null);
    } catch (e) {
      console.warn('Inspections unavailable', e);
      setNotConfigured(true);
      setInspections([]);
    }
    countChangedItems().then(setChangedItems).catch(() => setChangedItems(null));
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const [insp, props] = await Promise.all([getInspection(id), getProposals(id)]);
    setDetail(insp);
    setProposals(props);
  }, []);

  useEffect(() => {
    if (isAdmin) loadList();
  }, [isAdmin, loadList]);

  useEffect(() => {
    if (!selectedId) return;
    setSelected(new Set());
    loadDetail(selectedId).catch((e) => handleError(e, 'Could not load inspection'));
  }, [selectedId, loadDetail, handleError]);

  // While an inspection runs: poll, and resume it if it paused or was interrupted.
  const activeId = detail && isActive(detail) ? detail.id : null;
  useEffect(() => {
    if (!activeId) return;
    const timer = setInterval(async () => {
      try {
        const insp = await getInspection(activeId);
        setDetail(insp);
        const last = new Date(insp.heartbeat_at ?? insp.created_at).getTime();
        const stalled = insp.status === 'queued' ? Date.now() - last > 10_000 : insp.status === 'running' && Date.now() - last > STALE_AFTER_MS;
        if (stalled && !resuming.current) {
          resuming.current = true;
          await resumeInspection(insp.id).catch((e) => handleError(e, 'Could not resume inspection'));
          resuming.current = false;
        }
        if (!isActive(insp)) {
          setProposals(await getProposals(insp.id));
          loadList();
          if (insp.status === 'completed') toast.success(insp.summary ?? 'Inspection complete');
          if (insp.status === 'failed') toast.error(`Inspection failed: ${insp.error ?? 'unknown error'}`);
        }
      } catch (e) {
        console.warn('Polling failed', e);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [activeId, loadList, handleError]);

  const refresh = async () => {
    if (selectedId) await loadDetail(selectedId);
    await loadList();
  };

  const run = async (mode: InspectionMode) => {
    setBusy(`run-${mode}`);
    try {
      const res = await startInspection(mode);
      if (res.nothing_to_do) toast.success('Nothing new or changed since the last inspection');
      else if (res.already_running) toast('An inspection is already running');
      setSelectedId(res.inspection_id);
      setTab('recommendations');
      await loadDetail(res.inspection_id);
      await loadList();
    } catch (e) {
      handleError(e, 'Could not start the inspection');
    } finally {
      setBusy(null);
    }
  };

  const decide = async (ids: string[], status: 'pending' | 'approved' | 'rejected') => {
    setBusy(`decide-${status}`);
    try {
      await decideProposals(ids, status);
      setSelected(new Set());
      await refresh();
    } catch (e) {
      handleError(e, 'Could not update recommendations');
    } finally {
      setBusy(null);
    }
  };

  const askApply = (ids: string[]) => {
    const items = proposals.filter((p) => ids.includes(p.id));
    setAtomic(false);
    setConfirm({
      title: `Apply ${items.length} change${items.length === 1 ? '' : 's'}?`,
      description: 'Changes run in a safe order (new nodes, renames, moves, merges, then items). Each one can be undone afterwards.',
      items: items.map((p) => p.summary),
      confirmLabel: 'Apply changes',
      allowAtomic: items.length > 1,
      onConfirm: async (all) => {
        const results = await applyProposals(ids, all);
        const ok = results.filter((r) => r.status === 'applied').length;
        const failed = results.filter((r) => r.status === 'failed').length;
        if (failed) toast.error(`${ok} applied, ${failed} failed. See the errors on each recommendation.`);
        else toast.success(`${ok} change${ok === 1 ? '' : 's'} applied`);
      },
    });
  };

  const askRollback = (p: Proposal) => {
    setConfirm({
      title: 'Undo this change?',
      description: 'The library is restored to how it was before this change was applied.',
      items: [p.summary],
      confirmLabel: 'Undo change',
      allowAtomic: false,
      onConfirm: async () => {
        await rollbackProposal(p.id);
        toast.success('Change undone');
      },
    });
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy('confirm');
    try {
      await confirm.onConfirm(atomic);
      setConfirm(null);
      setSelected(new Set());
      await refresh();
    } catch (e) {
      handleError(e, 'The operation failed');
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const exportJson = () => {
    if (!detail) return;
    const { log: _log, ...inspection } = detail;
    const blob = new Blob([JSON.stringify({
      inspection,
      proposals: proposals.map(({ id, kind, status, ref, payload, summary, rationale, confidence, error }) => ({ id, kind, status, ref, payload, summary, rationale, confidence, error })),
    }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `library-inspection-${detail.created_at.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    proposals.forEach((p) => (c[p.status] = (c[p.status] ?? 0) + 1));
    return c;
  }, [proposals]);

  const visible = useMemo(() => proposals.filter((p) =>
    filter === 'all' ? true : filter === 'actionable' ? ['pending', 'approved', 'failed'].includes(p.status) : p.status === filter,
  ), [proposals, filter]);

  const approvedIds = proposals.filter((p) => p.status === 'approved').map((p) => p.id);
  const selectedIds = [...selected];
  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  };

  // ---------------------------------------------------------------------------

  if (isAdmin === null) {
    return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64" /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ShieldCheck className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Admins only</h2>
          <p className="mt-1 text-sm text-muted-foreground">The Library Organizer can change categories and tags across your library, so it needs the admin role.</p>
          <Link to="/ai" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Back to AI Assistant</Link>
        </div>
      </div>
    );
  }

  const latest = inspections?.[0] ?? null;
  const running = isActive(latest);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Library Organizer"
        subtitle="AI reviews your categories, subcategories, tags and items, then recommends fixes you can review, apply and undo."
        actions={
          <>
            <Button variant="outline" onClick={() => run('full')} loading={busy === 'run-full'} disabled={running || !!busy}>
              Full inspection
            </Button>
            <Button onClick={() => run('incremental')} loading={busy === 'run-incremental'} disabled={running || !!busy}>
              {busy !== 'run-incremental' && <Wand2 className="h-4 w-4" />}
              Inspect changes
            </Button>
          </>
        }
      />

      {notConfigured && (
        <div className="flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">Organizer isn't set up yet. </span>
            Apply the <code>add_taxonomy_inspector</code> migration and deploy the <code>taxonomy-inspector</code> function (see the README's "Library Organizer" section).
          </p>
        </div>
      )}

      {/* Overview strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['New or changed items', changedItems ?? '—', 'since their last inspection'],
          ['Awaiting review', (latest?.proposals_pending ?? 0) + (latest?.proposals_approved ?? 0) + (latest?.proposals_failed ?? 0), 'in the latest inspection'],
          ['Last inspection', latest ? new Date(latest.created_at).toLocaleDateString() : 'Never', latest ? `${latest.mode} · ${latest.status}` : 'run one to get started'],
        ].map(([label, value, hint]) => (
          <div key={label as string} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold capitalize text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>

      {detail && <RunPanel inspection={detail} onCancel={async () => { await cancelInspection(detail.id); await refresh(); }} onResume={async () => {
        try { await resumeInspection(detail.id); await refresh(); } catch (e) { handleError(e, 'Could not resume'); }
      }} />}

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
          {([
            ['recommendations', 'Recommendations', ListBadge((counts.pending ?? 0) + (counts.approved ?? 0) + (counts.failed ?? 0))],
            ['structure', 'Current structure', null],
            ['history', 'History', null],
            ['log', 'Activity log', null],
          ] as const).map(([id, label, badge]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                'inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                tab === id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
              {badge}
            </button>
          ))}
        </nav>
      </div>

      {inspections === null ? (
        <Skeleton className="h-64" />
      ) : !detail ? (
        <EmptyState onRun={() => run('full')} />
      ) : tab === 'recommendations' ? (
        <section className="space-y-4">
          {detail.summary && <p className="text-sm text-muted-foreground">{detail.summary}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {([
                ['actionable', 'To review', (counts.pending ?? 0) + (counts.approved ?? 0) + (counts.failed ?? 0)],
                ['applied', 'Applied', counts.applied ?? 0],
                ['rejected', 'Rejected', counts.rejected ?? 0],
                ['rolled_back', 'Undone', counts.rolled_back ?? 0],
                ['all', 'All', proposals.length],
              ] as const).map(([value, label, n]) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    filter === value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label} <span className="opacity-70">{n}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={exportJson} disabled={!proposals.length}>
                <Download className="h-4 w-4" /> Export JSON
              </Button>
              <Button size="sm" onClick={() => askApply(approvedIds)} disabled={!approvedIds.length || !!busy}>
                <Play className="h-4 w-4" /> Apply approved ({approvedIds.length})
              </Button>
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="sticky top-20 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-card/95 p-3 shadow-dropdown backdrop-blur">
              <span className="mr-auto text-sm font-medium text-foreground">{selectedIds.length} selected</span>
              <Button size="sm" variant="outline" onClick={() => decide(selectedIds, 'approved')} loading={busy === 'decide-approved'}>
                <Check className="h-4 w-4" /> Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => decide(selectedIds, 'rejected')} loading={busy === 'decide-rejected'}>
                <X className="h-4 w-4" /> Reject
              </Button>
              <Button size="sm" onClick={() => askApply(selectedIds)}>
                <Play className="h-4 w-4" /> Apply now
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
          )}

          {visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              {proposals.length === 0
                ? isActive(detail) ? 'Recommendations will appear here as the inspection runs.' : 'No recommendations. Your library looks well organised.'
                : 'Nothing in this view.'}
            </div>
          ) : (
            GROUPS.map((group) => {
              const rows = visible.filter((p) => group.kinds.includes(p.kind));
              if (!rows.length) return null;
              const selectable = rows.filter((p) => ['pending', 'approved', 'failed'].includes(p.status)).map((p) => p.id);
              const allSelected = selectable.length > 0 && selectable.every((id) => selected.has(id));
              return (
                <div key={group.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
                  <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      checked={allSelected}
                      disabled={!selectable.length}
                      onChange={() => setSelected((s) => {
                        const next = new Set(s);
                        selectable.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
                        return next;
                      })}
                      aria-label={`Select all ${group.label}`}
                    />
                    <group.icon className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                    <span className="text-xs text-muted-foreground">{rows.length}</span>
                  </div>
                  <ul className="divide-y divide-border">
                    {rows.map((p) => (
                      <ProposalRow
                        key={p.id}
                        proposal={p}
                        selected={selected.has(p.id)}
                        expanded={expanded.has(p.id)}
                        disabled={!!busy}
                        onSelect={() => setSelected((s) => toggle(s, p.id))}
                        onExpand={() => setExpanded((s) => toggle(s, p.id))}
                        onDecide={(status) => decide([p.id], status)}
                        onApply={() => askApply([p.id])}
                        onRollback={() => askRollback(p)}
                      />
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </section>
      ) : tab === 'structure' ? (
        <StructureView inspection={detail} />
      ) : tab === 'history' ? (
        <HistoryView
          inspections={inspections}
          selectedId={selectedId}
          onSelect={(id) => { setSelectedId(id); setTab('recommendations'); }}
        />
      ) : (
        <LogView inspection={detail} />
      )}

      <Modal isOpen={!!confirm} onClose={() => !busy && setConfirm(null)} title={confirm?.title ?? ''} size="lg">
        {confirm && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{confirm.description}</p>
            <ul className="max-h-72 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 text-sm">
              {confirm.items.map((s, i) => <li key={i} className="text-foreground">• {s}</li>)}
            </ul>
            {confirm.allowAtomic && (
              <label className="flex items-start gap-2 text-sm text-foreground">
                <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-border" checked={atomic} onChange={(e) => setAtomic(e.target.checked)} />
                <span>All or nothing: if any change fails, apply none of them.</span>
              </label>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy === 'confirm'}>Cancel</Button>
              <Button onClick={runConfirm} loading={busy === 'confirm'}>{confirm.confirmLabel}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function ListBadge(n: number) {
  return n > 0 ? <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">{n}</span> : null;
}

function EmptyState({ onRun }: { onRun: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
        <Wand2 className="h-6 w-6 text-primary" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">No inspections yet</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Run a full inspection to find duplicate or overlapping categories, inconsistent names, misfiled items and missing tags.
        Nothing changes until you approve it.
      </p>
      <Button className="mt-5" onClick={onRun}><Wand2 className="h-4 w-4" /> Run full inspection</Button>
    </div>
  );
}

function RunPanel({ inspection, onCancel, onResume }: { inspection: Inspection; onCancel: () => void; onResume: () => void }) {
  if (inspection.status === 'failed') {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <div className="mr-auto min-w-0">
          <p className="text-sm font-semibold text-foreground">The inspection stopped with an error</p>
          <p className="truncate text-sm text-muted-foreground">{inspection.error}. Progress is saved, so it continues where it left off.</p>
        </div>
        <Button size="sm" onClick={onResume}><RotateCcw className="h-4 w-4" /> Resume</Button>
      </div>
    );
  }
  if (!isActive(inspection)) return null;
  const pct = inspection.item_count ? Math.round((inspection.items_processed / inspection.item_count) * 100) : 100;
  const step = inspection.analyze_structure && !inspection.structure_done ? 'Analysing the category structure…' : `Reviewing items: ${inspection.items_processed} of ${inspection.item_count}`;
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4" aria-live="polite">
      <div className="mb-3 flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div className="mr-auto">
          <p className="text-sm font-semibold text-foreground">{inspection.mode === 'full' ? 'Full' : 'Incremental'} inspection in progress</p>
          <p className="text-sm text-muted-foreground">{step}. You can leave this page; it keeps running.</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ProposalRow(props: {
  proposal: Proposal;
  selected: boolean;
  expanded: boolean;
  disabled: boolean;
  onSelect: () => void;
  onExpand: () => void;
  onDecide: (status: 'pending' | 'approved' | 'rejected') => void;
  onApply: () => void;
  onRollback: () => void;
}) {
  const { proposal: p } = props;
  const actionable = ['pending', 'approved', 'failed'].includes(p.status);
  return (
    <li className={cn('px-4 py-3', props.selected && 'bg-primary/5')}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-border"
          checked={props.selected}
          disabled={!actionable}
          onChange={props.onSelect}
          aria-label="Select recommendation"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{p.summary}</p>
          {p.rationale && <p className="mt-0.5 text-sm text-muted-foreground">{p.rationale}</p>}
          {p.error && <p className="mt-1 text-sm text-destructive">{p.error}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <StatusBadge status={p.status} />
            <ConfidenceBadge value={p.confidence} />
            <button onClick={props.onExpand} className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground">
              <ChevronRight className={cn('h-3 w-3 transition-transform', props.expanded && 'rotate-90')} /> Details
            </button>
          </div>
          {props.expanded && (
            <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-muted/50 p-3 text-xs text-foreground">
              {JSON.stringify({ kind: p.kind, ref: p.ref ?? undefined, payload: p.payload, result: p.result ?? undefined }, null, 2)}
            </pre>
          )}
        </div>
        <div className="-ml-2 flex shrink-0 items-center gap-1 sm:ml-0">
          {p.status === 'pending' || p.status === 'failed' ? (
            <>
              <Button size="sm" variant="ghost" title="Approve" aria-label="Approve" disabled={props.disabled} onClick={() => props.onDecide('approved')}>
                <Check className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" title="Reject" aria-label="Reject" disabled={props.disabled} onClick={() => props.onDecide('rejected')}>
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : p.status === 'approved' ? (
            <Button size="sm" variant="ghost" disabled={props.disabled} onClick={() => props.onDecide('pending')}>Unapprove</Button>
          ) : p.status === 'rejected' ? (
            <Button size="sm" variant="ghost" disabled={props.disabled} onClick={() => props.onDecide('pending')}>Reconsider</Button>
          ) : null}
          {actionable && (
            <Button size="sm" variant="outline" disabled={props.disabled} onClick={props.onApply}>Apply</Button>
          )}
          {p.status === 'applied' && (
            <Button size="sm" variant="outline" disabled={props.disabled} onClick={props.onRollback}>
              <Undo2 className="h-4 w-4" /> Undo
            </Button>
          )}
        </div>
        </div>
      </div>
    </li>
  );
}

function StructureView({ inspection }: { inspection: Inspection }) {
  const s = inspection.current_structure;
  if (!s) return <p className="text-sm text-muted-foreground">No snapshot was recorded for this inspection.</p>;
  return (
    <section className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Taxonomy as it was when this inspection started ({formatDate(inspection.created_at)}): {s.categories.length} categories,{' '}
        {s.total_items} items, {s.uncategorized_items} uncategorised.
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {s.categories.map((c) => (
          <div key={c.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-semibold text-foreground"><FolderTree className="h-4 w-4 text-primary" />{c.name}</h3>
              <span className="text-xs text-muted-foreground">{c.item_count} items</span>
            </div>
            {c.subcategories.length > 0 && (
              <ul className="space-y-1 border-l border-border pl-3">
                {c.subcategories.map((sub) => (
                  <li key={sub.id} className="text-sm">
                    <span className="text-foreground">{sub.name}</span>
                    <span className="ml-1 text-xs text-muted-foreground">({sub.item_count})</span>
                    {sub.tags.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {sub.tags.map((t) => <span key={t.id} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">#{t.name}</span>)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {c.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {c.tags.map((t) => <span key={t.id} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">#{t.name}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function HistoryView({ inspections, selectedId, onSelect }: { inspections: InspectionSummary[]; selectedId: string | null; onSelect: (id: string) => void }) {
  if (!inspections.length) return <p className="text-sm text-muted-foreground">No inspections yet.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Started</th>
            <th className="px-4 py-2.5 font-medium">Mode</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Items</th>
            <th className="px-4 py-2.5 font-medium">Recommendations</th>
            <th className="px-4 py-2.5 font-medium">Summary</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {inspections.map((i) => (
            <tr
              key={i.id}
              onClick={() => onSelect(i.id)}
              className={cn('cursor-pointer transition-colors hover:bg-accent/40', i.id === selectedId && 'bg-primary/5')}
            >
              <td className="whitespace-nowrap px-4 py-3 text-foreground"><History className="mr-1.5 inline h-3.5 w-3.5 text-muted-foreground" />{formatDate(i.created_at)}</td>
              <td className="px-4 py-3 capitalize text-muted-foreground">{i.mode}</td>
              <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{i.items_processed} / {i.item_count}</td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                {i.proposals_total} total · {i.proposals_pending + i.proposals_approved} open · {i.proposals_applied} applied · {i.proposals_rejected} rejected
                {i.proposals_failed > 0 && <span className="text-destructive"> · {i.proposals_failed} failed</span>}
              </td>
              <td className="max-w-xs truncate px-4 py-3 text-muted-foreground" title={i.error ?? i.summary ?? ''}>{i.error ?? i.summary ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogView({ inspection }: { inspection: Inspection }) {
  const entries = [...(inspection.log ?? [])].reverse();
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
        <ScrollText className="h-4 w-4" />
        Run {inspection.id.slice(0, 8)} · started {formatDate(inspection.started_at)} · finished {formatDate(inspection.completed_at)}
        {inspection.stats?.dropped ? ` · ${inspection.stats.dropped} invalid suggestions discarded` : ''}
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity recorded.</p>
      ) : (
        <ol className="space-y-1.5 font-mono text-xs">
          {entries.map((e, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 text-muted-foreground">{new Date(e.at).toLocaleTimeString()}</span>
              <span className={cn(e.level === 'error' ? 'text-destructive' : e.level === 'warn' ? 'text-warning' : 'text-foreground')}>{e.message}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
