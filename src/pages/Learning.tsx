import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  supabase,
  type Learning,
  type Category,
  getSubcategories,
  getTagsByCategory,
  getTagsForSubcategories,
  upsertSubcategoriesByNames,
  upsertTagsByNames,
  upsertCategoryTagsByNames,
  setLearningSubcategories,
  setLearningTags,
} from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Filter, Edit2, Trash2, ExternalLink, Tag, X, GraduationCap, Grid, LayoutList } from 'lucide-react';
import toast from 'react-hot-toast';
import { RichTextEditor } from '../components/RichTextEditor';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
const difficultyLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'] as const;

export function Learning() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [learning, setLearning] = useState<Learning[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Learning | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedSubcategoryFilters, setSelectedSubcategoryFilters] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{start: string; end: string}>({ start: '', end: '' });
  const [isGridLayout, setIsGridLayout] = useState(true);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
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
  // Subcategory form state
  const [selectedFormSubcategories, setSelectedFormSubcategories] = useState<string[]>([]);
  const [subcategoryInputValue, setSubcategoryInputValue] = useState('');
  const [showSubcategorySuggestions, setShowSubcategorySuggestions] = useState(false);
  const [filteredSubcategorySuggestions, setFilteredSubcategorySuggestions] = useState<string[]>([]);
  const subcategoryInputRef = useRef<HTMLInputElement>(null);

  // Get all tags from learning items (legacy) for form
  const allFormTags = Array.from(new Set(learning.flatMap(item => item.tags || [])));
  // Get all subcategories from learning items (legacy) for form/filters
  const allFormSubcategories = Array.from(new Set(learning.flatMap(item => item.subcategories || [])));

  // Normalized taxonomy suggestions
  const [taxonomySubcategoryNames, setTaxonomySubcategoryNames] = useState<string[]>([]);
  const [taxonomyTagNames, setTaxonomyTagNames] = useState<string[]>([]);

  // Fetch taxonomy-based suggestions whenever categories selection changes
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        let subcatNames: string[] = [];
        let tagNames: string[] = [];

        if (formData.categoryIds.length === 0) {
          // All subcategories and tags across all categories
          const subs = await getSubcategories(user.id);
          subcatNames = subs.map(s => s.name);

          // For tags across all categories: aggregate category-level + subcategory-level
          // Use allCategories (already fetched for form) to avoid an extra query
          const categoryIds = allCategories.map(c => c.id);
          if (categoryIds.length > 0) {
            const subLists = await Promise.all(categoryIds.map(id => getSubcategories(user.id, id)));
            const subIds = Array.from(new Set(subLists.flat().map(s => s.id)));
            const catTagRowsNested = await Promise.all(categoryIds.map(id => getTagsByCategory(user.id, id)));
            const catTagRows = catTagRowsNested.flat();
            const subTagRows = subIds.length ? await getTagsForSubcategories(user.id, subIds) : [];
            tagNames = Array.from(new Set([...catTagRows, ...subTagRows].map(t => t.name)));
          }
        } else {
          // Filtered by selected categories
          const subLists = await Promise.all(formData.categoryIds.map(id => getSubcategories(user.id, id)));
          subcatNames = Array.from(new Set(subLists.flat().map(s => s.name)));

          const subIds = Array.from(new Set(subLists.flat().map(s => s.id)));
          const catTagRowsNested = await Promise.all(formData.categoryIds.map(id => getTagsByCategory(user.id, id)));
          const catTagRows = catTagRowsNested.flat();
          const subTagRows = subIds.length ? await getTagsForSubcategories(user.id, subIds) : [];
          tagNames = Array.from(new Set([...catTagRows, ...subTagRows].map(t => t.name)));
        }

        setTaxonomySubcategoryNames(subcatNames.sort());
        setTaxonomyTagNames(tagNames.sort());
      } catch (e) {
        console.error('Failed to fetch taxonomy suggestions', e);
      }
    })();
  }, [user, formData.categoryIds, allCategories]);

  // Suggested tags: merge normalized taxonomy tags with legacy tags from existing learning
  // Legacy tags scoped to selected categories (fallback when taxonomy isn't backfilled yet)
  const legacyTagsForSelected = useMemo(() => {
    if (formData.categoryIds.length === 0) return allFormTags;
    return Array.from(new Set(
      learning
        .filter(item => item.categories?.some(cat => formData.categoryIds.includes(cat.id)))
        .flatMap(item => item.tags || [])
    ));
  }, [learning, allFormTags, formData.categoryIds]);

  const suggestedTags = useMemo(() => {
    const merged = new Set<string>([...taxonomyTagNames, ...legacyTagsForSelected]);
    return Array.from(merged);
  }, [taxonomyTagNames, legacyTagsForSelected]);

  // Add tag from suggestions
  const addTagFromSuggestion = (tag: string) => {
    if (!selectedFormTags.includes(tag)) {
      setSelectedFormTags(prev => [...prev, tag]);
    }
    setTagInputValue('');
    setShowTagSuggestions(false);
  };

  // Add tag on Enter or comma
  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
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

  // Suggested subcategories: merge normalized taxonomy subcategories with legacy ones from learning
  const legacySubcategoriesForSelected = useMemo(() => {
    if (formData.categoryIds.length === 0) return allFormSubcategories;
    return Array.from(new Set(
      learning
        .filter(item => item.categories?.some(cat => formData.categoryIds.includes(cat.id)))
        .flatMap(item => item.subcategories || [])
    ));
  }, [learning, allFormSubcategories, formData.categoryIds]);

  const filteredSubcategories = useMemo(() => {
    const merged = new Set<string>([...taxonomySubcategoryNames, ...legacySubcategoriesForSelected]);
    return Array.from(merged);
  }, [taxonomySubcategoryNames, legacySubcategoriesForSelected]);

  // Handle tag input changes and show suggestions
  const handleTagInputChange = (value: string) => {
    setTagInputValue(value);

    if (value.trim()) {
      const suggestions = suggestedTags
        .filter((tag: string) => tag.toLowerCase().includes(value.toLowerCase()) && !selectedFormTags.includes(tag))
        .slice(0, 5);

      setFilteredTagSuggestions(suggestions);
      setShowTagSuggestions(suggestions.length > 0);
    } else {
      setShowTagSuggestions(false);
    }
  };

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagInputRef.current && !tagInputRef.current.contains(event.target as Node)) {
        setShowTagSuggestions(false);
      }
      if (subcategoryInputRef.current && !subcategoryInputRef.current.contains(event.target as Node)) {
        setShowSubcategorySuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Check if we should open the form automatically
  useEffect(() => {
    const action = searchParams.get('action');
    const id = searchParams.get('id');
    if (action === 'new') {
      setShowForm(true);
      setSearchParams({}); // Clear the URL parameter
    }
    if (action === 'edit' && id) {
      const item = learning.find(l => l.id === id);
      if (item) {
        handleEdit(item);
        setSearchParams({});
      }
    }
  }, [searchParams, setSearchParams, learning]);

  useEffect(() => {
    fetchLearning();
    fetchCategories();
    fetchAllCategoriesForForm();
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
      toast.error('Failed to fetch learning items');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      // Use selectedFormTags directly since we're now using the smart tag input
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
        // Update existing item (scope by user for RLS)
        const { error } = await supabase
          .from('learning')
          .update(learningData)
          .eq('id', editingItem.id)
          .eq('user_id', user.id);

        if (error) throw error;
        learningId = editingItem.id;
        toast.success('Learning item updated successfully!');
      } else {
        // Create new item
        const { data, error } = await supabase
          .from('learning')
          .insert([learningData])
          .select()
          .single();

        if (error) throw error;
        learningId = data.id;
        toast.success('Learning item created successfully!');
      }

      // Update categories (delete existing first)
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

      // Normalized taxonomy sync (always-on)
      // 1) Subcategories: upsert for each selected category and link to learning
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

      // 2) Tags: if subcategories chosen, create subcategory-level tags across all upserted subcats;
      //    otherwise create category-level tags across all selected categories.
      if (selectedFormTags.length > 0 && formData.categoryIds.length > 0) {
        let tagIds: string[] = [];
        if (selectedFormSubcategories.length > 0) {
          // Ensure we have subcategories upserted; if not (edge), upsert now per category
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
          // No subcategories chosen: create category-level tags
          const tagResults = await Promise.all(
            formData.categoryIds.map((catId) => upsertCategoryTagsByNames(user.id!, catId, selectedFormTags))
          );
          tagIds = Array.from(new Set(tagResults.flat().map(t => t.id)));
        }
        if (tagIds.length > 0) {
          await setLearningTags(learningId, tagIds);
        }
      }

      // Reset form
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

  const handleEdit = (item: Learning) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description,
      url: item.url,
      tags: '',
      difficulty_level: item.difficulty_level,
      categoryIds: item.categories?.map(cat => cat.id) || [],
    });
    setSelectedFormTags(item.tags);
    setSelectedFormSubcategories(item.subcategories || []);
    setTagInputValue('');
    setSubcategoryInputValue('');
    setShowTagSuggestions(false);
    setShowSubcategorySuggestions(false);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this learning item?')) return;

    try {
      // Clean up junction table first
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

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'Beginner': return 'bg-green-100 text-green-800 border-green-200';
      case 'Intermediate': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Advanced': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Expert': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get all unique tags from learning items
  const allTags = Array.from(new Set(learning.flatMap(item => item.tags)));
  // Get all unique subcategories from learning items
  const allSubcategories = Array.from(new Set(learning.flatMap(item => item.subcategories || [])));

  // Filter learning items
  const filteredLearning = learning.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategories = selectedCategories.length === 0 ||
                             item.categories?.some(cat => selectedCategories.includes(cat.id));

    const matchesTags = selectedTags.length === 0 ||
                       selectedTags.some(tag => item.tags.includes(tag));
    const matchesSubcategories = selectedSubcategoryFilters.length === 0 ||
                          selectedSubcategoryFilters.some(sc => (item.subcategories || []).includes(sc));

    const matchesDifficulty = selectedDifficulty.length === 0 ||
                             selectedDifficulty.includes(item.difficulty_level);

    const matchesDate = (!dateRange.start && !dateRange.end) ||
                       ((!dateRange.start || new Date(item.created_at) >= new Date(dateRange.start)) &&
                        (!dateRange.end || new Date(item.created_at) <= new Date(dateRange.end)));

    return matchesSearch && matchesCategories && matchesTags && matchesSubcategories && matchesDifficulty && matchesDate;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="container-wide space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-50 mb-2">Learning Resources</h1>
          <p className="text-gray-300">Discover and track your learning journey with curated resources</p>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0">
          <button
            onClick={() => setIsGridLayout(!isGridLayout)}
            className="p-2 text-gray-600 hover:text-indigo-600 rounded-lg hover:bg-gray-100 transition-colors"
            title={isGridLayout ? "Switch to list view" : "Switch to grid view"}
          >
            {isGridLayout ? (
              <LayoutList className="w-5 h-5" />
            ) : (
              <Grid className="w-5 h-5" />
            )}
          </button>
          <Link
            to="/taxonomy"
            className="inline-flex items-center px-3 py-2 text-sm border border-gray-600 text-gray-200 rounded-lg hover:bg-gray-700"
            title="Manage taxonomy"
          >
            Manage Taxonomy
          </Link>
          <button
            onClick={() => {
              setEditingItem(null);
              setFormData({
                title: '',
                description: '',
                url: '',
                tags: '',
                difficulty_level: 'Beginner',
                categoryIds: [],
              });
              setShowForm(true);
            }}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Learning
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6 space-y-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search learning items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors bg-gray-700 text-gray-100"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">Filters:</span>
          </div>
        </div>

        {/* Difficulty filters */}
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Difficulty Level</h4>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
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
                    : 'text-gray-300 border-gray-600 hover:bg-gray-700'
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

        {/* Date Range Filter */}
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Date Range</h4>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">From</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-sm bg-gray-700 text-gray-100"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">To</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-sm bg-gray-700 text-gray-100"
              />
            </div>
            {(dateRange.start || dateRange.end) && (
              <button
                onClick={() => setDateRange({ start: '', end: '' })}
                className="mt-5 p-2 text-gray-400 hover:text-red-400 transition-colors"
                title="Clear date filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Category filters */}
        {categories.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">Categories</h4>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
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
                      : 'text-gray-300 border border-gray-600 hover:bg-gray-700'
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
        )}

        {/* Tag filters */}
        {allTags.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">Tags</h4>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
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
                      ? 'bg-indigo-600 text-white border border-indigo-500'
                      : 'text-gray-300 border border-gray-600 hover:bg-gray-700'
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
        )}

        {/* Subcategory filters */}
        {allSubcategories.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">Subcategories</h4>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {allSubcategories.map((sc) => (
                <button
                  key={sc}
                  onClick={() => {
                    setSelectedSubcategoryFilters(prev =>
                      prev.includes(sc)
                        ? prev.filter(s => s !== sc)
                        : [...prev, sc]
                    );
                  }}
                  className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                    selectedSubcategoryFilters.includes(sc)
                      ? 'bg-purple-600 text-white border border-purple-500'
                      : 'text-gray-300 border border-gray-600 hover:bg-gray-700'
                  }`}
                >
                  {sc}
                  {selectedSubcategoryFilters.includes(sc) && (
                    <X className="ml-1 w-3 h-3" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Learning Form Modal */}
      {showForm && (
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

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tags
                </label>

                {/* Selected tags display */}
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

                {/* Category-based tag suggestions */}
                {suggestedTags.length > 0 && (
                  <div className="mb-3">
                    <label className="block text-xs text-gray-400 mb-1">
                      {formData.categoryIds.length > 0 ? 'Relevant tags for selected categories (from taxonomy)' : 'All available tags (taxonomy + existing)'}
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

                {/* Smart tag input with autocomplete */}
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

                  {/* Tag suggestions dropdown */}
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

              {/* Subcategories input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Subcategories</label>

                {/* Selected subcategories display */}
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

                {/* Category-based subcategory suggestions */}
                {filteredSubcategories.length > 0 && (
                  <div className="mb-3">
                    <label className="block text-xs text-gray-400 mb-1">
                      {formData.categoryIds.length > 0 ? 'Relevant subcategories for selected categories' : 'All available subcategories'}
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

                {/* Smart subcategory input with autocomplete */}
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

                  {/* Subcategory suggestions dropdown */}
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
      <div className={isGridLayout ? "grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
        {filteredLearning.map((item) => {
          const isExpanded = expandedItemId === item.id;
          return (
            <div 
              key={item.id} 
              className={`bg-gray-800 rounded-lg shadow-sm border border-gray-700 hover:shadow-md transition-shadow ${!isGridLayout ? 'cursor-pointer' : ''}`}
              onClick={() => !isGridLayout && setExpandedItemId(isExpanded ? null : item.id)}
            >
              <div
                role="button"
                tabIndex={0}
                className="p-6 block hover:bg-gray-750 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/learning/${item.id}`);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate(`/learning/${item.id}`);
                  }
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-2xl font-semibold text-gray-50 flex-1 mr-3">
                    {item.title}
                  </h2>
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(item);
                      }}
                      className="p-1 text-gray-500 hover:text-indigo-600 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Difficulty Badge */}
                <div className="mb-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getDifficultyColor(item.difficulty_level)}`}>
                    <GraduationCap className="w-3 h-3 mr-1" />
                    {item.difficulty_level}
                  </span>
                </div>

                {item.description && (
                  <div 
                    className="text-gray-300 text-sm mb-3 line-clamp-3"
                    dangerouslySetInnerHTML={{ __html: item.description }}
                  />
                )}

                {/* Categories */}
                {item.categories && item.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {item.categories.map((category) => (
                      <span
                        key={category.id}
                        className="inline-block px-2 py-1 text-xs font-medium text-white rounded-full"
                        style={{ backgroundColor: category.color }}
                      >
                        {category.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Tags */}
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {item.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-700 text-gray-200 rounded-full"
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Subcategories */}
                {item.subcategories && item.subcategories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {item.subcategories.map((sc, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-700 text-gray-200 rounded-full"
                      >
                        {sc}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open Learning
                    <ExternalLink className="ml-1 w-4 h-4" />
                  </a>
                  <span className="text-xs text-gray-500">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredLearning.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto w-20 h-20 sm:w-24 sm:h-24 bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <GraduationCap className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-100 mb-2">
            {learning.length === 0 ? 'No learning items yet' : 'No matching learning items'}
          </h3>
          <p className="text-gray-500 mb-4">
            {learning.length === 0 
              ? 'Add your first learning item to get started.'
              : 'Try adjusting your search or filters.'}
          </p>
          {learning.length === 0 && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Learning Item
            </button>
          )}
        </div>
      )}
    </div>
  );
}