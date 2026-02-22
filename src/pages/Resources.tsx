import { useState, useEffect, useRef } from 'react';
import {
  supabase,
  type Resource,
  type Category,
  getSubcategories,
  upsertSubcategoriesByNames,
  upsertTagsByNames,
  upsertCategoryTagsByNames,
  setResourceSubcategories,
  setResourceTags,
} from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Edit2, Trash2, Tag, X, Grid, LayoutList, BookOpen, ArrowUpRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { RichTextEditor } from '../components/RichTextEditor';
import { ColorCodedSubcategorySelector } from '../components/ColorCodedSubcategorySelector';
import { SmartTagAssignment } from '../components/SmartTagAssignment';
import { useSearchParams, Link } from 'react-router-dom';

export function Resources() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [resources, setResources] = useState<Resource[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGridLayout, setIsGridLayout] = useState(true);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
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

  const allTags = Array.from(new Set(resources.flatMap(item => item.tags || [])));
  const getFilteredTags = () => {
    if (formData.categoryIds.length === 0) return allTags;
    return Array.from(new Set(
      resources
        .filter(item =>
          formData.categoryIds.length === 0 ||
          item.categories?.some(cat => formData.categoryIds.includes(cat.id))
        )
        .flatMap(item => item.tags || [])
    ));
  };
  const filteredTags = getFilteredTags();

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
    const action = searchParams.get('action');
    const id = searchParams.get('id');
    if (action === 'new') {
      setShowForm(true);
      setSearchParams({});
    }
    if (action === 'edit' && id) {
      const res = resources.find(r => r.id === id);
      if (res) {
        handleEdit(res);
        setSearchParams({});
      }
    }
  }, [searchParams, setSearchParams, resources]);

  useEffect(() => {
    fetchResources();
    fetchAllCategoriesForForm();
  }, [user]);

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
      return exists ? prev : [...prev, assignment];
    });
    if (!selectedFormTags.includes(assignment.tag)) {
      setSelectedFormTags(prev => [...prev, assignment.tag]);
    }
  };

  const handleTagAssignmentRemove = (tag: string, subcategoryId: string) => {
    setTagAssignments(prev => prev.filter(a => !(a.tag === tag && a.subcategoryId === subcategoryId)));
    const hasOtherAssignments = tagAssignments.some(a => a.tag === tag && a.subcategoryId !== subcategoryId);
    if (!hasOtherAssignments) {
      setSelectedFormTags(prev => prev.filter(t => t !== tag));
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
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const resourcesWithCategories = data?.map(resource => ({
        ...resource,
        categories: resource.resource_categories.map((rc: any) => rc.categories),
      })) || [];

      setResources(resourcesWithCategories);
    } catch (error) {
      console.error('Error fetching resources:', error);
      toast.error('Failed to fetch resources');
    } finally {
      setLoading(false);
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

      let resourceId;

      if (editingResource) {
        const { error } = await supabase
          .from('resources')
          .update(resourceData)
          .eq('id', editingResource.id)
          .eq('user_id', user.id);
        if (error) throw error;
        resourceId = editingResource.id;
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

      setFormData({ title: '', description: '', url: '', tags: '', categoryIds: [] });
      setSelectedFormTags([]);
      setSelectedFormSubcategories([]);
      setTagAssignments([]);
      setTagInputValue('');
      setShowTagSuggestions(false);
      setShowForm(false);
      setEditingResource(null);
      fetchResources();
    } catch (error) {
      console.error('Error saving resource:', error);
      toast.error('Failed to save resource');
    }
  };

  const handleEdit = (resource: Resource) => {
    setEditingResource(resource);
    setFormData({
      title: resource.title,
      description: resource.description,
      url: resource.url,
      tags: '',
      categoryIds: resource.categories?.map(cat => cat.id) || [],
    });
    setSelectedFormTags(resource.tags);
    const subcategoryNames = resource.subcategories || [];
    const subcategoryIds = subcategoryNames.map(name => {
      const found = availableSubcategoriesWithCategory.find(sub => sub.name === name);
      return found ? found.id : null;
    }).filter(id => id !== null) as string[];
    setSelectedFormSubcategories(subcategoryIds);
    setTagAssignments([]);
    setTagInputValue('');
    setShowTagSuggestions(false);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this resource?')) return;
    try {
      await supabase.from('resource_categories').delete().eq('resource_id', id);
      const { error } = await supabase
        .from('resources')
        .delete()
        .eq('id', id)
        .eq('user_id', user!.id);
      if (error) throw error;
      toast.success('Resource deleted successfully!');
      fetchResources();
    } catch (error) {
      console.error('Error deleting resource:', error);
      toast.error('Failed to delete resource');
    }
  };

  const filteredResources = resources.filter(resource => {
    return resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           resource.description.toLowerCase().includes(searchQuery.toLowerCase());
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
          <h1 className="text-3xl font-bold text-gray-50 mb-2">Resource Library</h1>
          <p className="text-gray-300">Organize and access your comprehensive resource collection</p>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0">
          <button
            onClick={() => setIsGridLayout(!isGridLayout)}
            className="p-2 text-gray-600 hover:text-indigo-600 rounded-lg hover:bg-gray-100 transition-colors"
            title={isGridLayout ? "Switch to list view" : "Switch to grid view"}
          >
            {isGridLayout ? <LayoutList className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
          </button>
          <Link
            to="/taxonomy"
            className="inline-flex items-center px-3 py-2 text-sm border border-gray-600 text-gray-200 rounded-lg hover:bg-gray-700"
          >
            Manage Taxonomy
          </Link>
          <button
            onClick={() => {
              setEditingResource(null);
              setFormData({ title: '', description: '', url: '', tags: '', categoryIds: [] });
              setShowForm(true);
            }}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Resource
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-3 w-full border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors bg-gray-700 text-gray-100"
          />
        </div>
      </div>

      {/* Resource Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="p-6 border-b border-gray-700 bg-gray-900/50">
              <h2 className="text-lg font-semibold text-gray-100">
                {editingResource ? 'Edit Resource' : 'Add New Resource'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors bg-gray-700 text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">URL</label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors bg-gray-700 text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <RichTextEditor
                  value={formData.description}
                  onChange={(content) => setFormData(prev => ({ ...prev, description: content }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Tags</label>
                {selectedFormTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedFormTags.map((tag) => (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => setSelectedFormTags(prev => prev.filter(t => t !== tag))}
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-600 text-white border border-indigo-500 transition-colors"
                      >
                        {tag}
                        <X className="ml-1 w-3 h-3" />
                      </button>
                    ))}
                  </div>
                )}
                {filteredTags.length > 0 && (
                  <div className="mb-3">
                    <label className="block text-xs text-gray-400 mb-2">
                      {formData.categoryIds.length > 0 ? 'Tags for selected categories:' : 'All available tags:'}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {filteredTags.filter(tag => !selectedFormTags.includes(tag)).map((tag) => (
                        <button
                          type="button"
                          key={tag}
                          onClick={() => setSelectedFormTags(prev => [...prev, tag])}
                          className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium text-gray-300 border border-gray-600 hover:bg-gray-700 transition-colors"
                        >
                          <Tag className="w-3 h-3 mr-1" />
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
                    placeholder="Start typing to see suggestions..."
                    className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors bg-gray-700 text-gray-100"
                  />
                  {showTagSuggestions && (
                    <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredTagSuggestions.map((tag) => (
                        <button
                          type="button"
                          key={tag}
                          onClick={() => {
                            if (!selectedFormTags.includes(tag)) setSelectedFormTags(prev => [...prev, tag]);
                            setTagInputValue('');
                            setShowTagSuggestions(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                        >
                          <Tag className="w-4 h-4 mr-2 text-gray-400" />
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">Press Enter or comma to add, Escape to close suggestions</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Subcategories</label>
                {selectedFormSubcategories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedFormSubcategories.map((sc) => (
                      <button
                        key={sc}
                        type="button"
                        onClick={() => setSelectedFormSubcategories(prev => prev.filter(s => s !== sc))}
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-purple-600 text-white border border-purple-500 transition-colors"
                      >
                        {sc}
                        <X className="ml-1 w-3 h-3" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {allCategories.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Categories</label>
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
                        <div className="ml-2 w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {formData.categoryIds.length > 0 && (
                <div className="space-y-4">
                  <ColorCodedSubcategorySelector
                    availableSubcategories={availableSubcategoriesWithCategory}
                    selectedSubcategories={selectedFormSubcategories}
                    onSubcategoryToggle={handleSubcategoryToggle}
                    selectedCategories={formData.categoryIds}
                    allCategories={allCategories}
                  />
                </div>
              )}

              {selectedFormSubcategories.length > 0 && (
                <div className="space-y-4">
                  <SmartTagAssignment
                    selectedSubcategories={selectedFormSubcategories}
                    availableSubcategories={availableSubcategoriesWithCategory}
                    tagAssignments={tagAssignments}
                    onTagAssignmentAdd={handleTagAssignmentAdd}
                    onTagAssignmentRemove={handleTagAssignmentRemove}
                    availableTags={filteredTags}
                  />
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingResource(null); }}
                  className="px-4 py-2 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200"
                >
                  {editingResource ? 'Update' : 'Create'} Resource
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resources Grid/List View */}
      <div className={isGridLayout ? "grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "space-y-3"}>
        {filteredResources.map((resource) => {
          const isExpanded = expandedItemId === resource.id;
          return (
            <div
              key={resource.id}
              className={`group relative bg-gray-800/80 rounded-xl border border-gray-700/60 hover:border-gray-600/80 hover:shadow-xl hover:shadow-black/20 transition-all duration-300 overflow-hidden ${!isGridLayout ? 'cursor-pointer' : ''}`}
              onClick={() => !isGridLayout && setExpandedItemId(isExpanded ? null : resource.id)}
            >
              {/* Top accent bar */}
              <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500/30 to-purple-500/10" />

              <div className="p-5" onClick={(e) => e.stopPropagation()}>
                {/* Actions (visible on hover) */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1" />
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(resource); }}
                      className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-all"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(resource.id); }}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Title */}
                <Link
                  to={`/resources/${resource.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="block mb-3 group/title"
                >
                  <h2 className="text-base font-semibold text-gray-100 leading-snug group-hover/title:text-indigo-300 transition-colors duration-200 line-clamp-2">
                    {resource.title}
                  </h2>
                </Link>

                {/* Category pills */}
                {resource.categories && resource.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {resource.categories.map((category) => (
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
                {resource.subcategories && resource.subcategories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {resource.subcategories.map((sc, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded-md"
                      >
                        {sc}
                      </span>
                    ))}
                  </div>
                )}

                {/* Tags */}
                {resource.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {resource.tags.slice(0, 4).map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-700/80 text-gray-300 border border-gray-600/50 rounded-md"
                      >
                        <Tag className="w-2.5 h-2.5 mr-1 text-gray-400" />
                        {tag}
                      </span>
                    ))}
                    {resource.tags.length > 4 && (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs text-gray-500 bg-gray-700/50 rounded-md">
                        +{resource.tags.length - 4}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-700/50">
                  <span className="text-xs text-gray-500 tabular-nums">
                    {new Date(resource.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors group/link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Open
                    <ArrowUpRight className="w-3 h-3 opacity-60 group-hover/link:opacity-100 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredResources.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto w-20 h-20 sm:w-24 sm:h-24 bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-100 mb-2">
            {resources.length === 0 ? 'No resources yet' : 'No matching resources'}
          </h3>
          <p className="text-gray-500 mb-4">
            {resources.length === 0
              ? 'Create your first resource to get started.'
              : 'Try adjusting your search or filters.'}
          </p>
          {resources.length === 0 && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Resource
            </button>
          )}
        </div>
      )}
    </div>
  );
}