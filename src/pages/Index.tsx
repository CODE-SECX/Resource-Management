import { useState, useEffect } from 'react';
import { supabase, type Learning, type Category } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, GraduationCap, X, ExternalLink, Calendar, Tag, Filter } from 'lucide-react';
import { Modal } from '../components/Modal';

const difficultyLevels = ['All', 'Beginner', 'Intermediate', 'Advanced', 'Expert'] as const;

export function Index() {
  const { user } = useAuth();
  const [learning, setLearning] = useState<Learning[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const allTags = Array.from(new Set(learning.flatMap(item => item.tags || [])));
  const [selectedItem, setSelectedItem] = useState<Learning | null>(null);
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
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
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
        } lg:translate-x-0 fixed lg:relative inset-y-0 left-0 z-40 w-80 bg-slate-800 border-r border-slate-700 transform transition-transform duration-300 ease-in-out overflow-y-auto`}>
          
          {/* Sidebar Header */}
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-100">Filters</h2>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="lg:hidden p-2 rounded-lg hover:bg-slate-700 text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {activeFiltersCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="mt-3 text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                Clear all filters ({activeFiltersCount})
              </button>
            )}
          </div>

          <div className="p-6 space-y-8">
            {/* Categories Filter */}
            <div>
              <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide mb-4">Categories</h3>
              <div className="space-y-2">
                {categories.map((category) => (
                  <label key={category.id} className="flex items-center space-x-3 cursor-pointer group">
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
                      className="h-4 w-4 text-indigo-500 border-slate-600 rounded focus:ring-indigo-500 focus:ring-offset-0 bg-slate-700"
                    />
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full ring-1 ring-slate-600"
                        style={{ backgroundColor: category.color || '#64748B' }}
                      ></div>
                      <span className="text-sm text-slate-300 group-hover:text-slate-100 font-medium transition-colors">
                        {category.name}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Difficulty Filter */}
            <div>
              <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide mb-4">Difficulty Level</h3>
              <div className="space-y-2">
                {difficultyLevels.slice(1).map((level) => (
                  <label key={level} className="flex items-center space-x-3 cursor-pointer group">
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
                      className="h-4 w-4 text-indigo-500 border-slate-600 rounded focus:ring-indigo-500 focus:ring-offset-0 bg-slate-700"
                    />
                    <span className={`text-sm px-2 py-1 rounded-md border font-medium ${getDifficultyColor(level)}`}>
                      {level}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Tags Filter */}
            {allTags.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide mb-4">Tags</h3>
                <div className="space-y-2">
                  {allTags.map((tag) => (
                    <label key={tag} className="flex items-center space-x-3 cursor-pointer group">
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
                        className="h-4 w-4 text-indigo-500 border-slate-600 rounded focus:ring-indigo-500 focus:ring-offset-0 bg-slate-700"
                      />
                      <span className="text-sm text-slate-300 group-hover:text-slate-100 font-medium flex items-center transition-colors">
                        <Tag className="w-3 h-3 mr-1" />
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
        <div className="flex-1 lg:ml-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-slate-100 mb-2">Learning Resources</h1>
              <p className="text-lg text-slate-400">
                Discover and explore your curated learning materials
              </p>
            </div>

            {/* Search Bar */}
            <div className="mb-8">
              <div className="relative max-w-2xl">
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
            <div className="space-y-4">
              {filteredLearning.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="group bg-slate-800 rounded-xl border border-slate-700 hover:border-indigo-500/50 hover:bg-slate-750 transition-all duration-200 cursor-pointer"
                >
                  <div className="p-6">
                    <div className="flex items-start gap-6">
                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-xl font-semibold text-slate-100 group-hover:text-indigo-400 transition-colors leading-tight">
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

      {/* Item Detail Modal */}
      <Modal
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title=""
        size="xl"
      >
        {selectedItem && (
          <div className="space-y-6 bg-slate-800 text-slate-100 p-6 rounded-xl">
            <div>
              <h1 className="text-3xl font-bold text-slate-100 mb-4">{selectedItem.title}</h1>
              
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold border ${getDifficultyColor(selectedItem.difficulty_level)}`}>
                  <GraduationCap className="w-4 h-4 mr-2" />
                  {selectedItem.difficulty_level}
                </span>
                
                {selectedItem.categories?.map(cat => (
                  <span
                    key={cat.id}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white rounded-lg shadow-sm"
                    style={{ backgroundColor: cat.color }}
                  >
                    {cat.name}
                  </span>
                ))}
              </div>

              {selectedItem.tags && selectedItem.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {selectedItem.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-1 text-xs text-slate-300 bg-slate-700/50 rounded-md border border-slate-600/50"
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {selectedItem.description && (
              <div className="prose prose-invert prose-slate prose-lg max-w-none mx-auto prose-p:my-3 prose-p:leading-7 prose-li:my-1 prose-headings:mt-6 prose-headings:mb-2">
                <div dangerouslySetInnerHTML={{ __html: selectedItem.description }} />
              </div>
            )}

            {selectedItem.url && (
              <div className="pt-4 border-t border-slate-700">
                <a
                  href={selectedItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-xl shadow-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Visit External Resource
                </a>
              </div>
            )}

            <div className="pt-4 border-t border-slate-700 text-sm text-slate-400">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                Added on {new Date(selectedItem.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}