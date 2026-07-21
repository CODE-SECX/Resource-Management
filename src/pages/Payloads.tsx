import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  supabase, 
  type Payload, 
  type PayloadFilters, 
  type PayloadStats,
  getPayloads,
  getPayloadStats,
  getPayloadCategories,
  getPayloadSubcategories,
  getPayloadTags,
  getPayloadSubcategoriesByCategory,
  getPayloadTagsByCategory,
  deletePayload
} from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Search, 
  Filter, 
  Plus, 
  Star, 
  Trash2, 
  X,
  Eye,
  Target,
  AlertTriangle,
  TrendingUp,
  Copy
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Skeleton } from '../components/ui/Skeleton';


export function Payloads() {
  const { user } = useAuth();
  const [payloads, setPayloads] = useState<Payload[]>([]);
  const [stats, setStats] = useState<PayloadStats | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTargetType, setSelectedTargetType] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'created_at' | 'updated_at' | 'usage_count' | 'title'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Mobile responsive state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Available options
  const [categories, setCategories] = useState<string[]>([]);
  const [allSubcategories, setAllSubcategories] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  
  // Filtered options based on selected category
  const [filteredSubcategories, setFilteredSubcategories] = useState<string[]>([]);
  const [filteredTags, setFilteredTags] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      fetchPayloads();
      fetchStats();
      fetchFilterOptions();
    }
  }, [user]);

  useEffect(() => {
    if (user && selectedCategory) {
      fetchFilteredOptions();
    } else {
      // Reset to all options when no category is selected
      setFilteredSubcategories(allSubcategories);
      setFilteredTags(allTags);
    }
  }, [selectedCategory, user]);

  useEffect(() => {
    if (user) {
      fetchPayloads();
    }
  }, [
    searchTerm, selectedCategory, selectedSubcategories, selectedTags, 
    selectedTargetType, favoritesOnly, sortBy, sortOrder
  ]);

  const fetchPayloads = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const filters: PayloadFilters = {
        search: searchTerm || undefined,
        category: selectedCategory || undefined,
        subcategories: selectedSubcategories.length > 0 ? selectedSubcategories : undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        target_type: selectedTargetType.length > 0 ? selectedTargetType : undefined,
        is_favorite: favoritesOnly || undefined,
        sort_by: sortBy,
        sort_order: sortOrder
      };

      const data = await getPayloads(user.id, filters);
      setPayloads(data);
    } catch (error) {
      console.error('Error fetching payloads:', error);
      toast.error('Failed to fetch payloads');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!user) return;
    
    try {
      const data = await getPayloadStats(user.id);
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchFilterOptions = async () => {
    if (!user) return;
    
    try {
      const [cats, subs, ts] = await Promise.all([
        getPayloadCategories(user.id),
        getPayloadSubcategories(user.id),
        getPayloadTags(user.id)
      ]);
      
      setCategories(cats);
      setAllSubcategories(subs);
      setAllTags(ts);
      
      // Initialize filtered options
      setFilteredSubcategories(subs);
      setFilteredTags(ts);
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const fetchFilteredOptions = async () => {
    if (!user || !selectedCategory) return;
    
    try {
      const [filteredSubs, filteredTs] = await Promise.all([
        getPayloadSubcategoriesByCategory(user.id, selectedCategory),
        getPayloadTagsByCategory(user.id, selectedCategory)
      ]);
      
      setFilteredSubcategories(filteredSubs);
      setFilteredTags(filteredTs);
    } catch (error) {
      console.error('Error fetching filtered options:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payload?')) return;
    
    try {
      await deletePayload(id);
      setPayloads(payloads.filter(p => p.id !== id));
      toast.success('Payload deleted successfully');
      fetchStats();
    } catch (error) {
      console.error('Error deleting payload:', error);
      toast.error('Failed to delete payload');
    }
  };

  const handleCopyPayload = async (payload: string) => {
    try {
      await navigator.clipboard.writeText(payload);
      toast.success('Payload copied to clipboard');
    } catch (error) {
      console.error('Error copying payload:', error);
      toast.error('Failed to copy payload');
    }
  };

  const handleCopyAllPayloads = async () => {
    if (payloads.length === 0) {
      toast.error('No payloads to copy');
      return;
    }

    try {
      // Format payloads as a list suitable for testing tools like Burp Suite
      const payloadList = payloads.map(payload => payload.payload).join('\n');
      
      await navigator.clipboard.writeText(payloadList);
      toast.success(`Copied ${payloads.length} payloads to clipboard`);
    } catch (error) {
      console.error('Error copying all payloads:', error);
      toast.error('Failed to copy payloads');
    }
  };

  const handleToggleFavorite = async (payload: Payload) => {
    try {
      const { data: updated, error } = await supabase
        .from('payloads')
        .update({ is_favorite: !payload.is_favorite })
        .eq('id', payload.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setPayloads(payloads.map(p => 
        p.id === payload.id ? updated : p
      ));
      
      toast.success(payload.is_favorite ? 'Removed from favorites' : 'Added to favorites');
      fetchStats();
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedSubcategories([]);
    setSelectedTags([]);
    setSelectedTargetType([]);
    setFavoritesOnly(false);
    // Reset filtered options to show all
    setFilteredSubcategories(allSubcategories);
    setFilteredTags(allTags);
  };

  const hasActiveFilters = Boolean(
    selectedCategory || selectedSubcategories.length > 0 || selectedTags.length > 0 ||
    selectedTargetType.length > 0 || favoritesOnly || searchTerm
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex">
          <div className="hidden lg:block w-80 shrink-0 border-r border-border bg-card p-6 space-y-6">
            <Skeleton height={28} width="60%" />
            <Skeleton height={40} />
            <Skeleton height={80} />
            <Skeleton height={80} />
          </div>
          <div className="flex-1 min-w-0 p-4 lg:p-8 max-w-6xl mx-auto w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
              <div className="space-y-2">
                <Skeleton height={32} width={220} />
                <Skeleton height={16} width={280} />
              </div>
              <Skeleton height={40} width={160} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} height={88} rounded="xl" />
              ))}
            </div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} height={72} rounded="lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex relative">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar */}
        <div className={`
          fixed lg:static inset-y-0 left-0 z-50 lg:z-auto
          w-80 max-w-[85vw] h-screen bg-card border-r border-border
          transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 transition-transform duration-300 ease-in-out
          flex-shrink-0 overflow-y-auto
        `}>
          {/* Sidebar Header */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Filter className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Filters</h2>
              </div>
              {/* Mobile Close Button */}
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors duration-150"
                aria-label="Close filters"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/70 border border-border transition-all duration-200 text-sm text-primary hover:text-primary/80 font-medium"
              >
                <X className="w-3 h-3" />
                <span>Clear all filters</span>
              </button>
            )}
          </div>

          <div className="p-6 space-y-6">
            {/* Search */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-primary/60"></div>
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Search</h3>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search payloads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-primary pl-10"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-success/60"></div>
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Category</h3>
              </div>
              <div className="space-y-2">
                {categories.map((category: string) => (
                  <label key={category} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:border-primary/50 hover:bg-accent cursor-pointer transition-colors duration-150">
                    <input
                      type="radio"
                      name="category"
                      checked={selectedCategory === category}
                      onChange={() => setSelectedCategory(selectedCategory === category ? '' : category)}
                      className="h-3 w-3 text-primary border-border focus:ring-ring/60 focus:ring-offset-0 bg-card"
                    />
                    <span className="text-xs text-foreground font-medium">{category}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Subcategories Filter */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-warning/60"></div>
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Subcategories {selectedCategory && `(for ${selectedCategory})`}
                </h3>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 border border-border rounded-lg p-2 bg-muted/40">
                {filteredSubcategories.length > 0 ? (
                  filteredSubcategories.map(subcategory => (
                    <label key={subcategory} className="flex items-center text-sm gap-2 py-0.5">
                      <input
                        type="checkbox"
                        checked={selectedSubcategories.includes(subcategory)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSubcategories([...selectedSubcategories, subcategory]);
                          } else {
                            setSelectedSubcategories(selectedSubcategories.filter(s => s !== subcategory));
                          }
                        }}
                        className="rounded border-border text-primary focus:ring-ring/60"
                      />
                      <span className="text-foreground">{subcategory}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm italic">
                    {selectedCategory ? 'No subcategories found' : 'Select a category to see subcategories'}
                  </p>
                )}
              </div>
            </div>

            {/* Tags Filter */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-accent-foreground/60"></div>
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Tags {selectedCategory && `(for ${selectedCategory})`}
                </h3>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 border border-border rounded-lg p-2 bg-muted/40">
                {filteredTags.length > 0 ? (
                  filteredTags.map(tag => (
                    <label key={tag} className="flex items-center text-sm gap-2 py-0.5">
                      <input
                        type="checkbox"
                        checked={selectedTags.includes(tag)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTags([...selectedTags, tag]);
                          } else {
                            setSelectedTags(selectedTags.filter(t => t !== tag));
                          }
                        }}
                        className="rounded border-border text-primary focus:ring-ring/60"
                      />
                      <span className="text-foreground">{tag}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm italic">
                    {selectedCategory ? 'No tags found' : 'Select a category to see tags'}
                  </p>
                )}
              </div>
            </div>

            {/* Target Type Filter */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-primary/40"></div>
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Target Type</h3>
              </div>
              <div className="space-y-2">
                {['web', 'api', 'mobile', 'network', 'other'].map(type => (
                  <label key={type} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:border-primary/50 hover:bg-accent cursor-pointer transition-colors duration-150">
                    <input
                      type="checkbox"
                      checked={selectedTargetType.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTargetType([...selectedTargetType, type]);
                        } else {
                          setSelectedTargetType(selectedTargetType.filter(t => t !== type));
                        }
                      }}
                      className="h-3 w-3 text-primary border-border rounded focus:ring-ring/60 focus:ring-offset-0 bg-card"
                    />
                    <span className="text-xs text-foreground font-medium capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Favorites Filter */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-warning/60"></div>
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Options</h3>
              </div>
              <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:border-primary/50 hover:bg-accent cursor-pointer transition-colors duration-150">
                <input
                  type="checkbox"
                  checked={favoritesOnly}
                  onChange={(e) => setFavoritesOnly(e.target.checked)}
                  className="h-3 w-3 text-primary border-border rounded focus:ring-ring/60 focus:ring-offset-0 bg-card"
                />
                <span className="text-xs text-foreground font-medium">Show favorites only</span>
              </label>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="p-4 lg:p-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 lg:mb-8 gap-4">
              <div className="flex items-center gap-4">
                {/* Mobile Menu Button */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-lg bg-card border border-border text-foreground hover:bg-accent transition-colors duration-150"
                  aria-label="Toggle filters"
                >
                  <Filter className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-1">Payload Arsenal</h1>
                  <p className="text-sm sm:text-base text-muted-foreground">Manage your bug bounty payloads with smart filtering and quick access</p>
                </div>
              </div>
              <div className="flex items-center gap-2 lg:gap-3">
                <button
                  onClick={handleCopyAllPayloads}
                  className="btn-secondary"
                  title="Copy all filtered payloads"
                >
                  <Copy className="w-4 h-4" />
                  <span className="hidden sm:inline">Copy All</span>
                  <span className="sm:hidden">Copy</span>
                </button>
                <Link
                  to="/payloads/create"
                  className="btn-primary"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">New Payload</span>
                  <span className="sm:hidden">New</span>
                </Link>
              </div>
            </div>

            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
                <div className="card p-4 lg:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-sm">Total Payloads</p>
                      <p className="text-xl lg:text-2xl font-bold text-foreground">{stats.total_payloads}</p>
                    </div>
                    <Target className="w-6 h-6 lg:w-8 lg:h-8 text-primary" />
                  </div>
                </div>
            
                <div className="card p-4 lg:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-sm">Favorites</p>
                      <p className="text-xl lg:text-2xl font-bold text-foreground">{stats.favorite_payloads}</p>
                    </div>
                    <Star className="w-6 h-6 lg:w-8 lg:h-8 text-warning" />
                  </div>
                </div>
            
                <div className="card p-4 lg:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-sm">Critical/High</p>
                      <p className="text-xl lg:text-2xl font-bold text-foreground">{stats.critical_payloads + stats.high_payloads}</p>
                    </div>
                    <AlertTriangle className="w-6 h-6 lg:w-8 lg:h-8 text-destructive" />
                  </div>
                </div>
            
                <div className="card p-4 lg:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-sm">Most Used</p>
                      <p className="text-xl lg:text-2xl font-bold text-foreground">{stats.max_usage_count}</p>
                    </div>
                    <TrendingUp className="w-6 h-6 lg:w-8 lg:h-8 text-success" />
                  </div>
                </div>
              </div>
            )}

            {/* Results Counter + Sort Options */}
            <div className="mb-4 lg:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-muted-foreground text-sm lg:text-base">
                {payloads.length} payload{payloads.length !== 1 ? 's' : ''} found
              </p>

              <div className="flex flex-col xs:flex-row xs:items-center gap-2 xs:gap-3">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="input-primary xs:w-auto"
                >
                  <option value="created_at">Date Created</option>
                  <option value="updated_at">Last Updated</option>
                  <option value="usage_count">Usage Count</option>
                  <option value="title">Title</option>
                </select>
                
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="input-primary xs:w-auto"
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
            </div>

            {/* Payloads List */}
            <div className="space-y-3">
              {payloads.length === 0 ? (
                <div className="text-center py-12 card">
                  <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">No payloads found</h3>
                  <p className="text-muted-foreground mb-6">Start building your payload arsenal by creating your first payload</p>
                  <Link
                    to="/payloads?action=create"
                    className="btn-primary inline-flex"
                  >
                    <Plus className="w-4 h-4" />
                    Create Your First Payload
                  </Link>
                </div>
              ) : (
                payloads.map((payload) => (
                  <div key={payload.id} className="card card-hover">
                    <div className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Clickable Payload */}
                          <button
                            type="button"
                            onClick={() => handleCopyPayload(payload.payload)}
                            className="w-full text-left cursor-pointer rounded-lg group/payload"
                            title="Click to copy payload"
                          >
                            <div className="font-mono text-sm bg-muted border border-border rounded-lg p-3 sm:p-4 text-foreground group-hover/payload:border-primary/40 transition-colors duration-150 overflow-x-auto">
                              <code className="break-all">{payload.payload}</code>
                            </div>
                          </button>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center gap-1 sm:ml-2 self-end sm:self-start">
                          <button
                            onClick={() => handleToggleFavorite(payload)}
                            className={`p-2 rounded-lg transition-colors duration-150 ${
                              payload.is_favorite ? 'text-warning' : 'text-muted-foreground hover:text-warning hover:bg-accent'
                            }`}
                            aria-label={payload.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                            title={payload.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <Star className={`w-4 h-4 ${payload.is_favorite ? 'fill-current' : ''}`} />
                          </button>
                          <Link
                            to={`/payloads/${payload.id}`}
                            className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-accent transition-colors duration-150"
                            aria-label="View details"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(payload.id)}
                            className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-accent transition-colors duration-150"
                            aria-label="Delete payload"
                            title="Delete payload"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
