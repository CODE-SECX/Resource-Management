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
import { Tag, X, ArrowLeft, Save, FileText, Folder, Target, Lightbulb } from 'lucide-react';
import toast from 'react-hot-toast';
import { RichTextEditor } from '../components/RichTextEditor';
import { ColorCodedSubcategorySelector } from '../components/ColorCodedSubcategorySelector';
import { SmartTagAssignment } from '../components/SmartTagAssignment';
import { useNavigate, useParams } from 'react-router-dom';

const difficultyLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'] as const;

export function LearningForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'allFields' | 'description'>('allFields');
  
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
  const [availableSubcategoriesWithCategory, setAvailableSubcategoriesWithCategory] = useState<any[]>([]);
  const [tagAssignments, setTagAssignments] = useState<{
    tag: string;
    subcategoryId: string;
    subcategoryName: string;
    categoryName: string;
    categoryColor: string;
  }[]>([]);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [allFormTags, setAllFormTags] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      fetchAllCategoriesForForm();
      if (isEditing && id) {
        fetchLearningItem(id);
      }
      fetchAllTags();
    }
  }, [user, id, isEditing]);

  const fetchAllTags = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('learning')
        .select('tags')
        .eq('user_id', user.id);
      
      const allTags = Array.from(new Set(data?.flatMap(item => item.tags || []) || []));
      setAllFormTags(allTags);
      setSuggestedTags(allTags);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const fetchLearningItem = async (learningId: string) => {
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
        .eq('id', learningId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      const item = {
        ...data,
        categories: data.learning_categories.map((lc: any) => lc.categories),
      };

      setFormData({
        title: item.title,
        description: item.description,
        url: item.url,
        tags: '',
        difficulty_level: item.difficulty_level,
        categoryIds: item.categories?.map((cat: Category) => cat.id) || [],
      });
      setSelectedFormTags(item.tags || []);
      setSelectedFormSubcategories(item.subcategories || []);
    } catch (error) {
      console.error('Error fetching learning item:', error);
      toast.error('Failed to fetch learning item');
      navigate('/learning');
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
      setInitialLoading(false);
    } catch (error) {
      console.error('Error fetching all categories:', error);
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    if (!user || formData.categoryIds.length === 0) {
      setAvailableSubcategoriesWithCategory([]);
      return;
    }
    (async () => {
      try {
        const subLists = await Promise.all(formData.categoryIds.map(id => getSubcategories(user.id, id)));
        const allSubcats = subLists.flat();
        const subcategoriesWithCategory = allSubcats.map(sub => ({
          ...sub,
          category: allCategories.find(cat => cat.id === sub.category_id)!
        }));
        setAvailableSubcategoriesWithCategory(subcategoriesWithCategory);
      } catch (error) {
        console.error('Error fetching enhanced subcategories:', error);
      }
    })();
  }, [user, formData.categoryIds, allCategories]);

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

  const handleSubcategoryToggle = (subcategoryId: string) => {
    setSelectedFormSubcategories(prev =>
      prev.includes(subcategoryId) ? prev.filter(id => id !== subcategoryId) : [...prev, subcategoryId]
    );
  };

  const handleTagAssignmentAdd = (assignment: {
    tag: string;
    subcategoryId: string;
    subcategoryName: string;
    categoryName: string;
    categoryColor: string;
  }) => {
    setTagAssignments(prev => {
      const exists = prev.some(a => a.tag === assignment.tag && a.subcategoryId === assignment.subcategoryId);
      if (exists) return prev;
      return [...prev, assignment];
    });
  };

  const handleTagAssignmentRemove = (tag: string, subcategoryId: string) => {
    setTagAssignments(prev => prev.filter(a => !(a.tag === tag && a.subcategoryId === subcategoryId)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const finalTags = selectedFormTags;
      const learningData = {
        title: formData.title,
        description: formData.description,
        url: formData.url,
        tags: finalTags,
        subcategories: selectedFormSubcategories,
        difficulty_level: formData.difficulty_level,
        user_id: user.id,
      };

      let learningId: string;

      if (isEditing && id) {
        const { error } = await supabase
          .from('learning')
          .update(learningData)
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) throw error;
        learningId = id;
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

      // Handle subcategories - now using IDs
      if (selectedFormSubcategories.length > 0) {
        const validSubcategoryIds = selectedFormSubcategories.filter(id => {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          return uuidRegex.test(id);
        });
        if (validSubcategoryIds.length > 0) {
          await setLearningSubcategories(learningId, validSubcategoryIds);
        }
      }

      // Handle tag assignments
      if (tagAssignments.length > 0) {
        const tagIds: string[] = [];
        const assignmentsBySubcategory = tagAssignments.reduce((acc, assignment) => {
          if (!acc[assignment.subcategoryId]) acc[assignment.subcategoryId] = [];
          acc[assignment.subcategoryId].push(assignment.tag);
          return acc;
        }, {} as Record<string, string[]>);

        for (const [subcategoryId, tags] of Object.entries(assignmentsBySubcategory)) {
          const tagResults = await upsertTagsByNames(user.id!, subcategoryId, tags);
          tagIds.push(...tagResults.map(t => t.id));
        }
        if (tagIds.length > 0) {
          await setLearningTags(learningId, Array.from(new Set(tagIds)));
        }
      } else if (selectedFormTags.length > 0 && formData.categoryIds.length > 0) {
        let tagIds: string[] = [];
        if (selectedFormSubcategories.length > 0) {
          const tagResults = await Promise.all(
            selectedFormSubcategories.map((subcatId) => upsertTagsByNames(user.id!, subcatId, selectedFormTags))
          );
          tagIds = Array.from(new Set(tagResults.flat().map(t => t.id)));
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

      navigate('/learning');
    } catch (error) {
      console.error('Error saving learning item:', error);
      toast.error('Failed to save learning item');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 min-h-screen flex flex-col">
      {/* Header */}
      <div className="bg-gray-900/80 backdrop-blur border-b border-gray-700/50">
        <div className="px-8 py-6">
          <button
            onClick={() => navigate('/learning')}
            className="inline-flex items-center text-indigo-400 hover:text-indigo-300 transition-colors mb-3 font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Learning
          </button>
          <div>
            <h1 className="text-4xl font-bold text-white">
              {isEditing ? 'Edit Learning Item' : 'Create New Learning Item'}
            </h1>
            <p className="text-gray-400 mt-2">
              {isEditing ? 'Update your learning resource' : 'Share a resource you want to remember'}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="bg-gray-800/60 border-b border-gray-700/50 px-0">
        <div className="flex">
          <button
            onClick={() => setActiveTab('allFields')}
            className={`flex-1 px-8 py-4 font-semibold text-lg transition-all duration-200 ease-in-out ${
              activeTab === 'allFields'
                ? 'text-white border-b-2 border-indigo-500 bg-gray-700/30'
                : 'text-gray-400 border-b-2 border-transparent hover:text-gray-200'
            }`}
          >
            All Fields
          </button>
          <button
            onClick={() => setActiveTab('description')}
            className={`flex-1 px-8 py-4 font-semibold text-lg transition-all duration-200 ease-in-out ${
              activeTab === 'description'
                ? 'text-white border-b-2 border-indigo-500 bg-gray-700/30'
                : 'text-gray-400 border-b-2 border-transparent hover:text-gray-200'
            }`}
          >
            Description
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
        
        {/* ALL FIELDS SECTION */}
        {activeTab === 'allFields' && (
          <div className="flex-1 flex flex-col overflow-y-auto">
            <div className="flex-shrink-0">
              <div className="px-0 py-8">
                <div className="px-8 pb-8">
                  <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                    <Lightbulb className="w-6 h-6 text-indigo-400" />
                    Learning Details
                  </h2>
                </div>
                
                {/* Responsive Grid Layout: 1 col mobile, 2 cols tablet, 4 cols desktop */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 px-8 pb-8">
              
              {/* Title - spans 2 columns */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-gray-200 mb-3">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-gray-700/50 text-gray-100 placeholder-gray-500"
                  placeholder="Enter learning resource title"
                />
              </div>

              {/* Difficulty Level - spans 1 column */}
              <div>
                <label className="block text-sm font-semibold text-gray-200 mb-3">
                  Difficulty <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={formData.difficulty_level}
                  onChange={(e) => setFormData(prev => ({ ...prev, difficulty_level: e.target.value as any }))}
                  className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-gray-700/50 text-gray-100"
                >
                  {difficultyLevels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>

              {/* URL - spans 1 column */}
              <div>
                <label className="block text-sm font-semibold text-gray-200 mb-3">
                  Resource URL
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-gray-700/50 text-gray-100 placeholder-gray-500"
                  placeholder="https://example.com"
                />
              </div>

              {/* Categories - spans 2 columns */}
              {allCategories.length > 0 && (
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                    <Folder className="w-4 h-4 text-indigo-400" />
                    Categories
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {allCategories.map((category) => (
                      <label key={category.id} className="flex items-center cursor-pointer group p-3 rounded hover:bg-gray-700/30 transition-all">
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
                          className="rounded border-gray-500 text-indigo-600 focus:ring-indigo-500 bg-gray-700 cursor-pointer"
                        />
                        <div
                          className="ml-3 w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="ml-2 text-sm text-gray-200 group-hover:text-white transition-colors">{category.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Subcategories - spans 2 columns */}
              {formData.categoryIds.length > 0 && (
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                    <Folder className="w-4 h-4 text-indigo-400" />
                    Subcategories
                  </label>
                  <div className="bg-gray-700/30 rounded-lg p-4">
                    <ColorCodedSubcategorySelector
                      availableSubcategories={availableSubcategoriesWithCategory}
                      selectedSubcategories={selectedFormSubcategories}
                      onSubcategoryToggle={handleSubcategoryToggle}
                      selectedCategories={formData.categoryIds}
                      allCategories={allCategories}
                    />
                  </div>
                </div>
              )}

              {/* Tags - spans 2 columns */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-indigo-400" />
                  Tags
                </label>
                {selectedFormTags.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {selectedFormTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setSelectedFormTags(prev => prev.filter(t => t !== tag))}
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                      >
                        {tag}
                        <X className="ml-1.5 w-3 h-3" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={tagInputValue}
                    onChange={(e) => handleTagInputChange(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-gray-700/50 text-gray-100 placeholder-gray-500"
                    placeholder="Type tags (press Enter to add)"
                  />
                  {showTagSuggestions && (
                    <div className="absolute z-20 w-full mt-2 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {filteredTagSuggestions.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => addTagFromSuggestion(tag)}
                          className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 transition-colors flex items-center"
                        >
                          <Tag className="mr-2 w-3 h-3 text-gray-400" />
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Smart Tag Assignment */}
              {selectedFormSubcategories.length > 0 && (
                <div className="sm:col-span-2 lg:col-span-4">
                  <label className="block text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4 text-indigo-400" />
                    Tag Assignment
                  </label>
                  <div className="bg-gray-700/30 rounded-lg p-4">
                    <SmartTagAssignment
                      selectedSubcategories={selectedFormSubcategories}
                      availableSubcategories={availableSubcategoriesWithCategory}
                      tagAssignments={tagAssignments}
                      onTagAssignmentAdd={handleTagAssignmentAdd}
                      onTagAssignmentRemove={handleTagAssignmentRemove}
                      availableTags={Array.from(new Set([...selectedFormTags, ...suggestedTags, ...allFormTags]))}
                    />
                  </div>
                </div>
              )}

                </div>
              </div>
            </div>
          </div>
        )}

        {/* DESCRIPTION SECTION */}
        {activeTab === 'description' && (
          <div className="flex-1 flex flex-col overflow-y-auto">
            <div className="flex-1 flex flex-col p-8 min-h-0">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3 flex-shrink-0">
                <FileText className="w-6 h-6 text-indigo-400" />
                Full Description
              </h2>
              
              {/* Rich Text Editor Container - Auto-expanding */}
              <div className="flex-1 bg-gray-700/30 border border-gray-600 rounded-xl overflow-visible shadow-md flex flex-col min-h-0">
                <RichTextEditor
                  value={formData.description}
                  onChange={(content) => setFormData(prev => ({ ...prev, description: content }))}
                />
              </div>
            </div>
          </div>
        )}

        {/* Bottom Action Bar */}
        <div className="flex-shrink-0 bg-gray-900/95 backdrop-blur border-t border-gray-700/50 px-8 py-6 flex justify-between items-center">
          <button
            type="button"
            onClick={() => navigate('/learning')}
            className="px-8 py-3 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-700 hover:border-gray-500 transition-all font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-10 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            {loading ? 'Saving...' : (isEditing ? 'Update Learning Item' : 'Create Learning Item')}
          </button>
        </div>
      </form>
    </div>
  );
}
