import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  BookOpen,
  GraduationCap,
  Hash,
  Layers,
  RefreshCw,
  Search,
  Tag,
  Zap,
  Info,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  getDashboardData,
  moveTagTo,
  moveResourceTo,
  moveLearningTo,
  assignTagToSubcategory,
  assignTagToCategory,
  assignResourceToCategory,
  assignLearningToCategory,
  assignResourceToSubcategory,
  assignLearningToSubcategory,
  type DashboardData,
  type DashboardResource,
  type DashboardLearning,
} from '../lib/taxonomyDashboard';
import type { Category, Subcategory, Tag as TagType } from '../lib/supabase';


// ---------------------------------------------------------------------------
// Drag payload types
// ---------------------------------------------------------------------------
type DragKind = 'tag' | 'resource' | 'learning';

interface DragPayload {
  kind: DragKind;
  id: string;            // tag.id | resource.id | learning.id
  name: string;          // tag.name | resource.title | learning.title
  sourceCategoryId?: string;
  sourceSubcategoryId?: string;
}

// ---------------------------------------------------------------------------
// Drop target types
// ---------------------------------------------------------------------------
type DropTargetKind = 'category' | 'subcategory';

interface DropTarget {
  kind: DropTargetKind;
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// View mode
// ---------------------------------------------------------------------------
type ViewMode = 'tags' | 'resources' | 'learning';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const DIFFICULTY_COLORS: Record<string, string> = {
  Beginner:     'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30',
  Intermediate: 'bg-amber-100   text-amber-700   border-amber-200   dark:bg-amber-500/20   dark:text-amber-400   dark:border-amber-500/30',
  Advanced:     'bg-orange-100  text-orange-700  border-orange-200  dark:bg-orange-500/20  dark:text-orange-400  dark:border-orange-500/30',
  Expert:       'bg-red-100     text-red-700     border-red-200     dark:bg-red-500/20     dark:text-red-400     dark:border-red-500/30',
};


function truncate(s: string, n = 32) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// ---------------------------------------------------------------------------
// Tag Chip
// ---------------------------------------------------------------------------
interface TagChipProps {
  tag: TagType;
  onDragStart: (payload: DragPayload) => void;
  isDragging: boolean;
}

const TagChip: React.FC<TagChipProps> = ({ tag, onDragStart, isDragging }) => {
  const handleDragStart = (e: React.DragEvent) => {
    const payload: DragPayload = {
      kind: 'tag',
      id: tag.id,
      name: tag.name,
      sourceCategoryId: tag.category_id ?? undefined,
      sourceSubcategoryId: tag.subcategory_id ?? undefined,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart(payload);
  };

  return (
    <span
      draggable
      onDragStart={handleDragStart}
      title={`Drag to assign "${tag.name}" to another subcategory`}
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border cursor-grab active:cursor-grabbing
        select-none transition-all duration-150
        bg-primary/10 text-primary border-primary/25 hover:bg-primary/20 hover:border-primary/40
        ${isDragging ? 'opacity-50 scale-95' : 'hover:scale-105'}
      `}
    >
      <Hash className="w-2.5 h-2.5 shrink-0" />
      {truncate(tag.name, 22)}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Item Pill (Resource or Learning)
// ---------------------------------------------------------------------------
interface ItemPillProps {
  item: DashboardResource | DashboardLearning;
  kind: 'resource' | 'learning';
  onDragStart: (payload: DragPayload) => void;
  isDragging: boolean;
  /** The category this pill is rendered inside (for move source tracking) */
  sourceCategoryId?: string;
  /** The subcategory this pill is rendered inside (for move source tracking) */
  sourceSubcategoryId?: string;
}

const ItemPill: React.FC<ItemPillProps> = ({ item, kind, onDragStart, isDragging, sourceCategoryId, sourceSubcategoryId }) => {
  const isLearning = kind === 'learning';
  const learningItem = item as DashboardLearning;

  const handleDragStart = (e: React.DragEvent) => {
    const payload: DragPayload = {
      kind,
      id: item.id,
      name: item.title,
      sourceCategoryId,
      sourceSubcategoryId,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
    onDragStart(payload);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      title={`Drag to assign "${item.title}" to another category or subcategory`}
      className={`
        group flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-grab active:cursor-grabbing
        border select-none transition-all duration-150
        ${isLearning
          ? 'bg-violet-500/10 border-violet-500/20 hover:bg-violet-500/20 hover:border-violet-500/40'
          : 'bg-sky-500/10 border-sky-500/20 hover:bg-sky-500/20 hover:border-sky-500/40'
        }
        ${isDragging ? 'opacity-50 scale-95' : 'hover:scale-[1.02]'}
      `}
    >
      {isLearning
        ? <GraduationCap className="w-3 h-3 text-violet-600 dark:text-violet-400 shrink-0" />
        : <BookOpen className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
      }
      <span className={`truncate font-medium ${isLearning ? 'text-violet-700 dark:text-violet-300' : 'text-sky-700 dark:text-sky-300'}`}>
        {truncate(item.title, 28)}
      </span>
      {isLearning && learningItem.difficulty_level && (
        <span className={`hidden group-hover:inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] border ${DIFFICULTY_COLORS[learningItem.difficulty_level] || ''}`}>
          {learningItem.difficulty_level}
        </span>
      )}
      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="ml-auto opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity shrink-0"
          title="Open URL"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Drop Zone Overlay — renders on top of cards when dragging
// ---------------------------------------------------------------------------
interface DropZoneProps {
  target: DropTarget;
  activePayload: DragPayload | null;
  onDrop: (target: DropTarget, payload: DragPayload) => void;
}

const DropZone: React.FC<DropZoneProps> = ({ target, activePayload, onDrop }) => {
  const [over, setOver] = useState(false);

  if (!activePayload) return null;

  // Don't allow dropping a tag onto its own source location
  const isSelf =
    activePayload.kind === 'tag' &&
    ((target.kind === 'subcategory' && activePayload.sourceSubcategoryId === target.id) ||
      (target.kind === 'category' && activePayload.sourceCategoryId === target.id && !activePayload.sourceSubcategoryId));

  if (isSelf) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setOver(true);
  };

  const handleDragLeave = () => setOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    try {
      const raw = e.dataTransfer.getData('application/json');
      const payload: DragPayload = JSON.parse(raw);
      onDrop(target, payload);
    } catch {
      // ignore
    }
  };

  const labelMap: Record<DragKind, string> = {
    tag: `Assign #${truncate(activePayload.name, 18)} here`,
    resource: `Add resource here`,
    learning: `Add learning here`,
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        absolute inset-0 rounded-xl z-10 flex items-center justify-center
        transition-all duration-150 pointer-events-auto
        border-2 border-dashed
        ${over
          ? 'bg-primary/20 border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.3)] scale-[1.01]'
          : 'bg-primary/5 border-primary/30'
        }
      `}
    >
      <div className={`
        flex flex-col items-center gap-1 pointer-events-none px-3 text-center
        transition-all duration-150
        ${over ? 'scale-110' : ''}
      `}>
        <Zap className={`w-5 h-5 ${over ? 'text-primary animate-pulse' : 'text-primary/60'}`} />
        <span className={`text-xs font-semibold ${over ? 'text-primary' : 'text-primary/70'}`}>
          {labelMap[activePayload.kind]}
        </span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Subcategory Card
// ---------------------------------------------------------------------------
interface SubcategoryCardProps {
  sub: Subcategory;
  tags: TagType[];
  resources: DashboardResource[];
  learningItems: DashboardLearning[];
  viewMode: ViewMode;
  activePayload: DragPayload | null;
  onDragStart: (payload: DragPayload) => void;
  onDrop: (target: DropTarget, payload: DragPayload) => void;
  searchQuery: string;
}

const SubcategoryCard: React.FC<SubcategoryCardProps> = ({
  sub,
  tags,
  resources,
  learningItems,
  viewMode,
  activePayload,
  onDragStart,
  onDrop,
  searchQuery,
}) => {
  const [expanded, setExpanded] = useState(true);
  const q = searchQuery.trim().toLowerCase();

  const filteredTags = q ? tags.filter((t) => t.name.toLowerCase().includes(q)) : tags;
  const filteredResources = q ? resources.filter((r) => r.title.toLowerCase().includes(q)) : resources;
  const filteredLearning = q ? learningItems.filter((l) => l.title.toLowerCase().includes(q)) : learningItems;

  const dropTarget: DropTarget = { kind: 'subcategory', id: sub.id, name: sub.name };
  const isDragging = activePayload !== null;
  const dotColor = sub.color || '#8b5cf6';

  return (
    <div className="relative rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden transition-all duration-200 hover:border-border">
      {/* Drop zone overlay when dragging */}
      {isDragging && (
        <DropZone target={dropTarget} activePayload={activePayload} onDrop={onDrop} />
      )}

      {/* Card header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-accent/50 transition-colors"
      >
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/10 dark:ring-white/10"
          style={{ backgroundColor: dotColor }}
        />
        <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold text-foreground truncate flex-1">{sub.name}</span>
        <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground text-xs">
          {viewMode === 'tags' && <span>{filteredTags.length}</span>}
          {viewMode === 'resources' && <span>{filteredResources.length}</span>}
          {viewMode === 'learning' && <span>{filteredLearning.length}</span>}
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5" />
            : <ChevronRight className="w-3.5 h-3.5" />
          }
        </div>
      </button>

      {/* Card body */}
      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          {viewMode === 'tags' && (
            filteredTags.length === 0
              ? <p className="text-xs text-muted-foreground/80 italic py-1">No tags{q ? ' match' : ''}</p>
              : <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {filteredTags.map((tag) => (
                    <TagChip
                      key={tag.id}
                      tag={tag}
                      onDragStart={onDragStart}
                      isDragging={activePayload?.id === tag.id}
                    />
                  ))}
                </div>
          )}

          {viewMode === 'resources' && (
            filteredResources.length === 0
              ? <p className="text-xs text-muted-foreground/80 italic py-1">No resources{q ? ' match' : ''}</p>
              : <div className="space-y-1 pt-0.5">
                  {filteredResources.map((r) => (
                    <ItemPill
                      key={r.id}
                      item={r}
                      kind="resource"
                      onDragStart={onDragStart}
                      isDragging={activePayload?.id === r.id}
                      sourceSubcategoryId={sub.id}
                    />
                  ))}
                </div>
          )}

          {viewMode === 'learning' && (
            filteredLearning.length === 0
              ? <p className="text-xs text-muted-foreground/80 italic py-1">No learning items{q ? ' match' : ''}</p>
              : <div className="space-y-1 pt-0.5">
                  {filteredLearning.map((l) => (
                    <ItemPill
                      key={l.id}
                      item={l}
                      kind="learning"
                      onDragStart={onDragStart}
                      isDragging={activePayload?.id === l.id}
                      sourceSubcategoryId={sub.id}
                    />
                  ))}
                </div>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Category Column
// ---------------------------------------------------------------------------
interface CategoryColumnProps {
  category: Category;
  subcategories: Subcategory[];
  tags: TagType[];
  resources: DashboardResource[];
  learningItems: DashboardLearning[];
  tagsBySubcategory: Record<string, TagType[]>;
  resourcesBySubcategory: Record<string, DashboardResource[]>;
  learningBySubcategory: Record<string, DashboardLearning[]>;
  viewMode: ViewMode;
  activePayload: DragPayload | null;
  onDragStart: (payload: DragPayload) => void;
  onDrop: (target: DropTarget, payload: DragPayload) => void;
  searchQuery: string;
}

const CategoryColumn: React.FC<CategoryColumnProps> = ({
  category,
  subcategories,
  tags,
  resources,
  learningItems,
  tagsBySubcategory,
  resourcesBySubcategory,
  learningBySubcategory,
  viewMode,
  activePayload,
  onDragStart,
  onDrop,
  searchQuery,
}) => {
  const [expanded, setExpanded] = useState(true);
  const q = searchQuery.trim().toLowerCase();

  const filteredCatTags = q ? tags.filter((t) => t.name.toLowerCase().includes(q)) : tags;
  const filteredCatResources = q ? resources.filter((r) => r.title.toLowerCase().includes(q)) : resources;
  const filteredCatLearning = q ? learningItems.filter((l) => l.title.toLowerCase().includes(q)) : learningItems;
  const filteredSubs = q
    ? subcategories.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (tagsBySubcategory[s.id] || []).some((t) => t.name.toLowerCase().includes(q)) ||
          (resourcesBySubcategory[s.id] || []).some((r) => r.title.toLowerCase().includes(q)) ||
          (learningBySubcategory[s.id] || []).some((l) => l.title.toLowerCase().includes(q))
      )
    : subcategories;

  const dropTarget: DropTarget = { kind: 'category', id: category.id, name: category.name };
  const isDragging = activePayload !== null;

  // Total counts for the column header badge
  const totalItems =
    viewMode === 'tags'
      ? tags.length + subcategories.reduce((n, s) => n + (tagsBySubcategory[s.id]?.length || 0), 0)
      : viewMode === 'resources'
      ? resources.length + subcategories.reduce((n, s) => n + (resourcesBySubcategory[s.id]?.length || 0), 0)
      : learningItems.length + subcategories.reduce((n, s) => n + (learningBySubcategory[s.id]?.length || 0), 0);

  return (
    <div className="flex-none w-[320px] flex flex-col gap-2">
      {/* Column header — acts as a drop zone for the category */}
      <div className="relative rounded-xl overflow-hidden">
        {isDragging && (
          <DropZone target={dropTarget} activePayload={activePayload} onDrop={onDrop} />
        )}
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border"
          style={{
            background: `linear-gradient(135deg, ${category.color}22, ${category.color}10)`,
            borderColor: `${category.color}40`,
          }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
            style={{ backgroundColor: category.color }}
          >
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-foreground truncate">{category.name}</h3>
            <p className="text-xs text-muted-foreground">{totalItems} items · {subcategories.length} subcats</p>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded-md hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          {/* Category-level tags / items (no subcategory) */}
          {viewMode === 'tags' && filteredCatTags.length > 0 && (
            <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">Category-level tags</p>
              <div className="flex flex-wrap gap-1.5">
                {filteredCatTags.map((tag) => (
                  <TagChip
                    key={tag.id}
                    tag={tag}
                    onDragStart={onDragStart}
                    isDragging={activePayload?.id === tag.id}
                  />
                ))}
              </div>
            </div>
          )}

          {viewMode === 'resources' && filteredCatResources.length > 0 && (
            <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">Category resources</p>
              <div className="space-y-1">
                {filteredCatResources.map((r) => (
                  <ItemPill key={r.id} item={r} kind="resource" onDragStart={onDragStart} isDragging={activePayload?.id === r.id} sourceCategoryId={category.id} />
                ))}
              </div>
            </div>
          )}

          {viewMode === 'learning' && filteredCatLearning.length > 0 && (
            <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">Category learning</p>
              <div className="space-y-1">
                {filteredCatLearning.map((l) => (
                  <ItemPill key={l.id} item={l} kind="learning" onDragStart={onDragStart} isDragging={activePayload?.id === l.id} sourceCategoryId={category.id} />
                ))}
              </div>
            </div>
          )}

          {/* Subcategory cards */}
          {filteredSubs.map((sub) => (
            <SubcategoryCard
              key={sub.id}
              sub={sub}
              tags={tagsBySubcategory[sub.id] || []}
              resources={resourcesBySubcategory[sub.id] || []}
              learningItems={learningBySubcategory[sub.id] || []}
              viewMode={viewMode}
              activePayload={activePayload}
              onDragStart={onDragStart}
              onDrop={onDrop}
              searchQuery={searchQuery}
            />
          ))}

          {filteredSubs.length === 0 && (
            <div className="rounded-xl border border-border/30 bg-muted/10 px-4 py-3 text-xs text-muted-foreground/80 text-center italic">
              {q ? 'No matches in this category' : 'No subcategories'}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main TaxonomyDashboard
// ---------------------------------------------------------------------------
export default function TaxonomyDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('tags');
  const [searchQuery, setSearchQuery] = useState('');
  const [activePayload, setActivePayload] = useState<DragPayload | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const d = await getDashboardData(user.id);
      setData(d);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load taxonomy dashboard');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // -------------------------------------------------------------------------
  // Clear drag state on drag-end / mouse-up (safety net)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const clear = () => setActivePayload(null);
    window.addEventListener('dragend', clear);
    return () => window.removeEventListener('dragend', clear);
  }, []);

  // -------------------------------------------------------------------------
  // Drop handler
  // -------------------------------------------------------------------------
  const handleDrop = useCallback(async (target: DropTarget, payload: DragPayload) => {
    if (!user || !data) return;
    setActivePayload(null);

    const toastId = toast.loading('Moving…');
    try {
      if (payload.kind === 'tag') {
        // Tags: UPDATE the row in place (true move — no copy)
        await moveTagTo(payload.id, target.kind, target.id);
        toast.success(`#${payload.name} moved to "${target.name}"`, { id: toastId });
      } else if (payload.kind === 'resource') {
        // Resources: move (remove all old, add new)
        await moveResourceTo(payload.id, target.kind, target.id);
        toast.success(`Resource moved to "${target.name}"`, { id: toastId });
      } else if (payload.kind === 'learning') {
        // Learning: move (remove all old, add new)
        await moveLearningTo(payload.id, target.kind, target.id);
        toast.success(`Learning item moved to "${target.name}"`, { id: toastId });
      }
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Move failed', { id: toastId });
    }
  }, [user, data, load]);

  // -------------------------------------------------------------------------
  // Derived per-column data
  // -------------------------------------------------------------------------
  const derivedData = React.useMemo(() => {
    if (!data) return null;

    // Subcategories per category
    const subsByCategory: Record<string, Subcategory[]> = {};
    data.subcategories.forEach((s) => {
      if (!subsByCategory[s.category_id]) subsByCategory[s.category_id] = [];
      subsByCategory[s.category_id].push(s);
    });

    // Tags per subcategory (no category_id)
    const tagsBySubcategory: Record<string, TagType[]> = {};
    const tagsByCategory: Record<string, TagType[]> = {};
    data.tags.forEach((t) => {
      if (t.subcategory_id) {
        if (!tagsBySubcategory[t.subcategory_id]) tagsBySubcategory[t.subcategory_id] = [];
        tagsBySubcategory[t.subcategory_id].push(t);
      } else if (t.category_id) {
        if (!tagsByCategory[t.category_id]) tagsByCategory[t.category_id] = [];
        tagsByCategory[t.category_id].push(t);
      }
    });

    // Resources per category and subcategory
    const resourcesByCategory: Record<string, DashboardResource[]> = {};
    const resourcesBySubcategory: Record<string, DashboardResource[]> = {};
    data.resources.forEach((r) => {
      r.category_ids.forEach((cid) => {
        if (!resourcesByCategory[cid]) resourcesByCategory[cid] = [];
        if (!resourcesByCategory[cid].find((x) => x.id === r.id))
          resourcesByCategory[cid].push(r);
      });
      r.subcategory_ids.forEach((sid) => {
        if (!resourcesBySubcategory[sid]) resourcesBySubcategory[sid] = [];
        if (!resourcesBySubcategory[sid].find((x) => x.id === r.id))
          resourcesBySubcategory[sid].push(r);
      });
    });

    // Learning per category and subcategory
    const learningByCategory: Record<string, DashboardLearning[]> = {};
    const learningBySubcategory: Record<string, DashboardLearning[]> = {};
    data.learning.forEach((l) => {
      l.category_ids.forEach((cid) => {
        if (!learningByCategory[cid]) learningByCategory[cid] = [];
        if (!learningByCategory[cid].find((x) => x.id === l.id))
          learningByCategory[cid].push(l);
      });
      l.subcategory_ids.forEach((sid) => {
        if (!learningBySubcategory[sid]) learningBySubcategory[sid] = [];
        if (!learningBySubcategory[sid].find((x) => x.id === l.id))
          learningBySubcategory[sid].push(l);
      });
    });

    // Unassigned items (no category association at all)
    const unassignedResources = data.resources.filter((r) => r.category_ids.length === 0);
    const unassignedLearning = data.learning.filter((l) => l.category_ids.length === 0);

    return {
      subsByCategory,
      tagsBySubcategory,
      tagsByCategory,
      resourcesByCategory,
      resourcesBySubcategory,
      learningByCategory,
      learningBySubcategory,
      unassignedResources,
      unassignedLearning,
    };
  }, [data]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="flex gap-3 mb-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-[320px] flex-none space-y-2">
              <div className="h-14 rounded-xl bg-muted/50" />
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-24 rounded-xl bg-muted/30" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || !derivedData) return null;

  const viewModes: { id: ViewMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'tags', label: 'Tags', icon: Hash },
    { id: 'resources', label: 'Resources', icon: BookOpen },
    { id: 'learning', label: 'Learning', icon: GraduationCap },
  ];

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            id="taxonomy-dashboard-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter across all columns…"
            className="input-primary pl-9 text-sm"
          />
        </div>

        {/* View mode switcher */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 border border-border">
          {viewModes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`taxonomy-dashboard-mode-${id}`}
              onClick={() => setViewMode(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150
                ${viewMode === id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          id="taxonomy-dashboard-refresh"
          onClick={load}
          className="btn-secondary px-3 py-2 gap-1.5 text-sm"
          title="Refresh data"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>

        {/* Totals pill */}
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg px-3 py-1.5">
          <span>{data.categories.length} cats</span>
          <span className="opacity-40">·</span>
          <span>{data.resources.length} resources</span>
          <span className="opacity-40">·</span>
          <span>{data.learning.length} learning</span>
          <span className="opacity-40">·</span>
          <span>{data.tags.length} tags</span>
        </div>
      </div>

      {/* Drag hint banner */}
      <div className="flex items-start gap-2 rounded-lg px-4 py-2.5 bg-primary/5 border border-primary/15 text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
        <span>
          <span className="font-semibold text-foreground">Drag to move:</span>{' '}
          {viewMode === 'tags' && 'Grab a #tag chip and drop it onto any subcategory or category header to move it there.'}
          {viewMode === 'resources' && 'Grab a resource pill and drop it onto any column header or subcategory card to move it to that category/subcategory.'}
          {viewMode === 'learning' && 'Grab a learning item and drop it onto any column header or subcategory card to move it to that category/subcategory.'}
          {' '}The item will be removed from its current location.
        </span>
      </div>

      {/* Board */}
      <div
        ref={containerRef}
        className="overflow-x-auto pb-4"
        style={{ minHeight: '50vh' }}
      >
          <div className="flex gap-4 w-max min-w-full">
            {data.categories.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-20 text-muted-foreground">
                <div className="text-center space-y-2">
                  <Layers className="w-12 h-12 mx-auto opacity-30" />
                  <p className="font-medium">No categories yet</p>
                  <p className="text-sm">Create categories in the Tree View tab to get started</p>
                </div>
              </div>
            ) : (
              data.categories.map((cat) => (
                <CategoryColumn
                  key={cat.id}
                  category={cat}
                  subcategories={derivedData.subsByCategory[cat.id] || []}
                  tags={derivedData.tagsByCategory[cat.id] || []}
                  resources={derivedData.resourcesByCategory[cat.id] || []}
                  learningItems={derivedData.learningByCategory[cat.id] || []}
                  tagsBySubcategory={derivedData.tagsBySubcategory}
                  resourcesBySubcategory={derivedData.resourcesBySubcategory}
                  learningBySubcategory={derivedData.learningBySubcategory}
                  viewMode={viewMode}
                  activePayload={activePayload}
                  onDragStart={setActivePayload}
                  onDrop={handleDrop}
                  searchQuery={searchQuery}
                />
              ))
            )}

            {/* Unassigned column — items with no category association */}
            {(derivedData.unassignedResources.length > 0 || derivedData.unassignedLearning.length > 0) && (
              <div className="flex-none w-[320px] flex flex-col gap-2">
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-border/60 bg-muted/20">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-muted border border-border">
                    <Layers className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-muted-foreground">Unassigned</h3>
                    <p className="text-xs text-muted-foreground/80">
                      {viewMode === 'resources' ? derivedData.unassignedResources.length : derivedData.unassignedLearning.length} items · no category
                    </p>
                  </div>
                </div>

                {viewMode === 'resources' && derivedData.unassignedResources.length > 0 && (
                  <div className="rounded-xl border border-dashed border-border/40 bg-muted/10 px-3 py-2 space-y-1">
                    {derivedData.unassignedResources
                      .filter((r) => !searchQuery || r.title.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((r) => (
                        <ItemPill
                          key={r.id}
                          item={r}
                          kind="resource"
                          onDragStart={setActivePayload}
                          isDragging={activePayload?.id === r.id}
                        />
                      ))}
                  </div>
                )}

                {viewMode === 'learning' && derivedData.unassignedLearning.length > 0 && (
                  <div className="rounded-xl border border-dashed border-border/40 bg-muted/10 px-3 py-2 space-y-1">
                    {derivedData.unassignedLearning
                      .filter((l) => !searchQuery || l.title.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((l) => (
                        <ItemPill
                          key={l.id}
                          item={l}
                          kind="learning"
                          onDragStart={setActivePayload}
                          isDragging={activePayload?.id === l.id}
                        />
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
