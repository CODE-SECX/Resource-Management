import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Hash,
  Layers,
  Loader2,
  Search,
  Tag,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  assignLearningToCategory,
  assignLearningToSubcategory,
  assignResourceToCategory,
  assignResourceToSubcategory,
  assignTagToCategory,
  assignTagToSubcategory,
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
// Props
// ---------------------------------------------------------------------------

export interface SearchMovePanelProps {
  data: DashboardData;
  userId: string;
  onMoveComplete: () => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildKindLabel(kind: ItemKind) {
  switch (kind) {
    case 'tag': return 'Tag';
    case 'learning': return 'Learning';
    case 'resource': return 'Resource';
  }
}

const KIND_STYLES: Record<ItemKind, {
  bg: string;
  text: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  tag: {
    bg: 'bg-primary/10 border-primary/20',
    text: 'text-primary',
    icon: Hash,
  },
  learning: {
    bg: 'bg-violet-100 border-violet-200 dark:bg-violet-500/10 dark:border-violet-500/20',
    text: 'text-violet-700 dark:text-violet-300',
    icon: GraduationCap,
  },
  resource: {
    bg: 'bg-sky-100 border-sky-200 dark:bg-sky-500/10 dark:border-sky-500/20',
    text: 'text-sky-700 dark:text-sky-300',
    icon: BookOpen,
  },
};

function truncate(s: string, n = 38) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// ---------------------------------------------------------------------------
// TypeBadge
// ---------------------------------------------------------------------------

const TypeBadge: React.FC<{ kind: ItemKind }> = ({ kind }) => {
  const { bg, text, icon: Icon } = KIND_STYLES[kind];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border shrink-0 ${bg} ${text}`}>
      <Icon className="w-2.5 h-2.5" />
      {buildKindLabel(kind)}
    </span>
  );
};

// ---------------------------------------------------------------------------
// SearchMovePanel
// ---------------------------------------------------------------------------

export const SearchMovePanel: React.FC<SearchMovePanelProps> = ({
  data,
  userId,
  onMoveComplete,
  onClose,
}) => {
  // Source state
  const [sourceQuery, setSourceQuery] = useState('');
  const [filterKind, setFilterKind] = useState<FilterKind>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Target state
  const [targetQuery, setTargetQuery] = useState('');
  const [destination, setDestination] = useState<Destination | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  // Move state
  const [moving, setMoving] = useState(false);

  // ----- Lookup maps -----
  const catById = useMemo<Record<string, Category>>(() => {
    const m: Record<string, Category> = {};
    data.categories.forEach(c => { m[c.id] = c; });
    return m;
  }, [data.categories]);

  const subById = useMemo<Record<string, Subcategory>>(() => {
    const m: Record<string, Subcategory> = {};
    data.subcategories.forEach(s => { m[s.id] = s; });
    return m;
  }, [data.subcategories]);

  const subsByCat = useMemo<Record<string, Subcategory[]>>(() => {
    const m: Record<string, Subcategory[]> = {};
    data.subcategories.forEach(s => {
      (m[s.category_id] ??= []).push(s);
    });
    return m;
  }, [data.subcategories]);

  // ----- Build search results -----
  const allResults = useMemo<SearchResult[]>(() => {
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
      const cats = l.category_ids.map(id => catById[id]?.name).filter(Boolean);
      const subs = l.subcategory_ids.map(id => subById[id]?.name).filter(Boolean);
      const location = [...cats, ...subs].slice(0, 2).join(', ');
      results.push({ id: `learning-${l.id}`, kind: 'learning', label: l.title, location, raw: l });
    });

    data.resources.forEach(r => {
      const cats = r.category_ids.map(id => catById[id]?.name).filter(Boolean);
      const subs = r.subcategory_ids.map(id => subById[id]?.name).filter(Boolean);
      const location = [...cats, ...subs].slice(0, 2).join(', ');
      results.push({ id: `resource-${r.id}`, kind: 'resource', label: r.title, location, raw: r });
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

  // ----- Destinations -----
  const filteredDestinations = useMemo<Destination[]>(() => {
    const q = targetQuery.trim().toLowerCase();
    const dests: Destination[] = [];
    data.categories.forEach(cat => {
      dests.push({ kind: 'category', id: cat.id, name: cat.name, color: cat.color });
      (subsByCat[cat.id] ?? []).forEach(sub => {
        dests.push({
          kind: 'subcategory',
          id: sub.id,
          name: sub.name,
          parentName: cat.name,
          color: sub.color ?? undefined,
        });
      });
    });
    if (!q) return dests;
    return dests.filter(d =>
      d.name.toLowerCase().includes(q) || (d.parentName ?? '').toLowerCase().includes(q)
    );
  }, [data.categories, subsByCat, targetQuery]);

  // Unique category IDs present in destinations (for grouping)
  const destCategoryIds = useMemo<string[]>(() => {
    const seen = new Set<string>();
    filteredDestinations.forEach(d => {
      if (d.kind === 'category') {
        seen.add(d.id);
      } else {
        const sub = data.subcategories.find(s => s.id === d.id);
        if (sub) seen.add(sub.category_id);
      }
    });
    // Preserve original category order
    return data.categories.map(c => c.id).filter(id => seen.has(id));
  }, [filteredDestinations, data.categories, data.subcategories]);

  // ----- Selection helpers -----
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filteredResults.map(r => r.id)));

  const clearAll = () => {
    setSelectedIds(new Set());
    setDestination(null);
  };

  const toggleCatExpand = (catId: string) =>
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(catId) ? next.delete(catId) : next.add(catId);
      return next;
    });

  // ----- Preview string -----
  const previewText = useMemo(() => {
    if (!destination || selectedIds.size === 0) return null;
    const n = selectedIds.size;
    const destLabel = destination.parentName
      ? `${destination.parentName} › ${destination.name}`
      : destination.name;
    const tagCount = selectedResults.filter(r => r.kind === 'tag').length;
    const verb = tagCount > 0 && tagCount === n ? 'Copy' : n > 1 && tagCount > 0 ? 'Move/Copy' : 'Add';
    return `${verb} ${n} item${n !== 1 ? 's' : ''} → ${destLabel}`;
  }, [destination, selectedIds, selectedResults]);

  // ----- Move handler -----
  const handleMove = async () => {
    if (!destination || selectedIds.size === 0) return;
    setMoving(true);
    const toastId = toast.loading(`Moving ${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''}…`);
    let ok = 0;
    let fail = 0;

    await Promise.allSettled(
      selectedResults.map(async result => {
        try {
          if (result.kind === 'tag') {
            const tag = result.raw as TagType;
            destination.kind === 'subcategory'
              ? await assignTagToSubcategory(userId, tag.name, destination.id)
              : await assignTagToCategory(userId, tag.name, destination.id);
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
          ok++;
        } catch {
          fail++;
        }
      })
    );

    setMoving(false);

    if (ok > 0 && fail === 0) {
      toast.success(`${ok} item${ok !== 1 ? 's' : ''} added to "${destination.name}"`, { id: toastId });
    } else if (ok > 0) {
      toast.success(`${ok} succeeded, ${fail} failed`, { id: toastId });
    } else {
      toast.error('Move failed', { id: toastId });
    }

    clearAll();
    onMoveComplete();
  };

  // ----- Filter pills -----
  const filterPills: { id: FilterKind; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'learning', label: 'Learning' },
    { id: 'resource', label: 'Resources' },
    { id: 'tag', label: 'Tags' },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-xl overflow-hidden shadow-lg">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Search &amp; Move</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── SOURCE SECTION (top ~57%) ─────────────────────────────────── */}
      <div className="flex flex-col border-b border-border" style={{ flex: '0 0 57%', minHeight: 0 }}>

        {/* Controls */}
        <div className="px-3 pt-3 pb-2 space-y-2 shrink-0">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              id="search-move-source-query"
              value={sourceQuery}
              onChange={e => setSourceQuery(e.target.value)}
              placeholder="Search tags, learning, resources…"
              className="input-primary pl-8 text-xs h-8"
            />
            {sourceQuery && (
              <button
                onClick={() => setSourceQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1 flex-wrap">
            {filterPills.map(p => (
              <button
                key={p.id}
                onClick={() => setFilterKind(p.id)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all duration-100 ${
                  filterKind === p.id
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-muted/50 text-muted-foreground border-border hover:bg-accent hover:text-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-muted-foreground">
              {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Bulk actions */}
          <div className="flex items-center gap-2 text-[11px]">
            <button
              onClick={selectAll}
              disabled={filteredResults.length === 0}
              className="text-primary hover:underline font-medium disabled:opacity-40"
            >
              Select all
            </button>
            <span className="text-muted-foreground opacity-50">·</span>
            <button
              onClick={clearAll}
              disabled={selectedIds.size === 0 && !destination}
              className="text-muted-foreground hover:text-foreground hover:underline disabled:opacity-40"
            >
              Clear ({selectedIds.size})
            </button>
          </div>
        </div>

        {/* Results list */}
        <div className="overflow-y-auto flex-1 px-2 pb-2 space-y-0.5 min-h-0">
          {filteredResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Search className="w-7 h-7 mb-2 opacity-25" />
              <p className="text-xs">No items match</p>
            </div>
          ) : (
            filteredResults.map(result => {
              const selected = selectedIds.has(result.id);
              const { text: kindText, icon: KindIcon } = KIND_STYLES[result.kind];
              return (
                <button
                  key={result.id}
                  onClick={() => toggleSelect(result.id)}
                  className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all duration-100 group ${
                    selected
                      ? 'bg-primary/10 border border-primary/25'
                      : 'hover:bg-accent/60 border border-transparent'
                  }`}
                >
                  {/* Checkbox */}
                  <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    selected
                      ? 'bg-primary border-primary'
                      : 'border-border bg-background group-hover:border-primary/50'
                  }`}>
                    {selected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                  </div>

                  {/* Type icon */}
                  <KindIcon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${kindText}`} />

                  {/* Label + badge + location */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-medium text-foreground truncate">
                        {truncate(result.label, 30)}
                      </span>
                      <TypeBadge kind={result.kind} />
                    </div>
                    {result.location && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {result.location}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── TARGET SECTION (bottom ~43%) ──────────────────────────────── */}
      <div className="flex flex-col flex-1 min-h-0">

        {/* Target header + search */}
        <div className="px-3 pt-2.5 pb-2 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Layers className="w-3 h-3" />
              Move to…
            </p>
            {selectedIds.size > 0 && (
              <span className="text-[11px] font-medium text-primary">
                {selectedIds.size} selected
              </span>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              id="search-move-target-query"
              value={targetQuery}
              onChange={e => setTargetQuery(e.target.value)}
              placeholder="Search destinations…"
              className="input-primary pl-8 text-xs h-8"
            />
            {targetQuery && (
              <button
                onClick={() => setTargetQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Destination tree */}
        <div className="overflow-y-auto flex-1 px-2 py-1 space-y-0.5 min-h-0">
          {destCategoryIds.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground text-xs">
              No destinations match
            </div>
          ) : (
            destCategoryIds.map(catId => {
              const cat = catById[catId];
              if (!cat) return null;

              const catInList = filteredDestinations.some(d => d.kind === 'category' && d.id === catId);
              const subsInList = (subsByCat[catId] ?? []).filter(s =>
                filteredDestinations.some(d => d.kind === 'subcategory' && d.id === s.id)
              );
              const isExpanded = expandedCats.has(catId) || !!targetQuery;
              const isCatSelected = destination?.id === catId && destination?.kind === 'category';

              return (
                <div key={catId}>
                  {/* Category row */}
                  <div className={`flex items-center rounded-lg transition-all duration-100 ${
                    isCatSelected
                      ? 'bg-primary/10 border border-primary/25'
                      : 'hover:bg-accent/50 border border-transparent'
                  }`}>
                    {catInList && (
                      <button
                        onClick={() => setDestination({
                          kind: 'category',
                          id: cat.id,
                          name: cat.name,
                          color: cat.color,
                        })}
                        className="flex-1 flex items-center gap-2 px-2 py-1.5 text-left min-w-0"
                      >
                        <div
                          className="w-3 h-3 rounded-sm shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-xs font-semibold text-foreground truncate flex-1">
                          {cat.name}
                        </span>
                        {isCatSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </button>
                    )}
                    {subsInList.length > 0 && (
                      <button
                        onClick={() => toggleCatExpand(catId)}
                        className="p-1.5 rounded text-muted-foreground hover:text-foreground shrink-0"
                      >
                        {isExpanded
                          ? <ChevronDown className="w-3.5 h-3.5" />
                          : <ChevronRight className="w-3.5 h-3.5" />
                        }
                      </button>
                    )}
                  </div>

                  {/* Subcategory rows */}
                  {isExpanded && subsInList.map(sub => {
                    const isSubSelected = destination?.id === sub.id && destination?.kind === 'subcategory';
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
                        className={`w-full flex items-center gap-2 pl-6 pr-2.5 py-1.5 rounded-lg text-left text-xs transition-all duration-100 ${
                          isSubSelected
                            ? 'bg-primary/10 border border-primary/25 text-foreground'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground border border-transparent'
                        }`}
                      >
                        <Tag className="w-3 h-3 shrink-0 opacity-50" />
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: dotColor }}
                        />
                        <span className="truncate flex-1">{sub.name}</span>
                        {isSubSelected && <Check className="w-3 h-3 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* ── FOOTER: Preview + Actions ──────────────────────────────── */}
        <div className="shrink-0 border-t border-border px-3 py-2.5 bg-muted/20 space-y-2">
          {/* Preview */}
          {previewText ? (
            <p className="text-[11px] text-foreground bg-primary/5 border border-primary/15 rounded-md px-2.5 py-1.5 leading-snug">
              <span className="font-semibold text-primary">Preview: </span>
              {previewText}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground italic leading-snug">
              {selectedIds.size === 0
                ? 'Select items above, then pick a destination'
                : 'Pick a destination to continue'}
            </p>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              id="search-move-commit"
              onClick={handleMove}
              disabled={!destination || selectedIds.size === 0 || moving}
              className="btn-primary flex-1 text-xs py-1.5 gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
            >
              {moving
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Check className="w-3.5 h-3.5" />
              }
              {moving ? 'Moving…' : `Move${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
            </button>
            <button
              onClick={clearAll}
              disabled={selectedIds.size === 0 && !destination}
              className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
