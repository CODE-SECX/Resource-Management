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
  deletePayload
} from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Search, 
  Filter, 
  Plus, 
  Star, 
  Copy, 
  Trash2, 
  Edit3, 
  Target, 
  Shield, 
  Zap, 
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Tag,
  Folder,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

const severityColors = {
  critical: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-blue-500 text-white',
  info: 'bg-gray-500 text-white'
};

const severityIcons = {
  critical: AlertTriangle,
  high: Shield,
  medium: Target,
  low: CheckCircle,
  info: Clock
};

const targetTypeIcons = {
  web: Target,
  api: Zap,
  mobile: Shield,
  network: TrendingUp,
  other: Folder
};

export function Payloads() {
  const { user } = useAuth();
  const [payloads, setPayloads] = useState<Payload[]>([]);
  const [stats, setStats] = useState<PayloadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPayload, setSelectedPayload] = useState<string | null>(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedSeverity, setSelectedSeverity] = useState<string[]>([]);
  const [selectedTargetType, setSelectedTargetType] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'created_at' | 'updated_at' | 'usage_count' | 'title' | 'severity'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Available options
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      fetchPayloads();
      fetchStats();
      fetchFilterOptions();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchPayloads();
    }
  }, [
    searchTerm, selectedCategory, selectedSubcategories, selectedTags, 
    selectedSeverity, selectedTargetType, favoritesOnly, sortBy, sortOrder
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
        severity: selectedSeverity.length > 0 ? selectedSeverity : undefined,
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
      setSubcategories(subs);
      setTags(ts);
    } catch (error) {
      console.error('Error fetching filter options:', error);
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

  const handleToggleFavorite = async (payload: Payload) => {
    try {
      const updated = await supabase
        .from('payloads')
        .update({ is_favorite: !payload.is_favorite })
        .eq('id', payload.id)
        .select()
        .single();

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
    setSelectedSeverity([]);
    setSelectedTargetType([]);
    setFavoritesOnly(false);
  };

  const getSeverityIcon = (severity: string) => {
    const Icon = severityIcons[severity as keyof typeof severityIcons] || AlertTriangle;
    return <Icon className="w-4 h-4" />;
  };

  const getTargetTypeIcon = (targetType: string) => {
    const Icon = targetTypeIcons[targetType as keyof typeof targetTypeIcons] || Target;
    return <Icon className="w-4 h-4" />;
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
      <div className="container mx-auto px-4 py-8 max-w-full sm:max-w-full md:max-w-full lg:max-w-7xl xl:max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-100 mb-2">Payload Arsenal</h1>
            <p className="text-gray-400">Manage your bug bounty payloads with smart filtering and quick access</p>
          </div>
          <Link
            to="/payloads/create"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Payload
          </Link>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Payloads</p>
                  <p className="text-2xl font-bold text-gray-100">{stats.total_payloads}</p>
                </div>
                <Target className="w-8 h-8 text-indigo-500" />
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Favorites</p>
                  <p className="text-2xl font-bold text-gray-100">{stats.favorite_payloads}</p>
                </div>
                <Star className="w-8 h-8 text-yellow-500" />
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Critical/High</p>
                  <p className="text-2xl font-bold text-gray-100">{stats.critical_payloads + stats.high_payloads}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Most Used</p>
                  <p className="text-2xl font-bold text-gray-100">{stats.max_usage_count}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 mb-6">
          <div className="p-4">
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search payloads, descriptions, tags..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {(selectedCategory || selectedSubcategories.length > 0 || selectedTags.length > 0 || 
                  selectedSeverity.length > 0 || selectedTargetType.length > 0 || favoritesOnly) && (
                  <span className="ml-2 px-2 py-1 bg-indigo-600 text-white text-xs rounded-full">
                    {[
                      selectedCategory && 1,
                      selectedSubcategories.length,
                      selectedTags.length,
                      selectedSeverity.length,
                      selectedTargetType.length,
                      favoritesOnly && 1
                    ].filter(Boolean).reduce((a, b) => a + b, 0)}
                  </span>
                )}
              </button>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="created_at">Date Created</option>
                <option value="updated_at">Last Updated</option>
                <option value="usage_count">Usage Count</option>
                <option value="title">Title</option>
                <option value="severity">Severity</option>
              </select>
              
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="border-t border-gray-700 pt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">All Categories</option>
                      {categories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Severity</label>
                    <div className="space-y-2">
                      {['critical', 'high', 'medium', 'low', 'info'].map(severity => (
                        <label key={severity} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedSeverity.includes(severity)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSeverity([...selectedSeverity, severity]);
                              } else {
                                setSelectedSeverity(selectedSeverity.filter(s => s !== severity));
                              }
                            }}
                            className="mr-2 rounded border-gray-600 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-gray-300 capitalize">{severity}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Target Type</label>
                    <div className="space-y-2">
                      {['web', 'api', 'mobile', 'network', 'other'].map(type => (
                        <label key={type} className="flex items-center">
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
                            className="mr-2 rounded border-gray-600 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-gray-300 capitalize">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={favoritesOnly}
                      onChange={(e) => setFavoritesOnly(e.target.checked)}
                      className="mr-2 rounded border-gray-600 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-gray-300">Show favorites only</span>
                  </label>
                  
                  <button
                    onClick={clearFilters}
                    className="flex items-center px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Clear Filters
                  </button>
                </div>
              </div>
            )}
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
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-100">{payload.title}</h3>
                        <button
                          onClick={() => handleToggleFavorite(payload)}
                          className={`p-1 rounded-full transition-colors ${
                            payload.is_favorite ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'
                          }`}
                        >
                          <Star className={`w-4 h-4 ${payload.is_favorite ? 'fill-current' : ''}`} />
                        </button>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${severityColors[payload.severity]}`}>
                          {getSeverityIcon(payload.severity)}
                          <span className="ml-1 capitalize">{payload.severity}</span>
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
                          {getTargetTypeIcon(payload.target_type)}
                          <span className="ml-1 capitalize">{payload.target_type}</span>
                        </span>
                      </div>
                      
                      <p className="text-gray-400 text-sm mb-3">{payload.description}</p>
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span className="flex items-center">
                          <Folder className="w-3 h-3 mr-1" />
                          {payload.category}
                        </span>
                        {payload.subcategories.length > 0 && (
                          <span className="flex items-center">
                            <Tag className="w-3 h-3 mr-1" />
                            {payload.subcategories.slice(0, 2).join(', ')}
                            {payload.subcategories.length > 2 && ` +${payload.subcategories.length - 2}`}
                          </span>
                        )}
                        <span className="flex items-center">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Used {payload.usage_count} times
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleCopyPayload(payload.payload)}
                        className="p-2 text-gray-400 hover:text-green-400 rounded-lg hover:bg-gray-700 transition-colors"
                        title="Copy payload"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <Link
                        to={`/payloads/${payload.id}`}
                        className="p-2 text-gray-400 hover:text-blue-400 rounded-lg hover:bg-gray-700 transition-colors"
                        title="View details"
                      >
                        <Edit3 className="w-4 h-4" />
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
                  
                  {/* Payload Preview */}
                  <div className="bg-gray-900 rounded-lg p-3 font-mono text-sm text-gray-300 overflow-x-auto">
                    <code>{payload.payload.substring(0, 150)}{payload.payload.length > 150 ? '...' : ''}</code>
                  </div>
                  
                  {/* Tags */}
                  {payload.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {payload.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-300"
                        >
                          <Tag className="w-2 h-2 mr-1" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
