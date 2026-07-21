import React, { useState, useEffect } from 'react';
import { supabase, type Category } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, Tag, Palette, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Skeleton } from '../components/ui/Skeleton';

const predefinedColors = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4',
  '#84CC16', '#F97316', '#EC4899', '#6366F1', '#14B8A6', '#F43F5E',
];

export function Categories() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
  });
  const [stats, setStats] = useState<Record<string, { resources: number; learning: number }>>({});

  // Check if we should open the form automatically
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setShowForm(true);
      setSearchParams({}); // Clear the URL parameter
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    fetchCategories();
    fetchCategoryStats();
  }, [user]);

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
      toast.error('Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoryStats = async () => {
    if (!user) return;

    try {
      const [resourcesResult, learningResult] = await Promise.all([
        supabase
          .from('resource_categories')
          .select('category_id, resources!inner(user_id)')
          .eq('resources.user_id', user.id),
        supabase
          .from('learning_categories')
          .select('category_id, learning!inner(user_id)')
          .eq('learning.user_id', user.id),
      ]);

      const resourceCounts: Record<string, number> = {};
      const learningCounts: Record<string, number> = {};

      resourcesResult.data?.forEach(item => {
        resourceCounts[item.category_id] = (resourceCounts[item.category_id] || 0) + 1;
      });

      learningResult.data?.forEach(item => {
        learningCounts[item.category_id] = (learningCounts[item.category_id] || 0) + 1;
      });

      const combinedStats: Record<string, { resources: number; learning: number }> = {};
      categories.forEach(category => {
        combinedStats[category.id] = {
          resources: resourceCounts[category.id] || 0,
          learning: learningCounts[category.id] || 0,
        };
      });

      setStats(combinedStats);
    } catch (error) {
      console.error('Error fetching category stats:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const categoryData = {
        name: formData.name,
        description: formData.description,
        color: formData.color,
        user_id: user.id,
      };

      if (editingCategory) {
        // Update existing category
        const { error } = await supabase
          .from('categories')
          .update(categoryData)
          .eq('id', editingCategory.id);

        if (error) throw error;
        toast.success('Category updated successfully!');
      } else {
        // Create new category
        const { error } = await supabase
          .from('categories')
          .insert([categoryData]);

        if (error) throw error;
        toast.success('Category created successfully!');
      }

      // Reset form
      setFormData({
        name: '',
        description: '',
        color: '#3B82F6',
      });
      setShowForm(false);
      setEditingCategory(null);
      fetchCategories();
      fetchCategoryStats();
    } catch (error: any) {
      console.error('Error saving category:', error);
      if (error.code === '23505') {
        toast.error('A category with this name already exists');
      } else {
        toast.error('Failed to save category');
      }
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description,
      color: category.color,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? This will remove it from all associated resources and learning items.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Category deleted successfully!');
      fetchCategories();
      fetchCategoryStats();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Failed to delete category');
    }
  };

  if (loading) {
    return (
      <div className="container-wide space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="space-y-2">
            <Skeleton height={32} width={200} />
            <Skeleton height={16} width={280} />
          </div>
          <Skeleton height={40} width={140} rounded="lg" />
        </div>
        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 sm:p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton width={40} height={40} rounded="lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton height={16} width="60%" />
                  <Skeleton height={12} width="80%" />
                </div>
              </div>
              <Skeleton height={12} width="40%" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container-wide space-y-8">
      <PageHeader
        title="Categories"
        subtitle="Organize your resources and learning items"
        actions={
          <button
            onClick={() => {
              setEditingCategory(null);
              setFormData({
                name: '',
                description: '',
                color: '#3B82F6',
              });
              setShowForm(true);
            }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        }
      />

      {/* Category Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="category-modal-title"
        >
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:items-center">
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity animate-fade-in"
              onClick={() => {
                setShowForm(false);
                setEditingCategory(null);
              }}
              aria-hidden="true"
            />
            <div className="animate-scale-in relative transform overflow-hidden rounded-xl bg-card text-left align-middle shadow-modal transition-all my-8 w-full max-w-md flex flex-col border border-border max-h-[90vh]">
              <div className="flex items-start justify-between gap-4 px-5 py-4 sm:px-6 border-b border-border shrink-0">
                <h2 id="category-modal-title" className="text-lg sm:text-xl font-semibold text-foreground">
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingCategory(null);
                  }}
                  aria-label="Close dialog"
                  className="rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent p-1.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="px-5 py-5 sm:px-6 space-y-4 overflow-y-auto text-left">
                <div className="form-group">
                  <label className="form-label">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="input-primary"
                    placeholder="Enter category name"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="input-primary"
                    placeholder="Optional description"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Color
                  </label>
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                      aria-label="Custom color"
                      className="w-12 h-10 border border-input rounded-lg cursor-pointer bg-card"
                    />
                    <span className="text-sm text-muted-foreground">{formData.color}</span>
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {predefinedColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, color }))}
                        aria-label={`Select color ${color}`}
                        className={`w-8 h-8 rounded-lg border-2 transition-all duration-200 cursor-pointer ${
                          formData.color === color
                            ? 'border-foreground scale-110'
                            : 'border-border hover:border-muted-foreground'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingCategory(null);
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                  >
                    {editingCategory ? 'Update' : 'Create'} Category
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Categories Grid */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => {
          const categoryStats = stats[category.id] || { resources: 0, learning: 0 };
          const totalItems = categoryStats.resources + categoryStats.learning;

          return (
            <div key={category.id} className="card card-hover">
              <div className="p-4 sm:p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: category.color }}
                    >
                      <Tag className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-foreground truncate">
                        {category.name}
                      </h3>
                      {category.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {category.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      onClick={() => handleEdit(category)}
                      aria-label={`Edit ${category.name}`}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-accent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      aria-label={`Delete ${category.name}`}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Items</span>
                    <span className="font-semibold text-foreground">{totalItems}</span>
                  </div>

                  {(categoryStats.resources > 0 || categoryStats.learning > 0) && (
                    <div className="space-y-2">
                      {categoryStats.resources > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-primary flex items-center">
                            <div className="w-2 h-2 bg-primary rounded-full mr-2"></div>
                            Resources
                          </span>
                          <span className="font-medium text-primary">{categoryStats.resources}</span>
                        </div>
                      )}

                      {categoryStats.learning > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-success flex items-center">
                            <div className="w-2 h-2 bg-success rounded-full mr-2"></div>
                            Learning
                          </span>
                          <span className="font-medium text-success">{categoryStats.learning}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Created {new Date(category.created_at).toLocaleDateString()}</span>
                    <div className="flex items-center gap-1">
                      <Palette className="w-3 h-3" />
                      <span>{category.color}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto w-20 h-20 sm:w-24 sm:h-24 bg-muted rounded-full flex items-center justify-center mb-4">
            <Tag className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            No categories yet
          </h3>
          <p className="text-muted-foreground mb-4">
            Create your first category to organize your resources and learning items.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            Add Your First Category
          </button>
        </div>
      )}
    </div>
  );
}