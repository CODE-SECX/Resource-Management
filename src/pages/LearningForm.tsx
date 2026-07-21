import React, { useState, useEffect, useRef } from 'react';
import {
  supabase,
  type Learning,
  type Category,
  getSubcategories,
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
import { Skeleton } from '../components/ui/Skeleton';

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
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton height={20} width={160} />
        <Skeleton height={36} width={280} />
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-6">
          <Skeleton height={44} className="w-full" />
          <Skeleton height={44} className="w-full" />
          <Skeleton height={120} className="w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <button
        onClick={() => navigate('/learning')}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Learning
      </button>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          {isEditing ? 'Edit Learning Item' : 'Create New Learning Item'}
        </h1>
        <p className="mt-1 text-sm sm:text-base text-muted-foreground">
          {isEditing ? 'Update your learning resource' : 'Share a resource you want to remember'}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
        {/* Tab Toggle */}
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab('allFields')}
            className={`flex-1 px-4 sm:px-8 py-4 font-semibold text-sm sm:text-base transition-colors duration-200 ${
              activeTab === 'allFields'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground border-b-2 border-transparent hover:text-foreground hover:bg-accent'
            }`}
          >
            All Fields
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('description')}
            className={`flex-1 px-4 sm:px-8 py-4 font-semibold text-sm sm:text-base transition-colors duration-200 ${
              activeTab === 'description'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground border-b-2 border-transparent hover:text-foreground hover:bg-accent'
            }`}
          >
            Description
          </button>
        </div>

        {/* ALL FIELDS SECTION */}
        {activeTab === 'allFields' && (
          <div className="p-6 sm:p-8">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-primary" />
              Learning Details
            </h2>

            {/* Responsive Grid Layout: 1 col mobile, 2 cols tablet, 4 cols desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Title - spans 2 columns */}
              <div className="sm:col-span-2 form-group">
                <label className="form-label">
                  Title <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="input-primary"
                  placeholder="Enter learning resource title"
                />
              </div>

              {/* Difficulty Level - spans 1 column */}
              <div className="form-group">
                <label className="form-label">
                  Difficulty <span className="text-destructive">*</span>
                </label>
                <select
                  required
                  value={formData.difficulty_level}
                  onChange={(e) => setFormData(prev => ({ ...prev, difficulty_level: e.target.value as any }))}
                  className="input-primary"
                >
                  {difficultyLevels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>

              {/* URL - spans 1 column */}
              <div className="form-group">
                <label className="form-label">
                  Resource URL
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                  className="input-primary"
                  placeholder="https://example.com"
                />
              </div>

              {/* Categories - spans 2 columns */}
              {allCategories.length > 0 && (
                <div className="sm:col-span-2 form-group">
                  <label className="form-label flex items-center gap-2">
                    <Folder className="w-4 h-4 text-primary" />
                    Categories
                  </label>
                  <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 max-h-40 overflow-y-auto rounded-lg border border-border p-2">
                    {allCategories.map((category) => (
                      <label key={category.id} className="flex items-center cursor-pointer group p-2 rounded-md hover:bg-accent transition-colors duration-150">
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
                          className="rounded border-input text-primary focus:ring-ring/50 bg-background cursor-pointer"
                        />
                        <div
                          className="ml-3 w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="ml-2 text-sm text-foreground transition-colors duration-150">{category.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Subcategories - spans 2 columns */}
              {formData.categoryIds.length > 0 && (
                <div className="sm:col-span-2 form-group">
                  <label className="form-label flex items-center gap-2">
                    <Folder className="w-4 h-4 text-primary" />
                    Subcategories
                  </label>
                  <div className="bg-muted/40 border border-border rounded-lg p-4">
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
              <div className="sm:col-span-2 form-group">
                <label className="form-label flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary" />
                  Tags
                </label>
                {selectedFormTags.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {selectedFormTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setSelectedFormTags(prev => prev.filter(t => t !== tag))}
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground transition-colors duration-150"
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
                    className="input-primary"
                    placeholder="Type tags (press Enter to add)"
                  />
                  {showTagSuggestions && (
                    <div className="absolute z-20 w-full mt-2 bg-popover border border-border rounded-lg shadow-dropdown max-h-40 overflow-y-auto">
                      {filteredTagSuggestions.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => addTagFromSuggestion(tag)}
                          className="w-full px-4 py-2 text-left text-sm text-popover-foreground hover:bg-accent transition-colors duration-150 flex items-center"
                        >
                          <Tag className="mr-2 w-3 h-3 text-muted-foreground" />
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="form-hint">Press Enter or comma to add a tag.</p>
              </div>

              {/* Smart Tag Assignment */}
              {selectedFormSubcategories.length > 0 && (
                <div className="sm:col-span-2 lg:col-span-4 form-group">
                  <label className="form-label flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    Tag Assignment
                  </label>
                  <div className="bg-muted/40 border border-border rounded-lg p-4">
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
        )}

        {/* DESCRIPTION SECTION */}
        {activeTab === 'description' && (
          <div className="p-6 sm:p-8">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Full Description
            </h2>

            {/* Rich Text Editor Container - Auto-expanding */}
            <div className="bg-card border border-border rounded-xl overflow-visible shadow-xs">
              <RichTextEditor
                value={formData.description}
                onChange={(content) => setFormData(prev => ({ ...prev, description: content }))}
              />
            </div>
          </div>
        )}

        {/* Bottom Action Bar */}
        <div className="sticky bottom-0 bg-card/95 backdrop-blur border-t border-border px-6 sm:px-8 py-4 flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/learning')}
            className="btn-secondary w-full sm:w-auto justify-center"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full sm:w-auto justify-center"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Saving...' : (isEditing ? 'Update Learning Item' : 'Create Learning Item')}
          </button>
        </div>
      </form>
    </div>
  );
}
