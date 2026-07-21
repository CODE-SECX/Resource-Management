import { useState, useEffect } from 'react';
import { supabase, type Category, type Subcategory, type Tag } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Tag as TagIcon, 
  ChevronDown, 
  ChevronRight, 
  Check,
  X,
  Folder,
  FolderOpen,
  Hash
} from 'lucide-react';

interface TaxonomyManagerProps {
  type: 'resources' | 'learning';
  selectedCategories: string[];
  selectedSubcategories: string[];
  selectedTags: string[];
  onCategoryToggle: (categoryId: string) => void;
  onSubcategoryToggle: (subcategoryId: string) => void;
  onTagToggle: (tag: string) => void;
  onClearAll: () => void;
}

export function TaxonomyManager({
  type,
  selectedCategories,
  selectedSubcategories,
  selectedTags,
  onCategoryToggle,
  onSubcategoryToggle,
  onTagToggle,
  onClearAll
}: TaxonomyManagerProps) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [normalizedTags, setNormalizedTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchTaxonomyData();
  }, [user, type]);

  const fetchTaxonomyData = async () => {
    if (!user) return;
    try {
      // Fetch categories specific to the type (resources or learning)
      const categoryTable = type === 'resources' ? 'resource_categories' : 'learning_categories';
      
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select(`
          *,
          ${categoryTable}!inner(
            ${type === 'resources' ? 'resource_id' : 'learning_id'}
          )
        `)
        .eq('user_id', user.id)
        .order('name');

      if (categoriesError) throw categoriesError;

      // Remove duplicates
      const uniqueCategories = categoriesData?.reduce((acc, item) => {
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

      // Fetch subcategories
      const { data: subcategoriesData, error: subcategoriesError } = await supabase
        .from('subcategories')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (subcategoriesError) throw subcategoriesError;

      // Fetch normalized tags
      const { data: tagsData, error: tagsError } = await supabase
        .from('tags')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (tagsError) throw tagsError;

      setCategories(uniqueCategories);
      setSubcategories(subcategoriesData || []);
      setNormalizedTags(tagsData || []);
    } catch (error) {
      console.error('Error fetching taxonomy data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSubcategoriesForCategory = (categoryId: string) => {
    return subcategories.filter(sub => sub.category_id === categoryId);
  };

  const getCategoryById = (categoryId: string) => {
    return categories.find(cat => cat.id === categoryId);
  };


  const toggleCategoryExpansion = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const getGroupedSubcategoriesAndTags = () => {
    const grouped = new Map<string, { 
      category: Category; 
      subcategories: Subcategory[]; 
      categoryLevelTags: string[];
      subcategoryTags: Map<string, string[]>;
    }>();
    
    selectedCategories.forEach(categoryId => {
      const category = getCategoryById(categoryId);
      if (!category) return;

      const categorySubcategories = getSubcategoriesForCategory(categoryId);
      
      // Get category-level tags (tags directly associated with category, not subcategory)
      const categoryLevelTags = normalizedTags
        .filter(tag => 
          tag.category_id === categoryId && 
          !tag.subcategory_id
        )
        .map(tag => tag.name);

      // Get subcategory-level tags grouped by subcategory
      const subcategoryTags = new Map<string, string[]>();
      categorySubcategories.forEach(subcategory => {
        const tagsForSubcategory = normalizedTags
          .filter(tag => tag.subcategory_id === subcategory.id)
          .map(tag => tag.name);
        if (tagsForSubcategory.length > 0) {
          subcategoryTags.set(subcategory.id, tagsForSubcategory);
        }
      });

      grouped.set(categoryId, {
        category,
        subcategories: categorySubcategories,
        categoryLevelTags,
        subcategoryTags
      });
    });

    return grouped;
  };

  const activeFiltersCount = selectedCategories.length + selectedSubcategories.length + selectedTags.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="loading-spinner h-8 w-8"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
            <Folder className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground">
              {type === 'resources' ? 'Resource' : 'Learning'} Categories
            </h2>
            <p className="text-sm text-muted-foreground">Organize and filter your content</p>
          </div>
        </div>
        {activeFiltersCount > 0 && (
          <button
            onClick={onClearAll}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/70 border border-border transition-all duration-200 text-sm text-primary hover:text-primary/80 font-medium shrink-0"
          >
            <X className="w-3 h-3" />
            <span>Clear all ({activeFiltersCount})</span>
          </button>
        )}
      </div>

      {/* Categories Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-primary"></div>
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Categories</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {categories.map((category) => (
            <div
              key={category.id}
              className={`group relative p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                selectedCategories.includes(category.id)
                  ? 'border-primary bg-primary/10 shadow-card-hover'
                  : 'border-border hover:border-primary/40 bg-card hover:bg-accent/40'
              }`}
              onClick={() => onCategoryToggle(category.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-3 h-3 shrink-0 rounded-full shadow-sm"
                    style={{ backgroundColor: category.color || '#64748B' }}
                  ></div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                      {category.name}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {getSubcategoriesForCategory(category.id).length} subcategories
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedCategories.includes(category.id) && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subcategories and Tags - Only show when categories are selected */}
      {selectedCategories.length > 0 && (
        <div className="space-y-6">
          {Array.from(getGroupedSubcategoriesAndTags().values()).map(({ category, subcategories: categorySubcategories, categoryLevelTags, subcategoryTags }) => (
            <div key={category.id} className="space-y-4">
              {/* Category Header */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                <div
                  className="w-2 h-2 shrink-0 rounded-full"
                  style={{ backgroundColor: category.color || '#64748B' }}
                ></div>
                <h3 className="text-sm font-semibold text-foreground truncate">
                  {category.name}
                </h3>
                <div className="flex-1"></div>
                <button
                  onClick={() => toggleCategoryExpansion(category.id)}
                  aria-label={expandedCategories.has(category.id) ? `Collapse ${category.name}` : `Expand ${category.name}`}
                  className="p-1.5 hover:bg-accent rounded-md transition-colors duration-150 shrink-0"
                >
                  {expandedCategories.has(category.id) ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              </div>

              {expandedCategories.has(category.id) && (
                <div className="ml-4 space-y-4">
                  {/* Category-level Tags */}
                  {categoryLevelTags.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                        <Hash className="w-3 h-3" />
                        <span>Category Tags</span>
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {categoryLevelTags.map((tag: string) => (
                          <div
                            key={tag}
                            className={`group relative px-3 py-2 rounded-lg border transition-all duration-200 cursor-pointer ${
                              selectedTags.includes(tag)
                                ? 'border-primary bg-primary/10 shadow-sm'
                                : 'border-border hover:border-primary/40 bg-card hover:bg-accent/40'
                            }`}
                            onClick={() => onTagToggle(tag)}
                          >
                            <div className="flex items-center gap-2">
                              <TagIcon className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                                {tag}
                              </span>
                              {selectedTags.includes(tag) && (
                                <Check className="w-3 h-3 text-primary" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Subcategories */}
                  {categorySubcategories.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                        <FolderOpen className="w-3 h-3" />
                        <span>Subcategories</span>
                      </h4>
                      <div className="space-y-3">
                        {categorySubcategories.map((subcategory) => (
                          <div key={subcategory.id} className="space-y-2">
                            {/* Subcategory Header */}
                            <div
                              className={`group relative p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                                selectedSubcategories.includes(subcategory.id)
                                  ? 'border-success bg-success/10 shadow-sm'
                                  : 'border-border hover:border-success/40 bg-card hover:bg-accent/40'
                              }`}
                              onClick={() => onSubcategoryToggle(subcategory.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div
                                    className="w-2 h-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: subcategory.color || category.color || '#10B981' }}
                                  ></div>
                                  <span className="text-xs font-medium text-foreground group-hover:text-success transition-colors truncate">
                                    {subcategory.name}
                                  </span>
                                  {subcategoryTags.has(subcategory.id) && (
                                    <span className="text-xs text-muted-foreground shrink-0">
                                      ({subcategoryTags.get(subcategory.id)?.length} tags)
                                    </span>
                                  )}
                                </div>
                                {selectedSubcategories.includes(subcategory.id) && (
                                  <div className="w-4 h-4 shrink-0 rounded-full bg-success flex items-center justify-center">
                                    <Check className="w-2.5 h-2.5 text-success-foreground" />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Subcategory Tags */}
                            {subcategoryTags.has(subcategory.id) && (
                              <div className="ml-4 pl-4 border-l border-border">
                                <div className="flex flex-wrap gap-1">
                                  {subcategoryTags.get(subcategory.id)?.map((tag: string) => (
                                    <div
                                      key={`${subcategory.id}-${tag}`}
                                      className={`group relative px-2 py-1 rounded-md border transition-all duration-200 cursor-pointer text-xs ${
                                        selectedTags.includes(tag)
                                          ? 'border-primary bg-primary/10 shadow-sm'
                                          : 'border-border hover:border-primary/40 bg-card hover:bg-accent/40'
                                      }`}
                                      onClick={() => onTagToggle(tag)}
                                    >
                                      <div className="flex items-center gap-1">
                                        <TagIcon className="w-2.5 h-2.5 text-muted-foreground" />
                                        <span className="text-muted-foreground group-hover:text-primary transition-colors">
                                          {tag}
                                        </span>
                                        {selectedTags.includes(tag) && (
                                          <Check className="w-2.5 h-2.5 text-primary" />
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
