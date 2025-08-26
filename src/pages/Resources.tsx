import React, { useState, useEffect } from 'react';
import { supabase, type Resource, type Category } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Filter, Edit2, Trash2, ExternalLink, Tag, X, Grid, LayoutList } from 'lucide-react';
import toast from 'react-hot-toast';
import { RichTextEditor } from '../components/RichTextEditor';
import { useSearchParams, Link } from 'react-router-dom';
export function Resources() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [resources, setResources] = useState<Resource[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{start: string; end: string}>({ start: '', end: '' });
  const [isGridLayout, setIsGridLayout] = useState(true);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    url: '',
    tags: '',
    categoryIds: [] as string[],
  });

  // Check if we should open the form automatically
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setShowForm(true);
      setSearchParams({}); // Clear the URL parameter
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    fetchResources();
    fetchCategories();
  }, [user]);

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

  const fetchCategories = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const resourceData = {
        title: formData.title,
        description: formData.description,
        url: formData.url,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        user_id: user.id,
      };

      let resourceId;

      if (editingResource) {
        // Update existing resource
        const { error } = await supabase
          .from('resources')
          .update(resourceData)
          .eq('id', editingResource.id);

        if (error) throw error;
        resourceId = editingResource.id;
        toast.success('Resource updated successfully!');
      } else {
        // Create new resource
        const { data, error } = await supabase
          .from('resources')
          .insert([resourceData])
          .select()
          .single();

        if (error) throw error;
        resourceId = data.id;
        toast.success('Resource created successfully!');
      }

      // Update categories
      await supabase
        .from('resource_categories')
        .delete()
        .eq('resource_id', resourceId);

      if (formData.categoryIds.length > 0) {
        const categoryConnections = formData.categoryIds.map(categoryId => ({
          resource_id: resourceId,
          category_id: categoryId,
        }));

        await supabase
          .from('resource_categories')
          .insert(categoryConnections);
      }

      // Reset form
      setFormData({
        title: '',
        description: '',
        url: '',
        tags: '',
        categoryIds: [],
      });
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
      tags: resource.tags.join(', '),
      categoryIds: resource.categories?.map(cat => cat.id) || [],
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this resource?')) return;

    try {
      const { error } = await supabase
        .from('resources')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Resource deleted successfully!');
      fetchResources();
    } catch (error) {
      console.error('Error deleting resource:', error);
      toast.error('Failed to delete resource');
    }
  };

  // Get all unique tags from resources
  const allTags = Array.from(new Set(resources.flatMap(resource => resource.tags)));

  // Filter resources
  const filteredResources = resources.filter(resource => {
    const matchesSearch = resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         resource.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategories = selectedCategories.length === 0 ||
                             resource.categories?.some(cat => selectedCategories.includes(cat.id));

    const matchesTags = selectedTags.length === 0 ||
                       selectedTags.some(tag => resource.tags.includes(tag));

    const matchesDate = (!dateRange.start && !dateRange.end) ||
                       ((!dateRange.start || new Date(resource.created_at) >= new Date(dateRange.start)) &&
                        (!dateRange.end || new Date(resource.created_at) <= new Date(dateRange.end)));

    return matchesSearch && matchesCategories && matchesTags && matchesDate;
  });

  const truncateContent = (content: string, maxLength = 150) => {
    if (content.length <= maxLength) return content;
    return content.substr(0, maxLength) + '...';
  };

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
            {isGridLayout ? (
              <LayoutList className="w-5 h-5" />
            ) : (
              <Grid className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={() => {
              setEditingResource(null);
              setFormData({
                title: '',
                description: '',
                url: '',
                tags: '',
                categoryIds: [],
              });
              setShowForm(true);
            }}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Resource
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
                placeholder="Search resources..."
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
                  <Tag className="w-3 h-3 mr-1" />
                  {tag}
                  {selectedTags.includes(tag) && (
                    <X className="ml-1 w-3 h-3" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
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
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="javascript, react, tutorial"
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors bg-gray-700 text-gray-100"
                />
              </div>

              {categories.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Categories
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-600 rounded-lg p-3 bg-gray-700">
                    {categories.map((category) => (
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
                    setEditingResource(null);
                  }}
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
      <div className={isGridLayout ? "grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
        {filteredResources.map((resource) => {
          const isExpanded = expandedItemId === resource.id;
          return (
            <div 
              key={resource.id} 
              className={`bg-gray-800 rounded-lg shadow-sm border border-gray-700 hover:shadow-md transition-shadow ${!isGridLayout ? 'cursor-pointer' : ''}`}
              onClick={() => !isGridLayout && setExpandedItemId(isExpanded ? null : resource.id)}
            >
              <Link 
                to={`/resources/${resource.id}`}
                className="p-6 block hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-50 flex-1 mr-3">
                    {resource.title}
                  </h3>
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(resource);
                      }}
                      className="p-1 text-gray-500 hover:text-indigo-600 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(resource.id);
                      }}
                      className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {resource.description && (
                  <div 
                    className="text-gray-300 text-sm mb-3 line-clamp-3"
                    dangerouslySetInnerHTML={{ __html: resource.description }}
                  />
                )}

                {/* Categories */}
                {resource.categories && resource.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {resource.categories.map((category) => (
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
                {resource.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {resource.tags.map((tag, index) => (
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

                <div className="flex items-center justify-between">
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open Resource
                    <ExternalLink className="ml-1 w-4 h-4" />
                  </a>
                  <span className="text-xs text-gray-500">
                    {new Date(resource.created_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
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