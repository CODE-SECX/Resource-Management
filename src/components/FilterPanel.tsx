import React, { useState, useEffect, useMemo } from 'react';
import {
  supabase,
  type Category,
  type Subcategory,
  type Tag,
  getSubcategories,
  getTagsByCategories,
  getTagsForSubcategories,
} from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Search,
  ChevronDown,
  Filter,
  Tag as TagIcon,
  X,
  Hash,
} from 'lucide-react';
import { Skeleton } from './ui/Skeleton';

// ─── ActiveFilterBar ──────────────────────────────────────────────────────────

export interface FilterChip {
  id: string;
  label: string;
  /** Category color hex — drives custom background on category chips */
  color?: string;
  variant: 'category' | 'subcategory' | 'tag' | 'other';
  onRemove: () => void;
}

interface ActiveFilterBarProps {
  chips: FilterChip[];
  onClearAll: () => void;
}

export function ActiveFilterBar({ chips, onClearAll }: ActiveFilterBarProps) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map(chip => (
        <ActiveChip key={chip.id} chip={chip} />
      ))}
      <button
        onClick={onClearAll}
        className="text-xs text-muted-foreground hover:text-destructive transition-colors duration-150 font-medium ml-1 flex-shrink-0"
      >
        Clear all
      </button>
    </div>
  );
}

