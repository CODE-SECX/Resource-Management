import React, { useState, useEffect } from 'react';
import { supabase, type Learning, type Category } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Filter, Edit2, Trash2, ExternalLink, Tag, X, GraduationCap, Grid, LayoutList } from 'lucide-react';
import toast from 'react-hot-toast';
import { RichTextEditor } from '../components/RichTextEditor';
import { useSearchParams } from 'react-router-dom';
import { Modal } from '../components/Modal';

const difficultyLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'] as const;

export function Learning() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [learning, setLearning] = useState<Learning[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Learning | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string[]>([]);
  const [isGridLayout, setIsGridLayout] = useState(true);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    url: '',
    tags: '',
    difficulty_level: 'Beginner' as const,
    categoryIds: [] as string[],
  });
  const [selectedResource, setSelectedResource] = useState<Learning | null>(null);

  // Check if we should open the form automatically
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setShowForm(true);
      setSearchParams({}); // Clear the URL parameter
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    fetchLearning();
    fetchCategories();
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
      const learningData = {
        title: formData.title,
        description: formData.description,
        url: formData.url,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        difficulty_level: formData.difficulty_level,
        user_id: user.id,
      };

      let learningId;

      if (editingItem) {
        // Update existing item
        const { error } = await supabase
          .from('learning')
          .update(learningData)
          .eq('id', editingItem.id);

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

      // Update categories
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

      // Reset form
      setFormData({
        title: '',
        description: '',
        url: '',
        tags: '',
        difficulty_level: 'Beginner',
        categoryIds: [],
      });
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
      tags: item.tags.join(', '),
      difficulty_level: item.difficulty_level,
      categoryIds: item.categories?.map(cat => cat.id) || [],
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this learning item?')) return;

    try {
      const { error } = await supabase
        .from('learning')
        .delete()
        .eq('id', id);

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

  // Filter learning items
  const filteredLearning = learning.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategories = selectedCategories.length === 0 ||
                             item.categories?.some(cat => selectedCategories.includes(cat.id));
    
    const matchesTags = selectedTags.length === 0 ||
                       selectedTags.some(tag => item.tags.includes(tag));

    const matchesDifficulty = selectedDifficulty.length === 0 ||
                             selectedDifficulty.includes(item.difficulty_level);

    return matchesSearch && matchesCategories && matchesTags && matchesDifficulty;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Learning</h1>
          <p className="text-gray-600 mt-1">Track your learning journey</p>
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
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200 space-y-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search learning items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">Filters:</span>
          </div>
        </div>

        {/* Difficulty filters */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Difficulty Level</h4>
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
                    : 'text-gray-700 border-gray-300 hover:bg-gray-50'
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

        {/* Category filters */}
        {categories.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Categories</h4>
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
                      : 'text-gray-700 border border-gray-300 hover:bg-gray-50'
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
            <h4 className="text-sm font-medium text-gray-700 mb-2">Tags</h4>
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
                      ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                      : 'text-gray-700 border border-gray-300 hover:bg-gray-50'
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
      </div>

      {/* Learning Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 bg-gray-50/50">
              <h2 className="text-lg font-semibold">
                {editingItem ? 'Edit Learning Item' : 'Add New Learning Item'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL *
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <RichTextEditor
                  value={formData.description}
                  onChange={(content) => setFormData(prev => ({ ...prev, description: content }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Difficulty Level *
                </label>
                <select
                  required
                  value={formData.difficulty_level}
                  onChange={(e) => setFormData(prev => ({ ...prev, difficulty_level: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                >
                  {difficultyLevels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="javascript, react, tutorial"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                />
              </div>

              {categories.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Categories
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-3">
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
                        <span className="ml-2 text-sm text-gray-900">{category.name}</span>
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
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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

      {/* Learning Detail Modal */}
      <Modal
        isOpen={!!selectedResource}
        onClose={() => setSelectedResource(null)}
        title={selectedResource?.title || ''}
        size="xl"
      >
        <div className="space-y-4">
          <div className="prose prose-lg max-w-none">
            <div dangerouslySetInnerHTML={{ __html: selectedResource?.description || '' }} />
          </div>
          
          <div className="mt-6 flex flex-wrap gap-2">
            {selectedResource?.tags.map((tag, index) => (
              <span key={index} className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
                {tag}
              </span>
            ))}
          </div>
          
          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <span>Category: {selectedResource?.categories?.map(cat => cat.name).join(', ')}</span>
            <span>Added: {selectedResource?.created_at && new Date(selectedResource.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </Modal>

      {/* Learning Grid/List View */}
      <div className={isGridLayout ? "grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
        {filteredLearning.map((item) => {
          const isExpanded = expandedItemId === item.id;
          return (
            <div 
              key={item.id} 
              className={`bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow ${!isGridLayout ? 'cursor-pointer' : ''}`}
              onClick={() => !isGridLayout && setExpandedItemId(isExpanded ? null : item.id)}
            >
              <div className={`${isGridLayout ? 'p-4 sm:p-6' : 'p-4'}`}>
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 flex-1 mr-2">
                    {item.title}
                  </h3>
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
                    className={`text-gray-600 text-sm mb-3 prose prose-sm max-w-none ${
                      !isGridLayout && !isExpanded ? 'line-clamp-2' : ''
                    }`}
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
                        className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full"
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
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
          <div className="mx-auto w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <GraduationCap className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
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