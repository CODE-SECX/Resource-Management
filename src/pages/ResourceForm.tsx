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

export function ResourceForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'allFields' | 'description'>('allFields');
  const [formMode, setFormMode] = useState<'all' | 'description'>('all');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    url: '',
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
            onClick={() => navigate('/resources')}
            className="inline-flex items-center text-indigo-400 hover:text-indigo-300 transition-colors mb-3 font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Resources
          </button>
          <div>
            <h1 className="text-4xl font-bold text-white">
              {isEditing ? 'Edit Resource' : 'Create New Resource'}
            </h1>
            <p className="text-gray-400 mt-2">
              {isEditing ? 'Update your resource information' : 'Add a new resource to your collection'}
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
                    Resource Details
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
                  placeholder="Enter resource title"
                />
              </div>

              {/* URL - spans 2 columns */}
              <div className="sm:col-span-2">
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
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {allCategories.map((category) => (
                      <label key={category.id} className="flex items-center cursor-pointer group p-2 rounded hover:bg-gray-700/30 transition-all">
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
                  <div className="sm:col-span-2 lg:col-span-4">
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
                        className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-gray-700/50 text-gray-100 placeholder-gray-500"
                        placeholder="Type tags (press Enter to add)"
                      />
                      {showTagSuggestions && (
                        <div className="absolute z-20 w-full mt-2 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {filteredTagSuggestions.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => {
                                if (!selectedFormTags.includes(tag)) setSelectedFormTags(prev => [...prev, tag]);
                                setTagInputValue('');
                                setShowTagSuggestions(false);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 transition-colors flex items-center"
                            >
                              <Tag className="w-3 h-3 mr-2 text-gray-400" />
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
                          availableTags={selectedFormTags}
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
            <div className="flex-1 flex flex-col px-12 py-8 min-h-0">
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
            onClick={() => navigate('/resources')}
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
            {loading ? 'Saving...' : (isEditing ? 'Update Resource' : 'Create Resource')}
          </button>
        </div>
      </form>
    </div>
  );
}
