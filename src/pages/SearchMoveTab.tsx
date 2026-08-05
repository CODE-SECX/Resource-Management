import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Hash,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Tag,
  X,
} from 'lucide-react';
import {
  getDashboardData,
  moveTagTo,
  moveResourceTo,
  moveLearningTo,
  assignTagToCategory,
  assignTagToSubcategory,
  assignResourceToCategory,
  assignResourceToSubcategory,
  assignLearningToCategory,
  assignLearningToSubcategory,
  type DashboardData,
  type DashboardLearning,
  type DashboardResource,
} from '../lib/taxonomyDashboard';
import type { Category, Subcategory, Tag as TagType } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ItemKind = 'tag' | 'learning' | 'resource';
type FilterKind = 'all' | ItemKind;
type MoveMode = 'move' | 'addto';

interface SearchResult {
  id: string;
  kind: ItemKind;
  label: string;
  location: string;
  raw: TagType | DashboardLearning | DashboardResource;
}

interface Destination {
  kind: 'category' | 'subcategory';
  id: string;
  name: string;
  parentName?: string;
  color?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const KIND_META: Record<ItemKind, {
  label: string;
  bg: string;
  text: string;
  border: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  tag: {
    label: 'Tag',
    bg: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/20',
    icon: Hash,
  },
  learning: {
    label: 'Learning',
    bg: 'bg-violet-100 dark:bg-violet-500/10',
    text: 'text-violet-700 dark:text-violet-300',
    border: 'border-violet-200 dark:border-violet-500/20',
    icon: GraduationCap,
  },
  resource: {
    label: 'Resource',
    bg: 'bg-sky-100 dark:bg-sky-500/10',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-500/20',
    icon: BookOpen,
  },
};

function trunc(s: string, n = 42) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// ---------------------------------------------------------------------------
// TypeBadge
// ---------------------------------------------------------------------------
const TypeBadge: React.FC<{ kind: ItemKind }> = ({ kind }) => {
  const { bg, text, border, icon: Icon, label } = KIND_META[kind];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border shrink-0 ${bg} ${text} ${border}`}>
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
};

// ---------------------------------------------------------------------------
// SearchMoveTab
// ---------------------------------------------------------------------------
export default function SearchMoveTab() {
  const { user } = useAuth();

  // Data
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Source state
  const [sourceQuery, setSourceQuery] = useState('');
  const [filterKind, setFilterKind] = useState<FilterKind>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Destination state
  const [destQuery, setDestQuery] = useState('');
  const [destination, setDestination] = useState<Destination | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  // Mode
  const [mode, setMode] = useState<MoveMode>('move');

  // Commit state
  const [committing, setCommitting] = useState(false);

  // ── Load data ────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const d = await getDashboardData(user.id);
      setData(d);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // ── Lookup maps ──────────────────────────────────────────────────────────

  const catById = useMemo<Record<string, Category>>(() => {
    const m: Record<string, Category> = {};
    (data?.categories ?? []).forEach(c => { m[c.id] = c; });
    return m;
  }, [data?.categories]);

  const subById = useMemo<Record<string, Subcategory>>(() => {
    const m: Record<string, Subcategory> = {};
    (data?.subcategories ?? []).forEach(s => { m[s.id] = s; });
    return m;
  }, [data?.subcategories]);

  const subsByCat = useMemo<Record<string, Subcategory[]>>(() => {
    const m: Record<string, Subcategory[]> = {};
    (data?.subcategories ?? []).forEach(s => { (m[s.category_id] ??= []).push(s); });
    return m;
  }, [data?.subcategories]);

  // ── Build source results ─────────────────────────────────────────────────

  const allResults = useMemo<SearchResult[]>(() => {
    if (!data) return [];
    const results: SearchResult[] = [];

    data.tags.forEach(t => {
      let location = '';
      if (t.subcategory_id) {
        const sub = subById[t.subcategory_id];
        const cat = sub ? catById[sub.category_id] : null;
        location = [cat?.name, sub?.name].filter(Boolean).join(' › ');
      } else if (t.category_id) {
        location = catById[t.category_id]?.name ?? '';
      }
      results.push({ id: `tag-${t.id}`, kind: 'tag', label: t.name, location, raw: t });
    });

    data.learning.forEach(l => {
      const parts = [
        ...l.category_ids.map(id => catById[id]?.name).filter(Boolean),
        ...l.subcategory_ids.map(id => subById[id]?.name).filter(Boolean),
      ].slice(0, 2);
      results.push({ id: `learning-${l.id}`, kind: 'learning', label: l.title, location: parts.join(', '), raw: l });
    });

    data.resources.forEach(r => {
      const parts = [
        ...r.category_ids.map(id => catById[id]?.name).filter(Boolean),
        ...r.subcategory_ids.map(id => subById[id]?.name).filter(Boolean),
      ].slice(0, 2);
      results.push({ id: `resource-${r.id}`, kind: 'resource', label: r.title, location: parts.join(', '), raw: r });
    });

    return results;
  }, [data, catById, subById]);

  const filteredResults = useMemo<SearchResult[]>(() => {
    const q = sourceQuery.trim().toLowerCase();
    return allResults.filter(r => {
      if (filterKind !== 'all' && r.kind !== filterKind) return false;
      if (!q) return true;
      return r.label.toLowerCase().includes(q) || r.location.toLowerCase().includes(q);
    });
  }, [allResults, sourceQuery, filterKind]);

  const selectedResults = useMemo<SearchResult[]>(
    () => allResults.filter(r => selectedIds.has(r.id)),
    [allResults, selectedIds]
  );

  // ── Destination list ─────────────────────────────────────────────────────

  const allDests = useMemo<Destination[]>(() => {
    if (!data) return [];
    const dests: Destination[] = [];
    data.categories.forEach(cat => {
      dests.push({ kind: 'category', id: cat.id, name: cat.name, color: cat.color });
      (subsByCat[cat.id] ?? []).forEach(sub => {
        dests.push({ kind: 'subcategory', id: sub.id, name: sub.name, parentName: cat.name, color: sub.color ?? undefined });
      });
    });
    return dests;
  }, [data, subsByCat]);

  const filteredDests = useMemo<Destination[]>(() => {
    const q = destQuery.trim().toLowerCase();
    if (!q) return allDests;
    return allDests.filter(d => d.name.toLowerCase().includes(q) || (d.parentName ?? '').toLowerCase().includes(q));
  }, [allDests, destQuery]);

  // Category IDs in destination list (preserving order)
  const destCatIds = useMemo<string[]>(() => {
    const seen = new Set<string>();
    filteredDests.forEach(d => {
      if (d.kind === 'category') seen.add(d.id);
      else {
        const sub = (data?.subcategories ?? []).find(s => s.id === d.id);
        if (sub) seen.add(sub.category_id);
      }
    });
    return (data?.categories ?? []).map(c => c.id).filter(id => seen.has(id));
  }, [filteredDests, data]);

  // ── Selection helpers ─────────────────────────────────────────────────────

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectAll = () => setSelectedIds(new Set(filteredResults.map(r => r.id)));

  const clearSelection = () => { setSelectedIds(new Set()); setDestination(null); };

  const toggleCat = (id: string) =>
    setExpandedCats(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── Preview ───────────────────────────────────────────────────────────────

  const previewText = useMemo(() => {
    if (!destination || selectedIds.size === 0) return null;
    const n = selectedIds.size;
    const destLabel = destination.parentName
      ? `${destination.parentName} › ${destination.name}`
      : destination.name;
    const verb = mode === 'move' ? 'Move' : 'Add';
    return `${verb} ${n} item${n !== 1 ? 's' : ''} → ${destLabel}`;
  }, [destination, selectedIds, mode]);

  // ── Commit ────────────────────────────────────────────────────────────────

  const handleCommit = async () => {
    if (!destination || selectedIds.size === 0 || !user) return;
    setCommitting(true);
    const toastId = toast.loading(`${mode === 'move' ? 'Moving' : 'Adding'} ${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''}…`);
    let ok = 0, fail = 0;

    await Promise.allSettled(selectedResults.map(async result => {
      try {
        if (mode === 'move') {
          // True move: DELETE old, INSERT new
          if (result.kind === 'tag') {
            await moveTagTo((result.raw as TagType).id, destination.kind, destination.id);
          } else if (result.kind === 'learning') {
            await moveLearningTo((result.raw as DashboardLearning).id, destination.kind, destination.id);
          } else {
            await moveResourceTo((result.raw as DashboardResource).id, destination.kind, destination.id);
          }
        } else {
          // Add to: insert only, keep existing
          if (result.kind === 'tag') {
            const tag = result.raw as TagType;
            destination.kind === 'subcategory'
              ? await assignTagToSubcategory(user.id, tag.name, destination.id)
              : await assignTagToCategory(user.id, tag.name, destination.id);
          } else if (result.kind === 'learning') {
            const item = result.raw as DashboardLearning;
            destination.kind === 'subcategory'
              ? await assignLearningToSubcategory(item.id, destination.id)
              : await assignLearningToCategory(item.id, destination.id);
          } else {
            const item = result.raw as DashboardResource;
            destination.kind === 'subcategory'
              ? await assignResourceToSubcategory(item.id, destination.id)
              : await assignResourceToCategory(item.id, destination.id);
          }
        }
        ok++;
      } catch { fail++; }
    }));

    setCommitting(false);

    if (ok > 0 && fail === 0) {
      toast.success(`${ok} item${ok !== 1 ? 's' : ''} ${mode === 'move' ? 'moved' : 'added'} to "${destination.name}"`, { id: toastId });
    } else if (ok > 0) {
      toast.success(`${ok} succeeded, ${fail} failed`, { id: toastId });
    } else {
      toast.error('Operation failed', { id: toastId });
    }

    clearSelection();
    await load();
  };

  // ── Filter pills ─────────────────────────────────────────────────────────
  const filterPills: { id: FilterKind; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'tag', label: 'Tags' },
    { id: 'learning', label: 'Learning' },
    { id: 'resource', label: 'Resources' },
  ];

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 rounded-lg bg-muted/50 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="h-10 rounded-lg bg-muted/50" />
            {[1,2,3,4,5].map(i => <div key={i} className="h-12 rounded-lg bg-muted/30" />)}
          </div>
          <div className="space-y-3">
            <div className="h-10 rounded-lg bg-muted/50" />
            {[1,2,3,4].map(i => <div key={i} className="h-10 rounded-lg bg-muted/30" />)}
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Page header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-foreground">Bulk Move</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Search for items on the left, pick a destination on the right, then commit the move.
          </p>
        </div>
        <button
          onClick={load}
          className="btn-secondary gap-1.5 text-sm px-3 py-2"
          title="Refresh data"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* ── Main horizontal layout ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch">

        {/* ── LEFT PANEL: Source ──────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden">

          {/* Panel header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30 shrink-0">
            <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
              <Search className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">From — Select Items</span>
            {selectedIds.size > 0 && (
              <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
                {selectedIds.size} selected
              </span>
            )}
          </div>

          {/* Search + filter controls */}
          <div className="px-3 pt-3 pb-2 space-y-2 shrink-0 border-b border-border/50">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                id="bulk-move-source-query"
                value={sourceQuery}
                onChange={e => setSourceQuery(e.target.value)}
                placeholder="Search tags, learning, resources…"
                className="input-primary pl-8 text-sm h-9"
              />
              {sourceQuery && (
                <button onClick={() => setSourceQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {filterPills.map(p => (
                <button
                  key={p.id}
                  onClick={() => setFilterKind(p.id)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all duration-100 ${
                    filterKind === p.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/40 text-muted-foreground border-border hover:bg-accent hover:text-foreground'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <span className="ml-auto text-xs text-muted-foreground">{filteredResults.length} items</span>
            </div>

            {/* Bulk row */}
            <div className="flex items-center gap-2 text-xs pb-0.5">
              <button
                onClick={selectAll}
                disabled={filteredResults.length === 0}
                className="text-primary hover:underline font-medium disabled:opacity-40"
              >
                Select all
              </button>
              <span className="text-muted-foreground opacity-40">·</span>
              <button
                onClick={clearSelection}
                disabled={selectedIds.size === 0}
                className="text-muted-foreground hover:text-foreground hover:underline disabled:opacity-40"
              >
                Clear ({selectedIds.size})
              </button>
            </div>
          </div>

          {/* Results list */}
          <div className="overflow-y-auto flex-1 px-2 py-2 space-y-0.5 min-h-[300px] max-h-[500px]">
            {filteredResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Search className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-sm">No items match</p>
              </div>
            ) : (
              filteredResults.map(result => {
                const selected = selectedIds.has(result.id);
                const { text: kindText, icon: KindIcon } = KIND_META[result.kind];
                return (
                  <button
                    key={result.id}
                    onClick={() => toggleSelect(result.id)}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-100 group ${
                      selected
                        ? 'bg-primary/10 border border-primary/25'
                        : 'hover:bg-accent/60 border border-transparent'
                    }`}
                  >
                    {/* Checkbox */}
                    <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      selected ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'
                    }`}>
                      {selected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </div>

                    <KindIcon className={`w-4 h-4 mt-0.5 shrink-0 ${kindText}`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground truncate">
                          {trunc(result.label, 36)}
                        </span>
                        <TypeBadge kind={result.kind} />
                      </div>
                      {result.location && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{result.location}</p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── CENTER DIVIDER: Arrow ────────────────────────────────────────── */}
        <div className="flex md:flex-col items-center justify-center gap-2 shrink-0 py-4 md:py-0 md:px-2">
          {/* Visual arrow */}
          <div className="flex flex-col md:flex-row items-center gap-1.5">
            <div className="hidden md:block w-px h-12 bg-border" />
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 border border-primary/20 shadow-sm">
              <ArrowRight className="w-5 h-5 text-primary rotate-90 md:rotate-0" />
            </div>
            <div className="hidden md:block w-px h-12 bg-border" />
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Move to
          </span>
        </div>

        {/* ── RIGHT PANEL: Destination ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden">

          {/* Panel header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30 shrink-0">
            <div className="w-6 h-6 rounded-md bg-emerald-500/15 flex items-center justify-center">
              <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-sm font-semibold text-foreground">To — Pick Destination</span>
            {destination && (
              <span className="ml-auto text-xs text-primary font-medium truncate max-w-[120px]">
                {destination.parentName ? `${destination.parentName} › ${destination.name}` : destination.name}
              </span>
            )}
          </div>

          {/* Dest search */}
          <div className="px-3 pt-3 pb-2 shrink-0 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                id="bulk-move-dest-query"
                value={destQuery}
                onChange={e => setDestQuery(e.target.value)}
                placeholder="Search categories &amp; subcategories…"
                className="input-primary pl-8 text-sm h-9"
              />
              {destQuery && (
                <button onClick={() => setDestQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Destination tree */}
          <div className="overflow-y-auto flex-1 px-2 py-2 space-y-0.5 min-h-[300px] max-h-[500px]">
            {destCatIds.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                No destinations match
              </div>
            ) : (
              destCatIds.map(catId => {
                const cat = catById[catId];
                if (!cat) return null;
                const catInList = filteredDests.some(d => d.kind === 'category' && d.id === catId);
                const subsInList = (subsByCat[catId] ?? []).filter(s =>
                  filteredDests.some(d => d.kind === 'subcategory' && d.id === s.id)
                );
                const isExpanded = expandedCats.has(catId) || !!destQuery;
                const isCatSel = destination?.id === catId && destination?.kind === 'category';

                return (
                  <div key={catId}>
                    {/* Category row */}
                    <div className={`flex items-center rounded-lg transition-all duration-100 ${
                      isCatSel
                        ? 'bg-primary/10 border border-primary/25'
                        : 'hover:bg-accent/50 border border-transparent'
                    }`}>
                      {catInList && (
                        <button
                          onClick={() => setDestination({ kind: 'category', id: cat.id, name: cat.name, color: cat.color })}
                          className="flex-1 flex items-center gap-2.5 px-3 py-2 text-left min-w-0"
                        >
                          <div className="w-3.5 h-3.5 rounded shrink-0" style={{ backgroundColor: cat.color }} />
                          <span className="text-sm font-semibold text-foreground truncate flex-1">{cat.name}</span>
                          {isCatSel && <Check className="w-4 h-4 text-primary shrink-0" />}
                        </button>
                      )}
                      {subsInList.length > 0 && (
                        <button onClick={() => toggleCat(catId)} className="p-2 rounded text-muted-foreground hover:text-foreground shrink-0">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      )}
                    </div>

                    {/* Subcategory rows */}
                    {isExpanded && subsInList.map(sub => {
                      const isSubSel = destination?.id === sub.id && destination?.kind === 'subcategory';
                      const dotColor = sub.color ?? '#8b5cf6';
                      return (
                        <button
                          key={sub.id}
                          onClick={() => setDestination({
                            kind: 'subcategory',
                            id: sub.id,
                            name: sub.name,
                            parentName: cat.name,
                            color: dotColor,
                          })}
                          className={`w-full flex items-center gap-2 pl-8 pr-3 py-2 rounded-lg text-left text-sm transition-all duration-100 ${
                            isSubSel
                              ? 'bg-primary/10 border border-primary/25 text-foreground'
                              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground border border-transparent'
                          }`}
                        >
                          <Tag className="w-3.5 h-3.5 shrink-0 opacity-40" />
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                          <span className="truncate flex-1">{sub.name}</span>
                          {isSubSel && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── BOTTOM BAR: Mode + Preview + Commit ──────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card shadow-sm px-5 py-4 space-y-4">

        {/* Mode toggle */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm font-semibold text-foreground">Action:</span>
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5 border border-border">
            {([
              { id: 'move' as MoveMode, label: 'Move (relocate)', desc: 'Removes old location' },
              { id: 'addto' as MoveMode, label: 'Add to (copy link)', desc: 'Keeps old location' },
            ] as const).map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                title={m.desc}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                  mode === m.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {mode === 'move'
              ? '⚡ Items will be removed from their current location and placed in the new one.'
              : '➕ Items will appear in both their current location AND the new one.'}
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Preview + Buttons */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Preview */}
          <div className="flex-1 min-w-0">
            {previewText ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15">
                <ArrowRight className="w-4 h-4 text-primary shrink-0" />
                <p className="text-sm text-foreground">
                  <span className="font-semibold text-primary">Preview: </span>
                  {previewText}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                {selectedIds.size === 0 && !destination && 'Select items on the left and a destination on the right.'}
                {selectedIds.size > 0 && !destination && `${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''} selected — now pick a destination on the right.`}
                {selectedIds.size === 0 && destination && `Destination set to "${destination.name}" — now select items on the left.`}
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={clearSelection}
              disabled={selectedIds.size === 0 && !destination}
              className="btn-secondary text-sm px-4 py-2 disabled:opacity-40"
            >
              Clear
            </button>
            <button
              id="bulk-move-commit"
              onClick={handleCommit}
              disabled={!destination || selectedIds.size === 0 || committing}
              className="btn-primary text-sm px-5 py-2 gap-2 disabled:opacity-50 disabled:pointer-events-none min-w-[180px]"
            >
              {committing
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <ArrowRight className="w-4 h-4" />
              }
              {committing
                ? `${mode === 'move' ? 'Moving' : 'Adding'}…`
                : `${mode === 'move' ? 'Move' : 'Add'} Selected${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
