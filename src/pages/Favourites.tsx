import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  type Learning,
  type Resource,
  getFavourites,
  toggleLearningFavourite,
  toggleResourceFavourite,
} from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Star,
  GraduationCap,
  BookOpen,
  ArrowUpRight,
  Search,
  Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/ui/PageHeader';
import { Skeleton } from '../components/ui/Skeleton';

type TabValue = 'all' | 'learning' | 'resources';

export function Favourites() {
  const { user } = useAuth();
  const [learningItems, setLearningItems] = useState<Learning[]>([]);
  const [resourceItems, setResourceItems] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) {
      fetchFavourites();
    }
  }, [user]);

  const fetchFavourites = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { learning, resources } = await getFavourites(user.id);
      setLearningItems(learning);
      setResourceItems(resources);
    } catch (error) {
      console.error('Error fetching favourites:', error);
      toast.error('Failed to load favourites');
    } finally {
      setLoading(false);
    }
  };

  const handleUnfavouriteLearning = async (item: Learning) => {
    // Optimistic remove
    setLearningItems(prev => prev.filter(l => l.id !== item.id));
    try {
      await toggleLearningFavourite(item.id, false);
      toast.success('Removed from Favourites');
    } catch {
      setLearningItems(prev => [...prev, item]);
      toast.error('Failed to update favourite');
    }
  };

  const handleUnfavouriteResource = async (item: Resource) => {
    // Optimistic remove
    setResourceItems(prev => prev.filter(r => r.id !== item.id));
    try {
      await toggleResourceFavourite(item.id, false);
      toast.success('Removed from Favourites');
    } catch {
      setResourceItems(prev => [...prev, item]);
      toast.error('Failed to update favourite');
    }
  };

  const q = searchQuery.toLowerCase();
  const filteredLearning = useMemo(
    () =>
      learningItems.filter(
        l =>
          l.title.toLowerCase().includes(q) ||
          l.description?.toLowerCase().includes(q)
      ),
    [learningItems, q]
  );
  const filteredResources = useMemo(
    () =>
      resourceItems.filter(
        r =>
          r.title.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q)
      ),
    [resourceItems, q]
  );

  const totalCount = learningItems.length + resourceItems.length;

  const tabs: { label: string; value: TabValue; count: number }[] = [
    { label: 'All', value: 'all', count: learningItems.length + resourceItems.length },
    { label: 'Learning', value: 'learning', count: learningItems.length },
    { label: 'Resources', value: 'resources', count: resourceItems.length },
  ];

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'Beginner': return 'bg-success/15 text-success border-success/30';
      case 'Intermediate': return 'bg-primary/15 text-primary border-primary/30';
      case 'Advanced': return 'bg-warning/15 text-warning border-warning/30';
      case 'Expert': return 'bg-destructive/15 text-destructive border-destructive/30';
      default: return 'bg-secondary text-secondary-foreground border-border';
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="space-y-2">
            <Skeleton height={32} width={220} />
            <Skeleton height={16} width={320} />
          </div>
        </div>
        <Skeleton height={44} className="w-full" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
              <Skeleton height={20} width="70%" />
              <div className="flex gap-2">
                <Skeleton height={20} width={80} rounded="full" />
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
      {/* Header */}
      <PageHeader
        title="Favourites"
        subtitle={
          totalCount > 0
            ? `${totalCount} item${totalCount !== 1 ? 's' : ''} saved for quick access`
            : 'Star items from Learning or Resources to access them here'
        }
        actions={
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-400/10 border border-amber-400/30 rounded-lg">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="text-sm font-semibold text-amber-500">{totalCount}</span>
          </div>
        }
      />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <input
          type="text"
          placeholder="Search favourites..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="input-primary pl-10 py-3"
          id="favourites-search"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-xl w-fit">
        {tabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.value
                ? 'bg-card text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            id={`favourites-tab-${tab.value}`}
            aria-selected={activeTab === tab.value}
          >
            {tab.label}
            <span
              className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-bold rounded-full ${
                activeTab === tab.value
                  ? 'bg-amber-400/20 text-amber-600'
                  : 'bg-muted-foreground/20 text-muted-foreground'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Empty state */}
      {totalCount === 0 && (
        <div className="text-center py-24 px-4">
          <div className="mx-auto w-24 h-24 bg-amber-400/10 rounded-full flex items-center justify-center mb-6">
            <Star className="w-10 h-10 text-amber-400" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">No favourites yet</h3>
          <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
            Click the ⭐ star icon on any Learning or Resource card to save it here for quick access.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/learning" className="btn-secondary inline-flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              Browse Learning
            </Link>
            <Link to="/resources" className="btn-secondary inline-flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Browse Resources
            </Link>
          </div>
        </div>
      )}

      {/* Search empty state */}
      {totalCount > 0 && filteredLearning.length === 0 && filteredResources.length === 0 && (
        <div className="text-center py-16 px-4">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Search className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No results found</h3>
          <p className="text-muted-foreground">No favourites match "{searchQuery}"</p>
        </div>
      )}

      {/* Learning section */}
      {(activeTab === 'all' || activeTab === 'learning') && filteredLearning.length > 0 && (
        <div className="space-y-4">
          {activeTab === 'all' && (
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap className="w-4 h-4 text-success" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Learning
              </h2>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {filteredLearning.length}
              </span>
            </div>
          )}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredLearning.map(item => (
              <div
                key={item.id}
                className="group relative bg-card rounded-xl border border-border shadow-card hover:shadow-card-hover hover:border-amber-400/30 transition-all duration-300 overflow-hidden"
              >
                {/* Amber top accent */}
                <div className="h-0.5 w-full bg-gradient-to-r from-amber-400/60 via-amber-400/20 to-transparent" />

                <div className="p-5">
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/10">
                        <GraduationCap className="w-3.5 h-3.5 text-success" />
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getDifficultyColor(item.difficulty_level)}`}
                      >
                        {item.difficulty_level}
                      </span>
                    </div>
                    <button
                      onClick={() => handleUnfavouriteLearning(item)}
                      className="p-1.5 text-amber-400 hover:text-muted-foreground hover:bg-muted rounded-md transition-all duration-150"
                      title="Remove from Favourites"
                      aria-label="Remove from Favourites"
                    >
                      <Star className="w-4 h-4 fill-amber-400 hover:fill-none transition-all" />
                    </button>
                  </div>

                  {/* Title */}
                  <Link
                    to={`/learning/${item.id}`}
                    className="block mb-3 group/title"
                  >
                    <h3 className="text-base font-semibold text-foreground leading-snug group-hover/title:text-primary transition-colors duration-200 line-clamp-2">
                      {item.title}
                    </h3>
                  </Link>

                  {/* Description */}
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {item.description}
                    </p>
                  )}

                  {/* Category pills */}
                  {item.categories && item.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {item.categories.map(cat => (
                        <span
                          key={cat.id}
                          className="inline-block px-2 py-0.5 text-xs font-medium text-white rounded-md opacity-90"
                          style={{ backgroundColor: cat.color }}
                        >
                          {cat.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {new Date(item.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <div className="flex items-center gap-2">
                      {item.url?.trim() && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors duration-150 group/link"
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
            ))}
          </div>
        </div>
      )}

      {/* Resources section */}
      {(activeTab === 'all' || activeTab === 'resources') && filteredResources.length > 0 && (
        <div className="space-y-4">
          {activeTab === 'all' && (
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Resources
              </h2>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {filteredResources.length}
              </span>
            </div>
          )}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredResources.map(item => (
              <div
                key={item.id}
                className="group relative bg-card rounded-xl border border-border shadow-card hover:shadow-card-hover hover:border-amber-400/30 transition-all duration-300 overflow-hidden"
              >
                {/* Amber top accent */}
                <div className="h-0.5 w-full bg-gradient-to-r from-amber-400/60 via-amber-400/20 to-transparent" />

                <div className="p-5">
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                      <BookOpen className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <button
                      onClick={() => handleUnfavouriteResource(item)}
                      className="p-1.5 text-amber-400 hover:text-muted-foreground hover:bg-muted rounded-md transition-all duration-150"
                      title="Remove from Favourites"
                      aria-label="Remove from Favourites"
                    >
                      <Star className="w-4 h-4 fill-amber-400 hover:fill-none transition-all" />
                    </button>
                  </div>

                  {/* Title */}
                  <Link
                    to={`/resources/${item.id}`}
                    className="block mb-3 group/title"
                  >
                    <h3 className="text-base font-semibold text-foreground leading-snug group-hover/title:text-primary transition-colors duration-200 line-clamp-2">
                      {item.title}
                    </h3>
                  </Link>

                  {/* Description */}
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {item.description}
                    </p>
                  )}

                  {/* Category pills */}
                  {item.categories && item.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {item.categories.map(cat => (
                        <span
                          key={cat.id}
                          className="inline-block px-2 py-0.5 text-xs font-medium text-white rounded-md opacity-90"
                          style={{ backgroundColor: cat.color }}
                        >
                          {cat.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Tags */}
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {item.tags.slice(0, 3).map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground border border-border rounded-md"
                        >
                          {tag}
                        </span>
                      ))}
                      {item.tags.length > 3 && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs text-muted-foreground bg-muted rounded-md">
                          +{item.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {new Date(item.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <div className="flex items-center gap-2">
                      {item.url?.trim() && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors duration-150 group/link"
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
            ))}
          </div>
        </div>
      )}

      {/* All-tab separator when both sections present */}
      {activeTab === 'all' && filteredLearning.length > 0 && filteredResources.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Layers className="w-3.5 h-3.5" />
          <span>Use the tabs above to filter by type</span>
        </div>
      )}
    </div>
  );
}
