import { useState, useEffect } from 'react';
import {
  supabase,
  type Learning,
  type Category,
  type Subcategory,
  toggleLearningFavourite,
} from '../lib/supabase';
import { openContentTarget } from '../utils/openContent';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Filter, Edit2, Trash2, Tag, X, GraduationCap, Grid, LayoutList, BookOpen, ArrowUpRight, Copy, Check, Star, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate, Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { SectionTabs } from '../components/SectionTabs';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/Skeleton';
import { FilterPanel, ActiveFilterBar, type FilterChip } from '../components/FilterPanel';

const difficultyLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'] as const;

export function Learning() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [learning, setLearning] = useState<Learning[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedSubcategoryFilters, setSelectedSubcategoryFilters] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{start: string; end: string}>({ start: '', end: '' });
  const [isGridLayout, setIsGridLayout] = useState(true);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [copiedLearningId, setCopiedLearningId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Taxonomy data received from FilterPanel — used for chip label resolution
  const [panelCats, setPanelCats] = useState<Category[]>([]);
  const [panelSubsMap, setPanelSubsMap] = useState<Map<string, Subcategory[]>>(new Map());
  useEffect(() => {
    if (user) {
      fetchLearning();
    }
  }, [user]);

  const fetchLearning = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('learning')
        .select(`
          *,
          learning_categories(
            categories(*)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const learningWithCategories = data?.map(item => ({
        ...item,
        categories: item.learning_categories.map((lc: any) => lc.categories),
      })) || [];

      setLearning(learningWithCategories);
    } catch (error) {
      console.error('Error fetching learning:', error);
      toast.error('Failed to fetch learning items');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavourite = async (item: Learning) => {
    const newValue = !item.is_favorite;
    // Optimistic update
    setLearning(prev =>
      prev.map(l => l.id === item.id ? { ...l, is_favorite: newValue } : l)
    );
    try {
      await toggleLearningFavourite(item.id, newValue);
      toast.success(newValue ? '⭐ Added to Favourites' : 'Removed from Favourites');
    } catch (error) {
      // Revert on failure
      setLearning(prev =>
        prev.map(l => l.id === item.id ? { ...l, is_favorite: !newValue } : l)
      );
      toast.error('Failed to update favourite');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this learning item?')) return;

    try {
      await supabase
        .from('learning_categories')
        .delete()
        .eq('learning_id', id);

      const { error } = await supabase
        .from('learning')
        .delete()
        .eq('id', id)
        .eq('user_id', user!.id);

      if (error) throw error;
      toast.success('Learning item deleted successfully!');
      fetchLearning();
    } catch (error) {
      console.error('Error deleting learning item:', error);
      toast.error('Failed to delete learning item');
    }
  };

  const handleCopyLearningLink = async (id: string) => {
    const itemUrl = `${window.location.origin}/learning/${id}`;
    try {
      await navigator.clipboard.writeText(itemUrl);
      setCopiedLearningId(id);
      toast.success('Learning link copied to clipboard!');
      setTimeout(() => {
        setCopiedLearningId(prev => (prev === id ? null : prev));
      }, 2000);
    } catch (error) {
      console.error('Error copying learning link:', error);
      toast.error('Failed to copy link');
    }
  };

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'Beginner': return 'bg-success/10 text-success border-success/30 dark:bg-success/15';
      case 'Intermediate': return 'bg-primary/10 text-primary border-primary/30 dark:bg-primary/15';
      case 'Advanced': return 'bg-warning/10 text-warning border-warning/30 dark:bg-warning/15';
      case 'Expert': return 'bg-destructive/10 text-destructive border-destructive/30 dark:bg-destructive/15';
      default: return 'bg-secondary text-secondary-foreground border-border';
    }
  };

  const getDifficultyAccent = (level: string) => {
    switch (level) {
      case 'Beginner': return 'from-success/30 to-transparent';
      case 'Intermediate': return 'from-primary/30 to-transparent';
      case 'Advanced': return 'from-warning/30 to-transparent';
      case 'Expert': return 'from-destructive/30 to-transparent';
      default: return 'from-muted-foreground/20 to-transparent';
    }
  };

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedSubcategoryFilters([]);
    setSelectedTags([]);
    setSelectedDifficulty([]);
    setDateRange({ start: '', end: '' });
  };

  const filterChips: FilterChip[] = [
    ...selectedCategories.map(catId => {
      const cat = panelCats.find(c => c.id === catId);
      return {
        id: `cat-${catId}`,
        label: cat?.name ?? catId,
        color: cat?.color,
        variant: 'category' as const,
        onRemove: () => setSelectedCategories(prev => prev.filter(id => id !== catId)),
      };
    }),
    ...selectedSubcategoryFilters.map(subId => {
      let name = subId;
      panelSubsMap.forEach(subcats => {
        const sub = subcats.find(s => s.id === subId);
        if (sub) name = sub.name;
      });
      return {
        id: `sub-${subId}`,
        label: name,
        variant: 'subcategory' as const,
        onRemove: () => setSelectedSubcategoryFilters(prev => prev.filter(s => s !== subId)),
      };
    }),
    ...selectedTags.map(tag => ({
      id: `tag-${tag}`,
      label: tag,
      variant: 'tag' as const,
      onRemove: () => setSelectedTags(prev => prev.filter(t => t !== tag)),
    })),
    ...selectedDifficulty.map(d => ({
      id: `diff-${d}`,
      label: d,
      variant: 'other' as const,
      onRemove: () => setSelectedDifficulty(prev => prev.filter(x => x !== d)),
    })),
    ...(dateRange.start ? [{
      id: 'date-from',
      label: `From: ${dateRange.start}`,
      variant: 'other' as const,
      onRemove: () => setDateRange(prev => ({ ...prev, start: '' })),
    }] : []),
    ...(dateRange.end ? [{
      id: 'date-to',
      label: `To: ${dateRange.end}`,
      variant: 'other' as const,
      onRemove: () => setDateRange(prev => ({ ...prev, end: '' })),
    }] : []),
  ];

  const filteredLearning = learning.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategories = selectedCategories.length === 0 ||
                             item.categories?.some(cat => selectedCategories.includes(cat.id));

    const matchesTags = selectedTags.length === 0 ||
                       selectedTags.some(tag => item.tags.includes(tag));

    const matchesSubcategories = selectedSubcategoryFilters.length === 0 ||
                          selectedSubcategoryFilters.some(sc => item.taxonomySubcategories?.some(tsc => tsc.id === sc));

    const matchesDifficulty = selectedDifficulty.length === 0 ||
                             selectedDifficulty.includes(item.difficulty_level);

    const matchesDate = (!dateRange.start && !dateRange.end) ||
                       ((!dateRange.start || new Date(item.created_at) >= new Date(dateRange.start)) &&
                        (!dateRange.end || new Date(item.created_at) <= new Date(dateRange.end)));

    return matchesSearch && matchesCategories && matchesTags && matchesSubcategories && matchesDifficulty && matchesDate;
  });

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="space-y-2">
            <Skeleton height={32} width={220} />
            <Skeleton height={16} width={320} />
          </div>
          <Skeleton height={40} width={160} />
        </div>
        <Skeleton height={44} className="w-full" />
        <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
              <Skeleton height={20} width="70%" />
              <div className="flex gap-2">
                <Skeleton height={20} width={60} rounded="full" />
                <Skeleton height={20} width={60} rounded="full" />
              </div>
              <Skeleton height={14} width="90%" />
              <Skeleton height={14} width="40%" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionTabs section="learning" className="-mb-4" />
      {/* Header */}
      <PageHeader
        title="Learning Resources"
        subtitle="Discover and track your learning journey with curated resources"
        actions={
          <>
            <button
              onClick={() => setIsGridLayout(!isGridLayout)}
              className="p-2.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-accent transition-colors duration-150"
              title={isGridLayout ? "Switch to list view" : "Switch to grid view"}
              aria-label={isGridLayout ? "Switch to list view" : "Switch to grid view"}
            >
              {isGridLayout ? (
                <LayoutList className="w-5 h-5" />
              ) : (
                <Grid className="w-5 h-5" />
              )}
            </button>
            <Link
              to="/taxonomy"
              className="btn-secondary"
              title="Manage taxonomy"
            >
              Manage Taxonomy
            </Link>
            <Button onClick={() => navigate('/learning/new')}>
              <Plus className="w-4 h-4" />
              Add Learning
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div>
        {/* Search bar + toggle button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Search learning items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-primary pl-10 py-2.5"
            />
          </div>
          <button
            onClick={() => setFiltersOpen(prev => !prev)}
            className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-colors duration-150 text-sm font-medium ${
              filtersOpen
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-card border-border text-foreground hover:bg-accent'
            }`}
            aria-expanded={filtersOpen}
            title="Toggle filters"
          >
            <Filter className="w-4 h-4" />
            Filters
            {filterChips.length > 0 && (
              <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold leading-none">
                {filterChips.length}
              </span>
            )}
          </button>
        </div>

        {/* Active filter chip bar */}
        {filterChips.length > 0 && (
          <div className="mb-4">
            <ActiveFilterBar chips={filterChips} onClearAll={clearAllFilters} />
          </div>
        )}

        {/* Filter panel — inline on desktop, bottom sheet on mobile */}
        {filtersOpen && (
          <>
            {/* Mobile backdrop */}
            <div
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setFiltersOpen(false)}
            />

            {/* Panel container */}
            <div className={
              [
                // Mobile: fixed bottom sheet
                'fixed inset-x-0 bottom-0 z-50 max-h-[85vh] rounded-t-2xl border-t border-border bg-card',
                'flex flex-col',
                // Desktop: inline panel card
                'lg:relative lg:inset-auto lg:z-auto lg:max-h-none lg:rounded-xl lg:border lg:mb-6',
              ].join(' ')
            }>
              {/* Drag handle — mobile only */}
              <div className="lg:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>

              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
                <h2 className="text-sm font-semibold text-foreground">Filter Learning Resources</h2>
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-150"
                  aria-label="Close filters"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable filter content */}
              <div className="flex-1 overflow-y-auto p-4 min-h-0">
                <FilterPanel
                  type="learning"
                  selectedCategories={selectedCategories}
                  selectedSubcategories={selectedSubcategoryFilters}
                  selectedTags={selectedTags}
                  onCategoryToggle={(id) => setSelectedCategories(prev =>
                    prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
                  )}
                  onSubcategoryToggle={(id) => setSelectedSubcategoryFilters(prev =>
                    prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
                  )}
                  onTagToggle={(tag) => setSelectedTags(prev =>
                    prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                  )}
                  onClearAll={clearAllFilters}
                  onDataLoaded={(cats, map) => {
                    setPanelCats(cats);
                    setPanelSubsMap(map);
                  }}
                  extraSections={
                    <>
                      {/* Difficulty */}
                      <details className="group" open>
                        <summary className="flex items-center gap-2 cursor-pointer list-none select-none rounded-lg px-1 py-1.5 hover:bg-accent/50 transition-colors duration-150">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex-1">Difficulty</span>
                          {selectedDifficulty.length > 0 && (
                            <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary/15 text-primary text-xs font-semibold leading-none">
                              {selectedDifficulty.length}
                            </span>
                          )}
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 group-open:rotate-0 -rotate-90" />
                        </summary>
                        <div className="mt-2 px-1 flex flex-wrap gap-2">
                          {difficultyLevels.map(level => (
                            <button
                              key={level}
                              onClick={() => setSelectedDifficulty(prev =>
                                prev.includes(level) ? prev.filter(d => d !== level) : [...prev, level]
                              )}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                                selectedDifficulty.includes(level)
                                  ? getDifficultyColor(level)
                                  : 'text-muted-foreground border-border hover:bg-accent'
                              }`}
                            >
                              {level}
                              {selectedDifficulty.includes(level) && <X className="w-2.5 h-2.5 ml-0.5" />}
                            </button>
                          ))}
                        </div>
                      </details>

                      {/* Date Range */}
                      <details className="group">
                        <summary className="flex items-center gap-2 cursor-pointer list-none select-none rounded-lg px-1 py-1.5 hover:bg-accent/50 transition-colors duration-150">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex-1">Date Range</span>
                          {(dateRange.start || dateRange.end) && (
                            <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary/15 text-primary text-xs font-semibold leading-none">
                              {(dateRange.start ? 1 : 0) + (dateRange.end ? 1 : 0)}
                            </span>
                          )}
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 group-open:rotate-0 -rotate-90" />
                        </summary>
                        <div className="mt-2 px-1 space-y-2">
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">From</label>
                            <input
                              type="date"
                              value={dateRange.start}
                              onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                              className="input-primary text-sm w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">To</label>
                            <input
                              type="date"
                              value={dateRange.end}
                              onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                              className="input-primary text-sm w-full"
                            />
                          </div>
                          {(dateRange.start || dateRange.end) && (
                            <button
                              onClick={() => setDateRange({ start: '', end: '' })}
                              className="text-xs text-left text-muted-foreground hover:text-destructive transition-colors duration-150"
                            >
                              Clear dates
                            </button>
                          )}
                        </div>
                      </details>
                    </>
                  }
                />
              </div>

              {/* Apply button — mobile only */}
              <div className="lg:hidden p-4 border-t border-border flex-shrink-0">
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors duration-150"
                >
                  Apply Filters{filterChips.length > 0 ? ` (${filterChips.length})` : ''}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Learning Grid/List View */}
      <div className={isGridLayout ? "grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "space-y-3"}>
        {filteredLearning.map((item) => {
          const isExpanded = expandedItemId === item.id;
          return (
            <div
              key={item.id}
              className={`group relative bg-card rounded-xl border border-border shadow-card hover:shadow-card-hover hover:border-primary/30 transition-all duration-300 overflow-hidden ${!isGridLayout ? 'cursor-pointer' : ''}`}
              onClick={() => !isGridLayout && setExpandedItemId(isExpanded ? null : item.id)}
            >
              {/* Difficulty accent bar at top */}
              <div className={`h-1 w-full bg-gradient-to-r ${getDifficultyAccent(item.difficulty_level).replace('to-transparent', 'to-primary/10')}`} />

              <div
                className="p-5"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Top row: difficulty badge + actions */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border tracking-wide ${getDifficultyColor(item.difficulty_level)}`}>
                    <GraduationCap className="w-3 h-3" />
                    {item.difficulty_level}
                  </span>
                  <div className="flex items-center gap-1">
                    {/* Favourite star — always visible */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavourite(item);
                      }}
                      className={`p-1.5 rounded-md transition-all duration-150 ${
                        item.is_favorite
                          ? 'text-amber-400 hover:text-amber-500 hover:bg-amber-400/10'
                          : 'text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10 opacity-0 group-hover:opacity-100 focus-within:opacity-100'
                      }`}
                      title={item.is_favorite ? 'Remove from Favourites' : 'Add to Favourites'}
                      aria-label={item.is_favorite ? 'Remove from Favourites' : 'Add to Favourites'}
                    >
                      <Star className={`w-3.5 h-3.5 ${item.is_favorite ? 'fill-amber-400' : ''}`} />
                    </button>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/learning/${item.id}/edit`);
                      }}
                      className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors duration-150"
                      title="Edit"
                      aria-label="Edit learning item"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors duration-150"
                      title="Delete"
                      aria-label="Delete learning item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    </div>
                  </div>
                </div>

                {/* Title */}
                <Link
                  to={`/learning/${item.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="block mb-3 group/title"
                >
                  <h2 className="text-base font-semibold text-foreground leading-snug group-hover/title:text-primary transition-colors duration-200 line-clamp-2">
                    {item.title}
                  </h2>
                </Link>

                {/* Category pills */}
                {item.categories && item.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {item.categories.map((category) => (
                      <span
                        key={category.id}
                        className="inline-block px-2 py-0.5 text-xs font-medium text-white rounded-md opacity-90"
                        style={{ backgroundColor: category.color }}
                      >
                        {category.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Subcategories */}
                {item.taxonomySubcategories && item.taxonomySubcategories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {item.taxonomySubcategories.map((sc) => (
                      <span
                        key={sc.id}
                        className="category-tag"
                      >
                        {sc.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Tags */}
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {item.tags.slice(0, 4).map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground border border-border rounded-md"
                      >
                        <Tag className="w-2.5 h-2.5 mr-1 text-muted-foreground" />
                        {tag}
                      </span>
                    ))}
                    {item.tags.length > 4 && (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs text-muted-foreground bg-muted rounded-md">
                        +{item.tags.length - 4}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer: date + open link */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyLearningLink(item.id);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg px-2 py-1 transition-colors duration-150"
                      title={copiedLearningId === item.id ? 'Copied!' : 'Copy link'}
                      aria-label="Copy learning link"
                    >
                      {copiedLearningId === item.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedLearningId === item.id ? 'Copied' : 'Copy'}
                    </button>
                    <div className="flex items-center gap-2">
                      {item.html_content?.trim() && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openContentTarget(item);
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors duration-150 rounded-lg px-2 py-1"
                          title="Open HTML Content"
                          aria-label="Open HTML Content"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          HTML
                        </button>
                      )}
                      {item.url?.trim() && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors duration-150 group/link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          Open
                          <ArrowUpRight className="w-3 h-3 opacity-60 group-hover/link:opacity-100 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform duration-150" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredLearning.length === 0 && (
        <div className="text-center py-16 px-4">
          <div className="mx-auto w-20 h-20 sm:w-24 sm:h-24 bg-muted rounded-full flex items-center justify-center mb-4">
            <GraduationCap className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {learning.length === 0 ? 'No learning items yet' : 'No matching learning items'}
          </h3>
          <p className="text-muted-foreground mb-6">
            {learning.length === 0
              ? 'Add your first learning item to get started.'
              : 'Try adjusting your search or filters.'}
          </p>
          {learning.length === 0 && (
            <Button onClick={() => navigate('/learning/new')}>
              <Plus className="w-4 h-4" />
              Add Your First Learning Item
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