function ActiveChip({ chip }: { chip: FilterChip }) {
  const variantClasses: Record<FilterChip['variant'], string> = {
    category:    'bg-primary/10 border-primary/30 text-primary',
    subcategory: 'bg-success/10 border-success/30 text-success',
    tag:         'bg-secondary border-border text-secondary-foreground',
    other:       'bg-muted border-border text-muted-foreground',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-xs font-medium border transition-all duration-150 ${
        chip.color ? 'border-transparent text-white' : variantClasses[chip.variant]
      }`}
      style={chip.color ? { backgroundColor: chip.color } : undefined}
    >
      <span className="max-w-[120px] truncate">{chip.label}</span>
      <button
        onClick={chip.onRemove}
        className="flex-shrink-0 ml-0.5 p-0.5 rounded-full hover:bg-black/15 dark:hover:bg-white/15 transition-colors duration-150"
        aria-label={`Remove filter: ${chip.label}`}
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </span>
  );
}

// ─── FilterPanel ──────────────────────────────────────────────────────────────

export interface FilterPanelProps {
  type: 'resources' | 'learning';
  selectedCategories: string[];
  selectedSubcategories: string[];
  selectedTags: string[];
  onCategoryToggle: (id: string) => void;
  onSubcategoryToggle: (id: string) => void;
  onTagToggle: (tag: string) => void;
  onClearAll: () => void;
  /** Slot for extra collapsible sections (e.g. Difficulty, Date Range on Learning) */
  extraSections?: React.ReactNode;
  /** Called once taxonomy data is loaded so the parent can build chip labels */
  onDataLoaded?: (categories: Category[], subcategoriesMap: Map<string, Subcategory[]>) => void;
}

export function FilterPanel({
  type,
  selectedCategories,
  selectedSubcategories,
  selectedTags,
  onCategoryToggle,
  onSubcategoryToggle,
  onTagToggle,
  onClearAll,
  extraSections,
  onDataLoaded,
}: FilterPanelProps) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategoriesMap, setSubcategoriesMap] = useState<Map<string, Subcategory[]>>(new Map());
  const [scopedTags, setScopedTags] = useState<string[]>([]);
  const [filterSearch, setFilterSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [tagsLoading, setTagsLoading] = useState(false);

  // Auto-expand categories that have selected subcategories
  useEffect(() => {
    if (selectedSubcategories.length === 0 || subcategoriesMap.size === 0) return;
    setExpandedCategories(prev => {
      const next = new Set(prev);
      subcategoriesMap.forEach((subcats, categoryId) => {
        if (subcats.some(s => selectedSubcategories.includes(s.id))) {
          next.add(categoryId);
        }
      });
      return next;
    });
  }, [selectedSubcategories, subcategoriesMap]);

  // Fetch categories and all subcategories on mount / type change
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const categoryTable = type === 'resources' ? 'resource_categories' : 'learning_categories';
        const idField = type === 'resources' ? 'resource_id' : 'learning_id';

        const { data: categoriesData, error } = await supabase
          .from('categories')
          .select(`*, ${categoryTable}!inner(${idField})`)
          .eq('user_id', user.id)
          .order('name');

        if (error) throw error;

        const uniqueCategories = (categoriesData ?? []).reduce((acc: Category[], item) => {
          if (!acc.find(c => c.id === item.id)) {
            acc.push({
              id: item.id,
              name: item.name,
              description: item.description ?? '',
              color: item.color,
              user_id: item.user_id,
              created_at: item.created_at,
            });
          }
          return acc;
        }, []);

        const allSubcats = await getSubcategories(user.id);
        const map = new Map<string, Subcategory[]>();
        for (const sub of allSubcats) {
          if (!map.has(sub.category_id)) map.set(sub.category_id, []);
          map.get(sub.category_id)!.push(sub);
        }

        setCategories(uniqueCategories);
        setSubcategoriesMap(map);
        onDataLoaded?.(uniqueCategories, map);
      } catch (err) {
        console.error('[FilterPanel] Error loading taxonomy:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, type]);

  // Fetch scoped tags whenever category / subcategory selection changes
  useEffect(() => {
    if (!user) return;
    if (selectedCategories.length === 0 && selectedSubcategories.length === 0) {
      setScopedTags([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setTagsLoading(true);
      try {
        const [catTags, subcatTags]: [Tag[], Tag[]] = await Promise.all([
          selectedCategories.length > 0
            ? getTagsByCategories(user.id, selectedCategories)
            : Promise.resolve([]),
          selectedSubcategories.length > 0
            ? getTagsForSubcategories(user.id, selectedSubcategories)
            : Promise.resolve([]),
        ]);
        if (!cancelled) {
          const merged = Array.from(
            new Set([...catTags.map(t => t.name), ...subcatTags.map(t => t.name)])
          ).sort();
          setScopedTags(merged);
        }
      } catch (err) {
        console.error('[FilterPanel] Error fetching scoped tags:', err);
      } finally {
        if (!cancelled) setTagsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCategories, selectedSubcategories, user]);

  const toggleExpand = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  // Filter categories (and their subcategories) by the panel search input
  const filteredCategories = useMemo(() => {
    const q = filterSearch.toLowerCase().trim();
    if (!q) return categories;
    return categories.filter(cat => {
      if (cat.name.toLowerCase().includes(q)) return true;
      return (subcategoriesMap.get(cat.id) ?? []).some(s => s.name.toLowerCase().includes(q));
    });
  }, [categories, subcategoriesMap, filterSearch]);

  const getFilteredSubcats = (categoryId: string): Subcategory[] => {
    const all = subcategoriesMap.get(categoryId) ?? [];
    const q = filterSearch.toLowerCase().trim();
    return q ? all.filter(s => s.name.toLowerCase().includes(q)) : all;
  };

  const activeCount = selectedCategories.length + selectedSubcategories.length + selectedTags.length;
  const showTags = selectedCategories.length > 0 || selectedSubcategories.length > 0;

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-2 p-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} height={36} className="w-full" rounded="lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Panel header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Filter className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">Filters</span>
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold leading-none">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors duration-150 font-medium flex-shrink-0"
          >
            Clear all
          </button>
        )}
      </div>

      {/* ── Panel search ──────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Search categories..."
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 transition-all duration-200"
        />
        {filterSearch && (
          <button
            onClick={() => setFilterSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Category + Subcategory accordion ──────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1 mb-2">
          Categories &amp; Subcategories
        </p>

        {filteredCategories.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1 py-2 italic">
            No categories match your search.
          </p>
        ) : (
          <div className="space-y-0.5">
            {filteredCategories.map(category => {
              const isSelected = selectedCategories.includes(category.id);
              const isExpanded = expandedCategories.has(category.id) || filterSearch.length > 0;
              const subcats = getFilteredSubcats(category.id);
              const allSubcats = subcategoriesMap.get(category.id) ?? [];
              const hasSubcats = allSubcats.length > 0;
              const selectedSubCount = allSubcats.filter(s => selectedSubcategories.includes(s.id)).length;

              return (
                <div key={category.id}>
                  {/* Category row */}
                  <div
                    className={`group flex items-center gap-2 px-2 py-2 rounded-lg transition-all duration-150 ${
                      isSelected ? 'bg-primary/10' : 'hover:bg-accent/50'
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => onCategoryToggle(category.id)}
                      role="checkbox"
                      aria-checked={isSelected}
                      aria-label={isSelected ? `Deselect ${category.name}` : `Select ${category.name}`}
                      className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${
                        isSelected
                          ? 'border-primary bg-primary'
                          : 'border-border bg-card group-hover:border-primary/50'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>

                    {/* Color dot + name — also selects category on click */}
                    <button
                      onClick={() => onCategoryToggle(category.id)}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left group/lbl"
                    >
                      <div
                        className="w-2.5 h-2.5 flex-shrink-0 rounded-full shadow-sm"
                        style={{ backgroundColor: category.color || '#64748B' }}
                      />
                      <span className={`text-sm truncate transition-colors duration-150 ${
                        isSelected
                          ? 'font-medium text-foreground'
                          : 'text-foreground/80 group-hover/lbl:text-foreground'
                      }`}>
                        {category.name}
                      </span>
                    </button>

                    {/* Selected-subcategory count badge + expand chevron */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {selectedSubCount > 0 && (
                        <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary/15 text-primary text-xs font-semibold leading-none">
                          {selectedSubCount}
                        </span>
                      )}
                      {hasSubcats && (
                        <button
                          onClick={e => { e.stopPropagation(); toggleExpand(category.id); }}
                          className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          aria-label={isExpanded ? `Collapse ${category.name}` : `Expand ${category.name}`}
                        >
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                          />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Subcategory rows */}
                  {hasSubcats && isExpanded && subcats.length > 0 && (
                    <div className="ml-6 pl-3 mt-0.5 mb-1 space-y-0.5 border-l border-border/50">
                      {subcats.map(sub => {
                        const isSubSelected = selectedSubcategories.includes(sub.id);
                        return (
                          <div
                            key={sub.id}
                            className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-150 ${
                              isSubSelected ? 'bg-success/10' : 'hover:bg-accent/50'
                            }`}
                          >
                            <button
                              onClick={() => onSubcategoryToggle(sub.id)}
                              role="checkbox"
                              aria-checked={isSubSelected}
                              aria-label={isSubSelected ? `Deselect ${sub.name}` : `Select ${sub.name}`}
                              className={`flex-shrink-0 w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${
                                isSubSelected
                                  ? 'border-success bg-success'
                                  : 'border-border bg-card group-hover:border-success/50'
                              }`}
                            >
                              {isSubSelected && (
                                <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 12 12">
                                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={() => onSubcategoryToggle(sub.id)}
                              className={`flex-1 min-w-0 text-left text-sm truncate transition-colors duration-150 ${
                                isSubSelected
                                  ? 'font-medium text-foreground'
                                  : 'text-foreground/70 group-hover:text-foreground'
                              }`}
                            >
                              {sub.name}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Tags section — shown only when ≥1 category/subcategory selected ── */}
      {showTags && (
        <details className="group" open>
          <summary className="flex items-center gap-2 cursor-pointer list-none select-none rounded-lg px-1 py-1.5 hover:bg-accent/50 transition-colors duration-150">
            <Hash className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex-1">Tags</span>
            {selectedTags.length > 0 && (
              <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary/15 text-primary text-xs font-semibold leading-none">
                {selectedTags.length}
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 group-open:rotate-0 -rotate-90" />
          </summary>

          <div className="mt-2 px-1">
            {tagsLoading ? (
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} height={26} width={50 + i * 12} rounded="full" />
                ))}
              </div>
            ) : scopedTags.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-1">
                No tags found for the current selection.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
                {scopedTags.map(tag => {
                  const isTagSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => onTagToggle(tag)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-150 ${
                        isTagSelected
                          ? 'bg-primary/15 border-primary/40 text-primary'
                          : 'border-border/60 text-muted-foreground hover:border-primary/30 hover:text-foreground hover:bg-accent/50'
                      }`}
                    >
                      <TagIcon className="w-2.5 h-2.5 flex-shrink-0" />
                      {tag}
                      {isTagSelected && <X className="w-2.5 h-2.5 ml-0.5 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </details>
      )}

      {/* ── Extra sections slot (Difficulty, Date Range for Learning) ──────── */}
      {extraSections && (
        <div className="space-y-2 pt-2 border-t border-border/60">
          {extraSections}
        </div>
      )}
    </div>
  );
}
