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


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="flex relative">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar */}
        <div className={`
          fixed lg:static inset-y-0 left-0 z-50 lg:z-auto
          w-80 h-screen bg-gray-800 border-r border-gray-700
          transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 transition-transform duration-300 ease-in-out
          flex-shrink-0 overflow-y-auto
        `}>
          {/* Sidebar Header */}
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Filter className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-100">Filters</h2>
              </div>
              {/* Mobile Close Button */}
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                title="Close filters"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Clear Filters Button */}
            {(selectedCategory || selectedSubcategories.length > 0 || selectedTags.length > 0 || 
              selectedTargetType.length > 0 || favoritesOnly || searchTerm) && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 border border-gray-600 transition-all duration-200 text-sm text-indigo-400 hover:text-indigo-300 font-medium"
              >
                <X className="w-3 h-3" />
                <span>Clear all filters</span>
              </button>
            )}
          </div>

          <div className="p-6 space-y-6">
            {/* Search */}
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-gradient-to-b from-blue-400 to-blue-600"></div>
                <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">Search</h3>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search payloads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-gradient-to-b from-green-400 to-green-600"></div>
                <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">Category</h3>
              </div>
              <div className="space-y-2">
                {categories.map((category: string) => (
                  <label key={category} className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-gray-600 hover:border-indigo-500/50 hover:bg-gray-700 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="category"
                      checked={selectedCategory === category}
                      onChange={() => setSelectedCategory(selectedCategory === category ? '' : category)}
                      className="h-3 w-3 text-indigo-500 border-gray-600 rounded focus:ring-indigo-500 focus:ring-offset-0 bg-gray-700"
                    />
                    <span className="text-xs text-gray-300 font-medium">{category}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Subcategories Filter */}
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-gradient-to-b from-yellow-400 to-yellow-600"></div>
                <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">
                  Subcategories {selectedCategory && `(for ${selectedCategory})`}
                </h3>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 border border-gray-600 rounded-lg p-2 bg-gray-700">
                {filteredSubcategories.length > 0 ? (
                  filteredSubcategories.map(subcategory => (
                    <label key={subcategory} className="flex items-center text-sm">
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
                        className="mr-2 rounded border-gray-600 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-gray-300">{subcategory}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm italic">
                    {selectedCategory ? 'No subcategories found' : 'Select a category to see subcategories'}
                  </p>
                )}
              </div>
            </div>

            {/* Tags Filter */}
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-gradient-to-b from-purple-400 to-purple-600"></div>
                <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">
                  Tags {selectedCategory && `(for ${selectedCategory})`}
                </h3>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 border border-gray-600 rounded-lg p-2 bg-gray-700">
                {filteredTags.length > 0 ? (
                  filteredTags.map(tag => (
                    <label key={tag} className="flex items-center text-sm">
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
                        className="mr-2 rounded border-gray-600 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-gray-300">{tag}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm italic">
                    {selectedCategory ? 'No tags found' : 'Select a category to see tags'}
                  </p>
                )}
              </div>
            </div>

            {/* Target Type Filter */}
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-gradient-to-b from-cyan-400 to-cyan-600"></div>
                <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">Target Type</h3>
              </div>
              <div className="space-y-2">
                {['web', 'api', 'mobile', 'network', 'other'].map(type => (
                  <label key={type} className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-gray-600 hover:border-indigo-500/50 hover:bg-gray-700 cursor-pointer transition-colors">
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
                      className="h-3 w-3 text-indigo-500 border-gray-600 rounded focus:ring-indigo-500 focus:ring-offset-0 bg-gray-700"
                    />
                    <span className="text-xs text-gray-300 font-medium capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Favorites Filter */}
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-gradient-to-b from-yellow-400 to-yellow-600"></div>
                <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">Options</h3>
              </div>
              <label className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-gray-600 hover:border-indigo-500/50 hover:bg-gray-700 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={favoritesOnly}
                  onChange={(e) => setFavoritesOnly(e.target.checked)}
                  className="h-3 w-3 text-indigo-500 border-gray-600 rounded focus:ring-indigo-500 focus:ring-offset-0 bg-gray-700"
                />
                <span className="text-xs text-gray-300 font-medium">Show favorites only</span>
              </label>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="p-4 lg:p-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 lg:mb-8 gap-4">
              <div className="flex items-center space-x-4">
                {/* Mobile Menu Button */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
                  title="Toggle filters"
                >
                  <Filter className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-100 mb-1 lg:mb-2">Payload Arsenal</h1>
                  <p className="text-sm lg:text-base text-gray-400">Manage your bug bounty payloads with smart filtering and quick access</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 lg:space-x-3">
                <button
                  onClick={handleCopyAllPayloads}
                  className="inline-flex items-center px-3 py-2 lg:px-4 lg:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm lg:text-base"
                  title="Copy all filtered payloads"
                >
                  <Copy className="w-4 h-4 mr-1 lg:mr-2" />
                  <span className="hidden sm:inline">Copy All</span>
                  <span className="sm:hidden">Copy</span>
                </button>
                <Link
                  to="/payloads/create"
                  className="inline-flex items-center px-3 py-2 lg:px-4 lg:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm lg:text-base"
                >
                  <Plus className="w-4 h-4 mr-1 lg:mr-2" />
                  <span className="hidden sm:inline">New Payload</span>
                  <span className="sm:hidden">New</span>
                </Link>
              </div>
            </div>

            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
                <div className="bg-gray-800 rounded-lg p-4 lg:p-6 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Total Payloads</p>
                      <p className="text-xl lg:text-2xl font-bold text-gray-100">{stats.total_payloads}</p>
                    </div>
                    <Target className="w-6 h-6 lg:w-8 lg:h-8 text-indigo-500" />
                  </div>
                </div>
            
                <div className="bg-gray-800 rounded-lg p-4 lg:p-6 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Favorites</p>
                      <p className="text-xl lg:text-2xl font-bold text-gray-100">{stats.favorite_payloads}</p>
                    </div>
                    <Star className="w-6 h-6 lg:w-8 lg:h-8 text-yellow-500" />
                  </div>
                </div>
            
                <div className="bg-gray-800 rounded-lg p-4 lg:p-6 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Critical/High</p>
                      <p className="text-xl lg:text-2xl font-bold text-gray-100">{stats.critical_payloads + stats.high_payloads}</p>
                    </div>
                    <AlertTriangle className="w-6 h-6 lg:w-8 lg:h-8 text-red-500" />
                  </div>
                </div>
            
                <div className="bg-gray-800 rounded-lg p-4 lg:p-6 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Most Used</p>
                      <p className="text-xl lg:text-2xl font-bold text-gray-100">{stats.max_usage_count}</p>
                    </div>
                    <TrendingUp className="w-6 h-6 lg:w-8 lg:h-8 text-green-500" />
                  </div>
                </div>
              </div>
            )}

            {/* Results Counter */}
            <div className="mb-4 lg:mb-6 flex items-center justify-between">
              <p className="text-gray-400 text-sm lg:text-base">
                {payloads.length} payload{payloads.length !== 1 ? 's' : ''} found
              </p>
            </div>

            {/* Sort Options */}
            <div className="mb-4 lg:mb-6 flex justify-end">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 lg:px-4 lg:py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm lg:text-base"
                >
                  <option value="created_at">Date Created</option>
                  <option value="updated_at">Last Updated</option>
                  <option value="usage_count">Usage Count</option>
                  <option value="title">Title</option>
                </select>
                
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="px-3 py-2 lg:px-4 lg:py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm lg:text-base"
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
            </div>

            {/* Payloads List */}
            <div className="space-y-4">
              {payloads.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-100 mb-2">No payloads found</h3>
                  <p className="text-gray-400 mb-6">Start building your payload arsenal by creating your first payload</p>
                  <Link
                    to="/payloads?action=create"
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Payload
                  </Link>
                </div>
              ) : (
                payloads.map((payload) => (
                  <div key={payload.id} className="bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          {/* Clickable Payload */}
                          <div 
                            onClick={() => handleCopyPayload(payload.payload)}
                            className="cursor-pointer"
                            title="Click to copy payload"
                          >
                            <div className="bg-gray-900 rounded-lg p-3 font-mono text-sm text-gray-300 hover:bg-gray-850 transition-colors">
                              <code className="break-all">{payload.payload}</code>
                            </div>
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center space-x-1 ml-4">
                          <button
                            onClick={() => handleToggleFavorite(payload)}
                            className={`p-2 rounded-lg transition-colors ${
                              payload.is_favorite ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'
                            }`}
                            title={payload.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <Star className={`w-4 h-4 ${payload.is_favorite ? 'fill-current' : ''}`} />
                          </button>
                          <Link
                            to={`/payloads/${payload.id}`}
                            className="p-2 text-gray-400 hover:text-blue-400 rounded-lg hover:bg-gray-700 transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(payload.id)}
                            className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-700 transition-colors"
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
