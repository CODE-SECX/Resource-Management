import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, type Learning, type Category } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, GraduationCap, X, ExternalLink, Calendar, Tag, Filter, List, Grid } from 'lucide-react';

const difficultyLevels = ['All', 'Beginner', 'Intermediate', 'Advanced', 'Expert'] as const;

export function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [learning, setLearning] = useState<Learning[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'index'>('card');
  
  // Get all tags from learning items
  const allTags = Array.from(new Set(learning.flatMap(item => item.tags || [])));
  
  // Get filtered tags based on selected categories
  const filteredTags = selectedCategories.length === 0 
    ? allTags
    : Array.from(new Set(
        learning
          .filter(item => 
            selectedCategories.length === 0 || 
            item.categories?.some(cat => selectedCategories.includes(cat.id))
          )
          .flatMap(item => item.tags || [])
      ));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchLearning();
    fetchCategories();
  }, [user]);

  const fetchLearning = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('learning')
        .select(`
          *,
          learning_categories(
            category_id,
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
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    if (!user) return;

    try {
      // Fetch only categories that have learning items
      const { data, error } = await supabase
        .from('categories')
        .select(`
          *,
          learning_categories!inner(
            learning_id
          )
        `)
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      
      // Remove duplicates and format data
      const uniqueCategories = data?.reduce((acc, item) => {
        if (!acc.find((existingCat: Category) => existingCat.id === item.id)) {
          acc.push({
            id: item.id,
            name: item.name,
            color: item.color,
            user_id: item.user_id,
            created_at: item.created_at
          });
        }
        return acc;
      }, [] as Category[]) || [];
      
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const filteredLearning = learning.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategories.length === 0 || 
                          item.categories?.some(cat => selectedCategories.includes(cat.id));
    const matchesDifficulty = selectedDifficulties.length === 0 || 
                             selectedDifficulties.includes(item.difficulty_level);
    const matchesTags = selectedTags.length === 0 ||
                       selectedTags.some(tag => item.tags?.includes(tag));

    return matchesSearch && matchesCategory && matchesDifficulty && matchesTags;
  });

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'Beginner': return 'bg-emerald-900/30 text-emerald-300 border-emerald-700/50';
      case 'Intermediate': return 'bg-blue-900/30 text-blue-300 border-blue-700/50';
      case 'Advanced': return 'bg-amber-900/30 text-amber-300 border-amber-700/50';
      case 'Expert': return 'bg-red-900/30 text-red-300 border-red-700/50';
      default: return 'bg-slate-800/50 text-slate-300 border-slate-600/50';
    }
  };

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedDifficulties([]);
    setSelectedTags([]);
    setSearchQuery('');
  };

  const activeFiltersCount = selectedCategories.length + selectedDifficulties.length + selectedTags.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-slate-900">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-indigo-500"></div>
          <p className="text-slate-400 font-medium">Loading your learning resources...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Mobile Filter Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed bottom-6 right-4 z-40 p-3 rounded-xl bg-slate-800 shadow-xl border border-slate-700 hover:bg-slate-700 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-slate-300" />
          {activeFiltersCount > 0 && (
            <span className="bg-indigo-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
              {activeFiltersCount}
            </span>
          )}
        </div>
      </button>

      <div className="flex">
        {/* Sidebar */}
        <div className={`${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:sticky lg:top-0 inset-y-0 left-0 z-40 w-96 h-screen lg:h-[calc(100vh-2rem)] bg-slate-800/95 backdrop-blur-sm border-r border-slate-700/50 transform transition-transform duration-300 ease-in-out overflow-y-auto shadow-xl lg:shadow-2xl lg:mr-8`}>
          
          {/* Sidebar Header */}
          <div className="p-6 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/50 to-slate-750/50 mt-10 lg:mt-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Filter className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">Filters</h2>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="lg:hidden p-2.5 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-slate-200 hover:text-white transition-all duration-200 shadow-lg hover:shadow-xl border border-slate-600 hover:border-slate-500 relative z-50"
                aria-label="Close filters"
              >
                <X className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>
            {activeFiltersCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 hover:border-slate-600 transition-all duration-200 text-sm text-indigo-400 hover:text-indigo-300 font-medium"
              >
                <X className="w-3 h-3" />
                <span>Clear all filters ({activeFiltersCount})</span>
              </button>
            )}
          </div>

          <div className="p-6 space-y-8">
            {/* Categories Filter */}
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-1 h-4 rounded-full bg-gradient-to-b from-indigo-400 to-indigo-600"></div>
                <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Categories</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <label key={category.id} className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-slate-600 hover:border-indigo-500/50 hover:bg-slate-700 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCategories(prev => [...prev, category.id]);
                        } else {
                          setSelectedCategories(prev => prev.filter(id => id !== category.id));
                        }
                      }}
                      className="h-3 w-3 text-indigo-500 border-slate-600 rounded focus:ring-indigo-500 focus:ring-offset-0 bg-slate-700"
                    />
                    <div className="flex items-center space-x-1.5">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: category.color || '#64748B' }}
                      ></div>
                      <span className="text-xs text-slate-300 font-medium">
                        {category.name}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Difficulty Filter */}
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-1 h-4 rounded-full bg-gradient-to-b from-purple-400 to-purple-600"></div>
                <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Difficulty Level</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {difficultyLevels.slice(1).map((level) => (
                  <label key={level} className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-slate-600 hover:border-indigo-500/50 hover:bg-slate-700 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedDifficulties.includes(level)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDifficulties(prev => [...prev, level]);
                        } else {
                          setSelectedDifficulties(prev => prev.filter(l => l !== level));
                        }
                      }}
                      className="h-3 w-3 text-indigo-500 border-slate-600 rounded focus:ring-indigo-500 focus:ring-offset-0 bg-slate-700"
                    />
                    <span className={`text-xs px-2 py-1 rounded-md border font-medium ${getDifficultyColor(level)}`}>
                      {level}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Tags Filter */}
            {filteredTags.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-1 h-4 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600"></div>
                  <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Tags</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {filteredTags.map((tag) => (
                    <label key={tag} className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-slate-600 hover:border-indigo-500/50 hover:bg-slate-700 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedTags.includes(tag)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTags(prev => [...prev, tag]);
                          } else {
                            setSelectedTags(prev => prev.filter(t => t !== tag));
                          }
                        }}
                        className="h-3 w-3 text-indigo-500 border-slate-600 rounded focus:ring-indigo-500 focus:ring-offset-0 bg-slate-700"
                      />
                      <span className="text-xs text-slate-300 font-medium flex items-center">
                        <Tag className="w-2.5 h-2.5 mr-1" />
                        {tag}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 lg:ml-0 min-w-0">
          <div className="max-w-full px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-4xl font-bold text-slate-100 mb-2">Learning Resources</h1>
                  <p className="text-lg text-slate-400">
                    Discover and explore your curated learning materials
                  </p>
                </div>
                {/* View Toggle */}
                <div className="flex items-center space-x-2 bg-slate-800 rounded-lg p-1 border border-slate-700">
                  <button
                    onClick={() => setViewMode('card')}
                    className={`p-2 rounded-md transition-colors ${viewMode === 'card' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    title="Card View"
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('index')}
                    className={`p-2 rounded-md transition-colors ${viewMode === 'index' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    title="Index View"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="mb-8">
              <div className="relative max-w-4xl">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search resources by title or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 text-lg border border-slate-600 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-800 text-slate-100 placeholder-slate-500 shadow-lg"
                />
              </div>
            </div>

            {/* Results Counter */}
            <div className="mb-6 flex items-center justify-between">
              <p className="text-slate-400">
                {filteredLearning.length} resource{filteredLearning.length !== 1 ? 's' : ''} found
              </p>
            </div>

            {/* Learning Resources List */}
            {viewMode === 'card' ? (
              <div className="space-y-4">
                {filteredLearning.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/learning/${item.id}`)}
                    className="group bg-slate-800 rounded-xl border border-slate-700 hover:border-indigo-500/50 hover:bg-slate-750 transition-all duration-200 cursor-pointer"
                  >
                    <div className="p-6">
                      <div className="flex items-start gap-6">
                        {/* Main Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-3">
                            <h3 className="text-lg font-medium text-slate-100 group-hover:text-indigo-400 transition-colors leading-snug">
                              {item.title}
                            </h3>
                            <div className="flex items-center gap-3 ml-4 shrink-0">
                              <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border ${getDifficultyColor(item.difficulty_level)}`}>
                                <GraduationCap className="w-4 h-4 mr-1.5" />
                                {item.difficulty_level}
                              </span>
                              {item.url && (
                                <div className="flex items-center text-indigo-400 group-hover:text-indigo-300 transition-colors">
                                  <ExternalLink className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Description */}
                          {item.description && (
                            <p className="text-slate-300 text-base mb-4 leading-relaxed">
                              {item.description.replace(/<[^>]*>/g, '').substring(0, 200)}
                              {item.description.length > 200 && '...'}
                            </p>
                          )}

                          {/* Categories and Tags Row */}
                          <div className="flex items-center flex-wrap gap-3 mb-4">
                            {/* Categories */}
                            {item.categories && item.categories.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {item.categories.slice(0, 3).map((category) => (
                                  <span
                                    key={category.id}
                                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white rounded-lg shadow-sm"
                                    style={{ backgroundColor: category.color || '#64748B' }}
                                  >
                                    {category.name}
                                  </span>
                                ))}
                                {item.categories.length > 3 && (
                                  <span className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-slate-400 bg-slate-700 rounded-lg">
                                    +{item.categories.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Tags */}
                            {item.tags && item.tags.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {item.tags.slice(0, 4).map((tag) => (
                                  <span
                                    key={tag}
                                    className="inline-flex items-center px-2 py-1 text-xs text-slate-300 bg-slate-700/60 rounded-md border border-slate-600/50"
                                  >
                                    <Tag className="w-3 h-3 mr-1" />
                                    {tag}
                                  </span>
                                ))}
                                {item.tags.length > 4 && (
                                  <span className="text-xs text-slate-500 px-2 py-1">
                                    +{item.tags.length - 4} more tags
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Footer Info */}
                          <div className="flex items-center text-sm text-slate-500">
                            <Calendar className="w-4 h-4 mr-2" />
                            Added on {new Date(item.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Index View */
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="divide-y divide-slate-700">
                  {filteredLearning.map((item) => (
                    <div 
                      key={item.id} 
                      className="px-6 py-4 hover:bg-slate-750 cursor-pointer transition-colors"
                      onClick={() => navigate(`/learning/${item.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="text-sm font-normal text-slate-100 group-hover:text-indigo-400 transition-colors">
                            {item.title}
                          </div>
                          {item.url && (
                            <ExternalLink className="ml-2 w-4 h-4 text-indigo-400 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {filteredLearning.length === 0 && (
              <div className="text-center py-16">
                <div className="mx-auto w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6 border border-slate-700">
                  <GraduationCap className="w-12 h-12 text-slate-500" />
                </div>
                <h3 className="text-xl font-semibold text-slate-100 mb-2">No resources found</h3>
                <p className="text-slate-400 mb-6 max-w-md mx-auto">
                  {searchQuery || activeFiltersCount > 0
                    ? "Try adjusting your search query or filters to find more resources."
                    : "Start by adding some learning resources to see them here."}
                </p>
                {(searchQuery || activeFiltersCount > 0) && (
                  <button
                    onClick={clearAllFilters}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}