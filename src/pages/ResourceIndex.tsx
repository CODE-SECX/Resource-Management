import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import { supabase, type Resource, type Subcategory, getSubcategories } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, ExternalLink, X, Filter, Calendar, Tag as TagIcon, List, Grid } from 'lucide-react';
import { TaxonomyManager } from '../components/TaxonomyManager';
import { PageHeader } from '../components/ui/PageHeader';
import { Skeleton } from '../components/ui/Skeleton';

export function ResourceIndex() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'index'>('card');
  const [allSubcategories, setAllSubcategories] = useState<Subcategory[]>([]);

  useEffect(() => {
    fetchResources();
    fetchSubcategories();
  }, [user]);

  const fetchSubcategories = async () => {
    if (!user) return;
    try {
      const subcategories = await getSubcategories(user.id);
      setAllSubcategories(subcategories);
    } catch (error) {
      console.error('Error fetching subcategories:', error);
    }
  };

  const fetchResources = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('resources')
        .select(`
          *,
          resource_categories(
            category_id,
            categories(*)
          ),
          resource_subcategories(
            subcategory_id,
            subcategories(*)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const resourcesWithRelations = data?.map(resource => ({
        ...resource,
        categories: resource.resource_categories.map((rc: any) => rc.categories),
        taxonomySubcategories: resource.resource_subcategories.map((rs: any) => rs.subcategories),
      })) || [];

      setResources(resourcesWithRelations);
    } catch (error) {
      console.error('Error fetching resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredResources = resources.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategories.length === 0 || 
                          item.categories?.some(cat => selectedCategories.includes(cat.id));
    
    // Enhanced subcategory filtering: check both legacy and new taxonomy subcategories
    const matchesSubcategory = selectedSubcategories.length === 0 || (() => {
      // Check new taxonomy subcategories (preferred)
      const taxonomyMatch = item.taxonomySubcategories?.some((subcategory: any) => 
        selectedSubcategories.includes(subcategory.id)
      );
      
      // Fallback: check legacy subcategories by converting IDs to names
      const legacyMatch = item.subcategories?.some((subcategoryName: string) => {
        const selectedSubcategoryNames = selectedSubcategories.map(subId => {
          const subcategory = allSubcategories.find(sub => sub.id === subId);
          return subcategory?.name;
        }).filter(Boolean);
        
        return selectedSubcategoryNames.includes(subcategoryName);
      });
      
      return taxonomyMatch || legacyMatch;
    })();
    
    const matchesTags = selectedTags.length === 0 ||
                       selectedTags.some(tag => item.tags?.includes(tag));

    return matchesSearch && matchesCategory && matchesSubcategory && matchesTags;
  });

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedSubcategories([]);
    setSelectedTags([]);
    setSearchQuery('');
  };

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
  };

  const handleSubcategoryToggle = (subcategoryId: string) => {
    setSelectedSubcategories(prev => {
      if (prev.includes(subcategoryId)) {
        return prev.filter(id => id !== subcategoryId);
      } else {
        return [...prev, subcategoryId];
      }
    });
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  const activeFilterCount = selectedCategories.length + selectedSubcategories.length + selectedTags.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Filter Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed bottom-6 right-4 z-40 p-3 rounded-xl bg-card shadow-modal border border-border hover:bg-accent transition-colors duration-150"
        aria-label="Open filters"
      >
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-muted-foreground" />
          {activeFilterCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
              {activeFilterCount}
            </span>
          )}
        </div>
      </button>

      <div className="flex">
        {/* Sidebar */}
        <div className={`${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:sticky lg:top-0 inset-y-0 left-0 z-40 w-96 max-w-[85vw] h-screen lg:h-[calc(100vh-2rem)] bg-card/95 backdrop-blur-sm border-r border-border transform transition-transform duration-300 ease-in-out overflow-y-auto shadow-modal lg:shadow-none lg:mr-8`}>
          
          {/* Sidebar Header */}
          <div className="p-6 border-b border-border bg-muted/40 mt-10 lg:mt-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Filter className="w-4 h-4 text-primary-foreground" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Filters</h2>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="lg:hidden p-2.5 rounded-xl bg-secondary hover:bg-accent text-secondary-foreground hover:text-accent-foreground transition-all duration-200 border border-border"
                aria-label="Close filters"
              >
                <X className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <div className="p-6">
            <TaxonomyManager
              type="resources"
              selectedCategories={selectedCategories}
              selectedSubcategories={selectedSubcategories}
              selectedTags={selectedTags}
              onCategoryToggle={handleCategoryToggle}
              onSubcategoryToggle={handleSubcategoryToggle}
              onTagToggle={handleTagToggle}
              onClearAll={clearAllFilters}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 lg:ml-0 min-w-0">
          <div className="max-w-full px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <PageHeader
              title="Resources"
              subtitle="Discover and explore your curated resource library"
              actions={
                <div className="flex items-center gap-2 bg-card rounded-lg p-1 border border-border">
                  <button
                    onClick={() => setViewMode('card')}
                    className={`p-2 rounded-md transition-colors duration-150 min-w-[40px] min-h-[40px] flex items-center justify-center ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                    title="Card View"
                    aria-label="Card view"
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('index')}
                    className={`p-2 rounded-md transition-colors duration-150 min-w-[40px] min-h-[40px] flex items-center justify-center ${viewMode === 'index' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                    title="Index View"
                    aria-label="Index view"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              }
            />

            {/* Search Bar */}
            <div className="mb-8">
              <div className="relative max-w-4xl">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search resources by title or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 text-base sm:text-lg border border-input rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus:border-primary bg-card text-foreground placeholder:text-muted-foreground shadow-xs transition-all duration-200"
                />
              </div>
            </div>

            {/* Results Counter */}
            <div className="mb-6 flex items-center justify-between">
              <p className="text-muted-foreground">
                {filteredResources.length} resource{filteredResources.length !== 1 ? 's' : ''} found
              </p>
            </div>

            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="rounded-xl border border-border bg-card p-6 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <Skeleton className="h-5 w-1/2" />
                      <Skeleton className="h-4 w-4" rounded="sm" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-16" rounded="full" />
                      <Skeleton className="h-6 w-20" rounded="full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Resources List */}
                {viewMode === 'card' ? (
                  <div className="space-y-4">
                    {filteredResources.map((item) => (
                      <Link
                        key={item.id}
                        to={`/resources/${item.id}`}
                        className="group block bg-card rounded-xl border border-border hover:border-primary/30 hover:shadow-card-hover transition-all duration-200 cursor-pointer"
                      >
                        <div className="p-4 sm:p-6">
                          <div className="flex items-start gap-4 sm:gap-6">
                            {/* Main Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-3 gap-4">
                                <h3 className="text-lg font-medium text-foreground group-hover:text-primary transition-colors duration-150 leading-snug">
                                  {item.title}
                                </h3>
                                <div className="flex items-center gap-3 shrink-0">
                                  {item.url && (
                                    <div className="flex items-center text-primary group-hover:text-primary/80 transition-colors duration-150">
                                      <ExternalLink className="w-4 h-4" />
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Description */}
                              {item.description && (
                                <p className="text-muted-foreground text-base mb-4 leading-relaxed">
                                  {item.description.replace(/<[^>]*>/g, '').substring(0, 200)}
                                  {item.description.length > 200 && '...'}
                                </p>
                              )}

                              {/* Categories, Subcategories and Tags Row */}
                              <div className="flex items-center flex-wrap gap-3 mb-4">
                                {/* Categories */}
                                {item.categories && item.categories.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {item.categories.slice(0, 3).map((category) => (
                                      <span
                                        key={category.id}
                                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white rounded-lg shadow-xs"
                                        style={{ backgroundColor: category.color || '#64748B' }}
                                      >
                                        {category.name}
                                      </span>
                                    ))}
                                    {item.categories.length > 3 && (
                                      <span className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-muted-foreground bg-secondary rounded-lg">
                                        +{item.categories.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Subcategories */}
                                {item.taxonomySubcategories && item.taxonomySubcategories.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {item.taxonomySubcategories.slice(0, 3).map((subcategory) => (
                                      <span
                                        key={subcategory.id}
                                        className="inline-flex items-center px-2 py-1 text-xs text-success bg-success/10 rounded-md border border-success/30"
                                      >
                                        {subcategory.name}
                                      </span>
                                    ))}
                                    {item.taxonomySubcategories.length > 3 && (
                                      <span className="text-xs text-muted-foreground px-2 py-1">
                                        +{item.taxonomySubcategories.length - 3} more subcategories
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
                                        className="inline-flex items-center px-2 py-1 text-xs text-muted-foreground bg-secondary/60 rounded-md border border-border/60"
                                      >
                                        <TagIcon className="w-3 h-3 mr-1" />
                                        {tag}
                                      </span>
                                    ))}
                                    {item.tags.length > 4 && (
                                      <span className="text-xs text-muted-foreground px-2 py-1">
                                        +{item.tags.length - 4} more tags
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Footer Info */}
                              <div className="flex items-center text-sm text-muted-foreground">
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
                      </Link>
                    ))}
                  </div>
                ) : (
                  /* Index View */
                  <div className="bg-card rounded-xl border border-border overflow-hidden">
                    <div className="divide-y divide-border">
                      {filteredResources.map((item) => (
                        <Link
                          key={item.id}
                          to={`/resources/${item.id}`}
                          className="group block px-4 sm:px-6 py-4 hover:bg-accent/50 transition-colors duration-150"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center min-w-0">
                              <div className="text-sm font-normal text-foreground group-hover:text-primary transition-colors duration-150 truncate">
                                {item.title}
                              </div>
                              {item.url && (
                                <ExternalLink className="ml-2 w-4 h-4 text-primary flex-shrink-0" />
                              )}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {filteredResources.length === 0 && (
                  <div className="text-center py-16">
                    <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6 border border-border">
                      <Search className="w-12 h-12 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">No resources found</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      {searchQuery || activeFilterCount > 0
                        ? "Try adjusting your search query or filters to find more resources."
                        : "Start by adding some resources to see them here."}
                    </p>
                    {(searchQuery || activeFilterCount > 0) && (
                      <button
                        onClick={clearAllFilters}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors duration-150"
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>
                )}
              </>
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
