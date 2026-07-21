import React, { useState, useEffect, useRef } from 'react';
import {
  supabase,
  type Learning,
  type Category,
  getSubcategories,
  getTagsByCategory,
  upsertSubcategoriesByNames,
  upsertTagsByNames,
  upsertCategoryTagsByNames,
  setLearningSubcategories,
  setLearningTags,
} from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Filter, Edit2, Trash2, Tag, X, GraduationCap, Grid, LayoutList, BookOpen, ArrowUpRight, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { RichTextEditor } from '../components/RichTextEditor';
import { useNavigate, Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/Skeleton';

const difficultyLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'] as const;

export function Learning() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [learning, setLearning] = useState<Learning[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Learning | null>(null);
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
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    url: '',
    tags: '',
    difficulty_level: 'Beginner' as Learning['difficulty_level'],
    categoryIds: [] as string[],
  });
  const [selectedFormTags, setSelectedFormTags] = useState<string[]>([]);
  const [tagInputValue, setTagInputValue] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [filteredTagSuggestions, setFilteredTagSuggestions] = useState<string[]>([]);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const [selectedFormSubcategories, setSelectedFormSubcategories] = useState<string[]>([]);
  const [subcategoryInputValue, setSubcategoryInputValue] = useState('');
  const [showSubcategorySuggestions, setShowSubcategorySuggestions] = useState(false);
  const [filteredSubcategorySuggestions, setFilteredSubcategorySuggestions] = useState<string[]>([]);
  const subcategoryInputRef = useRef<HTMLInputElement>(null);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [filteredSubcategories, setFilteredSubcategories] = useState<string[]>([]);

  const allFormTags = Array.from(new Set(learning.flatMap(item => item.tags || [])));

  useEffect(() => {
    if (user) {
      fetchLearning();
      fetchCategories();
      fetchAllCategoriesForForm();
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

  const fetchCategories = async () => {
    if (!user) return;
    try {
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

  const fetchAllCategoriesForForm = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setAllCategories(data || []);
    } catch (error) {
      console.error('Error fetching all categories:', error);
    }
  };

  // Load suggested tags and subcategories when category selection changes
  useEffect(() => {
    const loadSuggestions = async () => {
      if (!user) return;
      if (formData.categoryIds.length > 0) {
        try {
          const tagResults = await getTagsByCategory(user.id, formData.categoryIds);
          setSuggestedTags(tagResults.map((t: any) => t.name));

          const subcatResults = await Promise.all(
            formData.categoryIds.map(catId => getSubcategories(user.id!, catId))
          );
          const allSubcats = Array.from(new Set(subcatResults.flat().map((s: any) => s.name)));
          setFilteredSubcategories(allSubcats);
        } catch (e) {
          setSuggestedTags(allFormTags);
          setFilteredSubcategories(Array.from(new Set(learning.flatMap(item => item.subcategories || []))));
        }
      } else {
        setSuggestedTags(allFormTags);
        setFilteredSubcategories(Array.from(new Set(learning.flatMap(item => item.subcategories || []))));
      }
    };
    loadSuggestions();
  }, [formData.categoryIds, user]);

  const handleTagInputChange = (value: string) => {
    setTagInputValue(value);
    if (value.trim()) {
      const allAvailableTags = Array.from(new Set([...suggestedTags, ...allFormTags]));
      const suggestions = allAvailableTags
        .filter(tag => tag.toLowerCase().includes(value.toLowerCase()) && !selectedFormTags.includes(tag))
        .slice(0, 8);
      setFilteredTagSuggestions(suggestions);
      setShowTagSuggestions(suggestions.length > 0);
    } else {
      setShowTagSuggestions(false);
    }
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = tagInputValue.trim();
      if (newTag && !selectedFormTags.includes(newTag)) {
        setSelectedFormTags(prev => [...prev, newTag]);
      }
      setTagInputValue('');
      setShowTagSuggestions(false);
    } else if (e.key === 'Escape') {
      setShowTagSuggestions(false);
    }
  };

  const addTagFromSuggestion = (tag: string) => {
    if (!selectedFormTags.includes(tag)) {
      setSelectedFormTags(prev => [...prev, tag]);
    }
    setTagInputValue('');
    setShowTagSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const finalTags = selectedFormTags;
      const finalSubcategories = selectedFormSubcategories;
      const learningData = {
        title: formData.title,
        description: formData.description,
        url: formData.url,
        tags: finalTags,
        subcategories: finalSubcategories,
        difficulty_level: formData.difficulty_level,
        user_id: user.id,
      };

      let learningId: string;

      if (editingItem) {
        const { error } = await supabase
          .from('learning')
          .update(learningData)
          .eq('id', editingItem.id)
          .eq('user_id', user.id);

        if (error) throw error;
        learningId = editingItem.id;
        toast.success('Learning item updated successfully!');
      } else {
        const { data, error } = await supabase
          .from('learning')
          .insert([learningData])
          .select()
          .single();

        if (error) throw error;
        learningId = data.id;
        toast.success('Learning item created successfully!');
      }

      await supabase
        .from('learning_categories')
        .delete()
        .eq('learning_id', learningId);

      if (formData.categoryIds.length > 0) {
        const categoryConnections = formData.categoryIds.map(categoryId => ({
          learning_id: learningId,
          category_id: categoryId,
        }));

        await supabase
          .from('learning_categories')
          .insert(categoryConnections);
      }

      let allUpsertedSubcats: { id: string; name: string }[] = [];
      if (selectedFormSubcategories.length > 0 && formData.categoryIds.length > 0) {
        const subcatResults = await Promise.all(
          formData.categoryIds.map((catId) => upsertSubcategoriesByNames(user.id!, catId, selectedFormSubcategories))
        );
        const subcatsFlat = subcatResults.flat();
        allUpsertedSubcats = subcatsFlat.map(s => ({ id: s.id, name: s.name }));
        const uniqueSubcatIds = Array.from(new Set(allUpsertedSubcats.map(s => s.id)));
        if (uniqueSubcatIds.length > 0) {
          await setLearningSubcategories(learningId, uniqueSubcatIds);
        }
      }

      if (selectedFormTags.length > 0 && formData.categoryIds.length > 0) {
        let tagIds: string[] = [];
        if (selectedFormSubcategories.length > 0) {
          let subcatIds: string[] = [];
          if (allUpsertedSubcats.length > 0) {
            subcatIds = Array.from(new Set(allUpsertedSubcats.map(s => s.id)));
          } else {
            const subcatResults = await Promise.all(
              formData.categoryIds.map((catId) => upsertSubcategoriesByNames(user.id!, catId, selectedFormSubcategories))
            );
            subcatIds = Array.from(new Set(subcatResults.flat().map(s => s.id)));
          }
          if (subcatIds.length > 0) {
            const tagResults = await Promise.all(
              subcatIds.map((subcatId) => upsertTagsByNames(user.id!, subcatId, selectedFormTags))
            );
            tagIds = Array.from(new Set(tagResults.flat().map(t => t.id)));
          }
        } else {
          const tagResults = await Promise.all(
            formData.categoryIds.map((catId) => upsertCategoryTagsByNames(user.id!, catId, selectedFormTags))
          );
          tagIds = Array.from(new Set(tagResults.flat().map(t => t.id)));
        }
        if (tagIds.length > 0) {
          await setLearningTags(learningId, tagIds);
        }
      }

      setFormData({
        title: '',
        description: '',
        url: '',
        tags: '',
        difficulty_level: 'Beginner',
        categoryIds: [],
      });
      setSelectedFormTags([]);
      setSelectedFormSubcategories([]);
      setTagInputValue('');
      setSubcategoryInputValue('');
      setShowTagSuggestions(false);
      setShowSubcategorySuggestions(false);
      setShowForm(false);
      setEditingItem(null);
      fetchLearning();
    } catch (error) {
      console.error('Error saving learning item:', error);
      toast.error('Failed to save learning item');
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

  const allTags = Array.from(new Set(learning.flatMap(item => item.tags)));
  const allSubcategories = Array.from(new Map(
    learning
      .flatMap(item => item.taxonomySubcategories || [])
      .map(sc => [sc.id, sc])
  ).values());

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
            className={`inline-flex items-center justify-center px-3 py-2.5 rounded-lg border transition-colors duration-150 text-sm font-medium ${
              filtersOpen
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-card border-border text-foreground hover:bg-accent'
            }`}
            aria-expanded={filtersOpen}
            title="Toggle filters"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </button>
        </div>

        {filtersOpen && (
          <div className="bg-card rounded-xl p-4 mb-6 space-y-3 border border-border shadow-card">
            {/* Difficulty */}
            <details className="bg-muted/40 rounded-md" open>
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">Difficulty</summary>
              <div className="px-3 py-2">
                <div className="flex flex-wrap gap-2">
                  {difficultyLevels.map((level) => (
                    <button
                      key={level}
                      onClick={() => {
                        setSelectedDifficulty(prev =>
                          prev.includes(level)
                            ? prev.filter(d => d !== level)
                            : [...prev, level]
                        );
                      }}
                      className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 ${
                        selectedDifficulty.includes(level)
                          ? getDifficultyColor(level)
                          : 'text-muted-foreground border-border hover:bg-accent'
                      }`}
                    >
                      {level}
                      {selectedDifficulty.includes(level) && (
                        <X className="ml-1 w-3 h-3" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </details>

            {/* Date Range */}
            <details className="bg-muted/40 rounded-md">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">Date Range</summary>
              <div className="px-3 py-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">From</label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="input-primary text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">To</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="input-primary text-sm"
                  />
                </div>
                {(dateRange.start || dateRange.end) && (
                  <div className="md:col-span-2">
                    <button
                      onClick={() => setDateRange({ start: '', end: '' })}
                      className="mt-2 p-2 text-muted-foreground hover:text-destructive transition-colors duration-150"
                      title="Clear date filter"
                    >
                      Clear date filter
                    </button>
                  </div>
                )}
              </div>
            </details>

            {/* Categories */}
            {categories.length > 0 && (
              <details className="bg-muted/40 rounded-md">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">Categories</summary>
                <div className="px-3 py-2">
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => {
                          setSelectedCategories(prev =>
                            prev.includes(category.id)
                              ? prev.filter(id => id !== category.id)
                              : [...prev, category.id]
                          );
                        }}
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                          selectedCategories.includes(category.id)
                            ? 'text-white'
                            : 'text-muted-foreground border border-border hover:bg-accent'
                        }`}
                        style={{
                          backgroundColor: selectedCategories.includes(category.id) ? category.color : undefined,
                        }}
                      >
                        {category.name}
                        {selectedCategories.includes(category.id) && (
                          <X className="ml-1 w-3 h-3" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </details>
            )}

            {/* Tags */}
            {allTags.length > 0 && (
              <details className="bg-muted/40 rounded-md">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">Tags</summary>
                <div className="px-3 py-2">
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                    {allTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => {
                          setSelectedTags(prev =>
                            prev.includes(tag)
                              ? prev.filter(t => t !== tag)
                              : [...prev, tag]
                          );
                        }}
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                          selectedTags.includes(tag)
                            ? 'bg-primary text-primary-foreground border border-primary'
                            : 'text-muted-foreground border border-border hover:bg-accent'
                        }`}
                      >
                        <Tag className="mr-1 w-3 h-3" />
                        {tag}
                        {selectedTags.includes(tag) && (
                          <X className="ml-1 w-3 h-3" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </details>
            )}

            {/* Subcategories */}
            {allSubcategories.length > 0 && (
              <details className="bg-muted/40 rounded-md">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">Subcategories</summary>
                <div className="px-3 py-2">
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                    {allSubcategories.map((sc) => (
                      <button
                        key={sc.id}
                        onClick={() => {
                          setSelectedSubcategoryFilters(prev =>
                            prev.includes(sc.id)
                              ? prev.filter(s => s !== sc.id)
                              : [...prev, sc.id]
                          );
                        }}
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                          selectedSubcategoryFilters.includes(sc.id)
                            ? 'bg-accent text-accent-foreground border border-primary/30'
                            : 'text-muted-foreground border border-border hover:bg-accent'
                        }`}
                      >
                        {sc.name}
                        {selectedSubcategoryFilters.includes(sc.id) && (
                          <X className="ml-1 w-3 h-3" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </details>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setFiltersOpen(false)}
                className="btn-secondary"
              >
                Close Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Learning Form Modal - Removed - now using dedicated page */}
      {false && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="p-6 border-b border-gray-700 bg-gray-900/50">
              <h2 className="text-lg font-semibold text-gray-100">
                {editingItem ? 'Edit Learning Item' : 'Add New Learning Item'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors bg-gray-700 text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  URL
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors bg-gray-700 text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Description
                </label>
                <RichTextEditor
                  value={formData.description}
                  onChange={(content) => setFormData(prev => ({ ...prev, description: content }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Difficulty Level *
                </label>
                <select
                  required
                  value={formData.difficulty_level}
                  onChange={(e) => setFormData(prev => ({ ...prev, difficulty_level: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors bg-gray-700 text-gray-100"
                >
                  {difficultyLevels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tags
                </label>

                {selectedFormTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedFormTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setSelectedFormTags(prev => prev.filter(t => t !== tag));
                        }}
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-600 text-white border border-indigo-500 transition-colors"
                      >
                        {tag}
                        <X className="ml-1 w-3 h-3" />
                      </button>
                    ))}
                  </div>
                )}

                {suggestedTags.length > 0 && (
                  <div className="mb-3">
                    <label className="block text-xs text-gray-400 mb-1">
                      {formData.categoryIds.length > 0
                        ? 'Relevant tags for selected categories (from taxonomy)'
                        : 'All available tags (taxonomy + existing)'}
                    </label>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {suggestedTags
                        .filter(tag => !selectedFormTags.includes(tag))
                        .map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => addTagFromSuggestion(tag)}
                            className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium text-gray-300 border border-gray-600 hover:bg-gray-700 transition-colors"
                          >
                            <Tag className="mr-1 w-3 h-3" />
                            {tag}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                <div className="relative">
                  <label className="block text-xs text-gray-400 mb-1">Type to search or add new tags</label>
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={tagInputValue}
                    onChange={(e) => handleTagInputChange(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    placeholder="Start typing to see suggestions..."
                    className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors bg-gray-700 text-gray-100"
                  />

                  {showTagSuggestions && (
                    <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredTagSuggestions.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => addTagFromSuggestion(tag)}
                          className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 transition-colors flex items-center"
                        >
                          <Tag className="mr-2 w-3 h-3 text-gray-400" />
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Subcategories */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Subcategories</label>

                {selectedFormSubcategories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedFormSubcategories.map((sc) => (
                      <button
                        key={sc}
                        type="button"
                        onClick={() => {
                          setSelectedFormSubcategories(prev => prev.filter(s => s !== sc));
                        }}
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-purple-600 text-white border border-purple-500 transition-colors"
                      >
                        {sc}
                        <X className="ml-1 w-3 h-3" />
                      </button>
                    ))}
                  </div>
                )}

                {filteredSubcategories.length > 0 && (
                  <div className="mb-3">
                    <label className="block text-xs text-gray-400 mb-1">
                      {formData.categoryIds.length > 0
                        ? 'Relevant subcategories for selected categories'
                        : 'All available subcategories'}
                    </label>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {filteredSubcategories
                        .filter(sc => !selectedFormSubcategories.includes(sc))
                        .map((sc) => (
                          <button
                            key={sc}
                            type="button"
                            onClick={() => setSelectedFormSubcategories(prev => [...prev, sc])}
                            className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium text-gray-300 border border-gray-600 hover:bg-gray-700 transition-colors"
                          >
                            {sc}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                <div className="relative">
                  <label className="block text-xs text-gray-400 mb-1">Type to search or add new subcategories</label>
                  <input
                    ref={subcategoryInputRef}
                    type="text"
                    value={subcategoryInputValue}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSubcategoryInputValue(value);
                      if (value.trim()) {
                        const suggestions = filteredSubcategories
                          .filter(sc => sc.toLowerCase().includes(value.toLowerCase()) && !selectedFormSubcategories.includes(sc))
                          .slice(0, 5);
                        setFilteredSubcategorySuggestions(suggestions);
                        setShowSubcategorySuggestions(suggestions.length > 0);
                      } else {
                        setShowSubcategorySuggestions(false);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const newSc = subcategoryInputValue.trim();
                        if (newSc && !selectedFormSubcategories.includes(newSc)) {
                          setSelectedFormSubcategories(prev => [...prev, newSc]);
                        }
                        setSubcategoryInputValue('');
                        setShowSubcategorySuggestions(false);
                      } else if (e.key === 'Escape') {
                        setShowSubcategorySuggestions(false);
                      }
                    }}
                    placeholder="Start typing to see suggestions..."
                    className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors bg-gray-700 text-gray-100"
                  />

                  {showSubcategorySuggestions && (
                    <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredSubcategorySuggestions.map((sc) => (
                        <button
                          key={sc}
                          type="button"
                          onClick={() => {
                            if (!selectedFormSubcategories.includes(sc)) {
                              setSelectedFormSubcategories(prev => [...prev, sc]);
                            }
                            setSubcategoryInputValue('');
                            setShowSubcategorySuggestions(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                        >
                          {sc}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Categories */}
              {allCategories.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Categories
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-600 rounded-lg p-3 bg-gray-700">
                    {allCategories.map((category) => (
                      <label key={category.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.categoryIds.includes(category.id)}
                          onChange={(e) => {
                            setFormData(prev => ({
                              ...prev,
                              categoryIds: e.target.checked
                                ? [...prev.categoryIds, category.id]
                                : prev.categoryIds.filter(id => id !== category.id),
                            }));
                          }}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="ml-2 text-sm text-gray-200">{category.name}</span>
                        <div
                          className="ml-2 w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingItem(null);
                  }}
                  className="px-4 py-2 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200"
                >
                  {editingItem ? 'Update' : 'Create'} Learning Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/learning/${item.id}/edit`, '_blank');
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
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4" />
              Add Your First Learning Item
            </Button>
          )}
        </div>
      )}
    </div>
  );
}