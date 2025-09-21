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
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-700 border-t-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Folder className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              {type === 'resources' ? 'Resource' : 'Learning'} Categories
            </h2>
            <p className="text-sm text-slate-400">Organize and filter your content</p>
          </div>
        </div>
        {activeFiltersCount > 0 && (
          <button
            onClick={onClearAll}
            className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 hover:border-slate-600 transition-all duration-200 text-sm text-indigo-400 hover:text-indigo-300 font-medium"
          >
            <X className="w-3 h-3" />
            <span>Clear all ({activeFiltersCount})</span>
          </button>
        )}
      </div>

      {/* Categories Section */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <div className="w-1 h-4 rounded-full bg-gradient-to-b from-indigo-400 to-indigo-600"></div>
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Categories</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {categories.map((category) => (
            <div
              key={category.id}
              className={`group relative p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                selectedCategories.includes(category.id)
                  ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/20'
                  : 'border-slate-600 hover:border-slate-500 bg-slate-800/50 hover:bg-slate-800'
              }`}
              onClick={() => onCategoryToggle(category.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-3 h-3 rounded-full shadow-sm"
                    style={{ backgroundColor: category.color || '#64748B' }}
                  ></div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-100 group-hover:text-indigo-300 transition-colors">
                      {category.name}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {getSubcategoriesForCategory(category.id).length} subcategories
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {selectedCategories.includes(category.id) && (
                    <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
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
              <div className="flex items-center space-x-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: category.color || '#64748B' }}
                ></div>
                <h3 className="text-sm font-semibold text-slate-200">
                  {category.name}
                </h3>
                <div className="flex-1"></div>
                <button
                  onClick={() => toggleCategoryExpansion(category.id)}
                  className="p-1 hover:bg-slate-700 rounded transition-colors"
                >
                  {expandedCategories.has(category.id) ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>

              {expandedCategories.has(category.id) && (
                <div className="ml-4 space-y-4">
                  {/* Category-level Tags */}
                  {categoryLevelTags.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide flex items-center space-x-2">
                        <Hash className="w-3 h-3" />
                        <span>Category Tags</span>
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {categoryLevelTags.map((tag: string) => (
                          <div
                            key={tag}
                            className={`group relative px-3 py-2 rounded-lg border transition-all duration-200 cursor-pointer ${
                              selectedTags.includes(tag)
                                ? 'border-indigo-500 bg-indigo-500/10 shadow-md shadow-indigo-500/20'
                                : 'border-slate-600/50 hover:border-slate-500 bg-slate-800/30 hover:bg-slate-800/50'
                            }`}
                            onClick={() => onTagToggle(tag)}
                          >
                            <div className="flex items-center space-x-2">
                              <TagIcon className="w-3 h-3 text-slate-400" />
                              <span className="text-xs font-medium text-slate-300 group-hover:text-indigo-300 transition-colors">
                                {tag}
                              </span>
                              {selectedTags.includes(tag) && (
                                <Check className="w-3 h-3 text-indigo-500" />
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
                      <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide flex items-center space-x-2">
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
                                  ? 'border-emerald-500 bg-emerald-500/10 shadow-md shadow-emerald-500/20'
                                  : 'border-slate-600/50 hover:border-slate-500 bg-slate-800/30 hover:bg-slate-800/50'
                              }`}
                              onClick={() => onSubcategoryToggle(subcategory.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: subcategory.color || category.color || '#10B981' }}
                                  ></div>
                                  <span className="text-xs font-medium text-slate-300 group-hover:text-emerald-300 transition-colors">
                                    {subcategory.name}
                                  </span>
                                  {subcategoryTags.has(subcategory.id) && (
                                    <span className="text-xs text-slate-500">
                                      ({subcategoryTags.get(subcategory.id)?.length} tags)
                                    </span>
                                  )}
                                </div>
                                {selectedSubcategories.includes(subcategory.id) && (
                                  <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                                    <Check className="w-2.5 h-2.5 text-white" />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Subcategory Tags */}
                            {subcategoryTags.has(subcategory.id) && (
                              <div className="ml-4 pl-4 border-l border-slate-600/30">
                                <div className="flex flex-wrap gap-1">
                                  {subcategoryTags.get(subcategory.id)?.map((tag: string) => (
                                    <div
                                      key={`${subcategory.id}-${tag}`}
                                      className={`group relative px-2 py-1 rounded-md border transition-all duration-200 cursor-pointer text-xs ${
                                        selectedTags.includes(tag)
                                          ? 'border-indigo-400 bg-indigo-400/10 shadow-sm shadow-indigo-400/20'
                                          : 'border-slate-600/40 hover:border-slate-500 bg-slate-800/20 hover:bg-slate-800/40'
                                      }`}
                                      onClick={() => onTagToggle(tag)}
                                    >
                                      <div className="flex items-center space-x-1">
                                        <TagIcon className="w-2.5 h-2.5 text-slate-500" />
                                        <span className="text-slate-400 group-hover:text-indigo-400 transition-colors">
                                          {tag}
                                        </span>
                                        {selectedTags.includes(tag) && (
                                          <Check className="w-2.5 h-2.5 text-indigo-400" />
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
