import React, { useState, useEffect, useRef } from 'react';
import {
  supabase,
  type Category,
  getSubcategories,
  upsertSubcategoriesByNames,
  upsertTagsByNames,
  upsertCategoryTagsByNames,
  setResourceSubcategories,
  setResourceTags,
} from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Tag, X, ArrowLeft, Save, FileText, Folder, Target, Lightbulb } from 'lucide-react';
import toast from 'react-hot-toast';
import { RichTextEditor } from '../components/RichTextEditor';
import { ColorCodedSubcategorySelector } from '../components/ColorCodedSubcategorySelector';
import { SmartTagAssignment } from '../components/SmartTagAssignment';
import { useNavigate, useParams } from 'react-router-dom';
import { Skeleton } from '../components/ui/Skeleton';

export function ResourceForm() {
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
    html_content: '',
    tags: '',
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

  const allTags = Array.from(new Set(
    (() => {
      try {
        return [] as string[];
      } catch {
        return [];
      }
    })()
  ));

  const getFilteredTags = () => {
    if (formData.categoryIds.length === 0) return allTags;
    return allTags;
  };
  const filteredTags = getFilteredTags();

  useEffect(() => {
    if (user) {
      fetchAllCategoriesForForm();
      if (isEditing && id) {
        fetchResourceItem(id);
      }
    }
  }, [user, id, isEditing]);

  useEffect(() => {
    fetchAllTags();
  }, [user]);

  const fetchAllTags = async () => {
    if (!user) return;
    try {
      await supabase
        .from('resources')
        .select('tags')
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagInputRef.current && !tagInputRef.current.contains(event.target as Node)) {
        setShowTagSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      const suggestions = filteredTags
        .filter(tag =>
          tag.toLowerCase().includes(value.toLowerCase()) &&
          !selectedFormTags.includes(tag)
        )
        .slice(0, 5);
      setFilteredTagSuggestions(suggestions);
      setShowTagSuggestions(suggestions.length > 0);
    } else {
      setShowTagSuggestions(false);
    }
  };

  const fetchResourceItem = async (resourceId: string) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('resources')
        .select(`
          *,
          resource_categories(
            categories(*)
          )
        `)
        .eq('id', resourceId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      const resource = {
        ...data,
        categories: data.resource_categories.map((rc: any) => rc.categories),
      };

      setFormData({
        title: resource.title,
        description: resource.description,
        url: resource.url,
        html_content: resource.html_content || '',
        tags: '',
        categoryIds: resource.categories?.map((cat: Category) => cat.id) || [],
      });
      setSelectedFormTags(resource.tags || []);
      
      const subcategoryNames = resource.subcategories || [];
      const subcategoryIds = subcategoryNames.map((name: string) => {
        const found = availableSubcategoriesWithCategory.find(sub => sub.name === name);
        return found ? found.id : null;
      }).filter((id: string | null) => id !== null) as string[];
      setSelectedFormSubcategories(subcategoryIds);
      setTagAssignments([]);
      setTagInputValue('');
    } catch (error) {
      console.error('Error fetching resource item:', error);
      toast.error('Failed to fetch resource');
      navigate('/resources');
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
      const finalSubcategories = selectedFormSubcategories;
      const resourceData = {
        title: formData.title,
        description: formData.description,
        url: formData.url,
        html_content: formData.html_content || null,
        tags: finalTags,
        subcategories: finalSubcategories,
        user_id: user.id,
      };

      let resourceId: string;

      if (isEditing && id) {
        const { error } = await supabase
          .from('resources')
          .update(resourceData)
          .eq('id', id)
          .eq('user_id', user.id);
        if (error) throw error;
        resourceId = id;
        toast.success('Resource updated successfully!');
      } else {
        const { data, error } = await supabase
          .from('resources')
          .insert([resourceData])
          .select()
          .single();
        if (error) throw error;
        resourceId = data.id;
        toast.success('Resource created successfully!');
      }

      await supabase.from('resource_categories').delete().eq('resource_id', resourceId);

      if (formData.categoryIds.length > 0) {
        const categoryConnections = formData.categoryIds.map(categoryId => ({
          resource_id: resourceId,
          category_id: categoryId,
        }));
        await supabase.from('resource_categories').insert(categoryConnections);
      }

      let allUpsertedSubcats: { id: string; name: string }[] = [];

      if (selectedFormSubcategories.length > 0) {
        const existingSubcats = selectedFormSubcategories.map(id => {
          const subcategory = availableSubcategoriesWithCategory.find(sub => sub.id === id);
          return subcategory ? { id: subcategory.id, name: subcategory.name } : null;
        }).filter(Boolean) as { id: string; name: string }[];
        allUpsertedSubcats.push(...existingSubcats);
      }

      if (allUpsertedSubcats.length > 0) {
        const uniqueSubcatIds = Array.from(new Set(allUpsertedSubcats.map(s => s.id)));
        const validSubcategoryIds = uniqueSubcatIds.filter(id => {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          return uuidRegex.test(id);
        });
        if (validSubcategoryIds.length > 0) {
          await setResourceSubcategories(resourceId, validSubcategoryIds);
        }
      }

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
          await setResourceTags(resourceId, Array.from(new Set(tagIds)));
        }
      } else if (selectedFormTags.length > 0 && formData.categoryIds.length > 0) {
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
          await setResourceTags(resourceId, tagIds);
        }
      }

      navigate('/resources');
    } catch (error) {
      console.error('Error saving resource:', error);
      toast.error('Failed to save resource');
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
        onClick={() => navigate('/resources')}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Resources
      </button>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          {isEditing ? 'Edit Resource' : 'Create New Resource'}
        </h1>
        <p className="mt-1 text-sm sm:text-base text-muted-foreground">
          {isEditing ? 'Update your resource information' : 'Add a new resource to your collection'}
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
              Resource Details
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
                  placeholder="Enter resource title"
                />
              </div>

              {/* URL - spans 2 columns */}
              <div className="sm:col-span-2 form-group">
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

              {/* HTML Content - spans 2 columns */}
              <div className="sm:col-span-2 lg:col-span-4 form-group">
                <label className="form-label">
                  HTML Content
                </label>
                <textarea
                  value={formData.html_content}
                  onChange={(e) => setFormData(prev => ({ ...prev, html_content: e.target.value }))}
                  className="input-primary min-h-[140px] font-mono text-sm"
                  placeholder="Paste raw HTML here. If present, this will be rendered instead of the URL when opening the item."
                />
              </div>

              {/* Categories - spans 2 columns */}
              {allCategories.length > 0 && (
                <div className="sm:col-span-2 form-group">
                  <label className="form-label flex items-center gap-2">
                    <Folder className="w-4 h-4 text-primary" />
                    Categories
                  </label>
                  <div className="space-y-1 max-h-40 overflow-y-auto rounded-lg border border-border p-2">
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
                  <div className="sm:col-span-2 lg:col-span-4 form-group">
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
                        onKeyDown={(e) => {
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
                        }}
                        className="input-primary"
                        placeholder="Type tags (press Enter to add)"
                      />
                      {showTagSuggestions && (
                        <div className="absolute z-20 w-full mt-2 bg-popover border border-border rounded-lg shadow-dropdown max-h-40 overflow-y-auto">
                          {filteredTagSuggestions.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => {
                                if (!selectedFormTags.includes(tag)) setSelectedFormTags(prev => [...prev, tag]);
                                setTagInputValue('');
                                setShowTagSuggestions(false);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-popover-foreground hover:bg-accent transition-colors duration-150 flex items-center"
                            >
                              <Tag className="w-3 h-3 mr-2 text-muted-foreground" />
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
                          availableTags={selectedFormTags}
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
            onClick={() => navigate('/resources')}
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
            {loading ? 'Saving...' : (isEditing ? 'Update Resource' : 'Create Resource')}
          </button>
        </div>
      </form>
    </div>
  );
}
