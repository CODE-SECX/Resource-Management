import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  supabase,
  type Category,
  getSubcategories,
  getTags,
  getTagsByCategory,
  getLearningTagsByCategory,
  getResourceTagsByCategory,
  getPayloadTagsByCategory,
  upsertCategoryTagsByNames,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
  createTag,
  updateTag,
  deleteTag,
} from '../lib/supabase';
import { 
  Folder, 
  Plus, 
  Search, 
  Tag, 
  Palette, 
  Edit2, 
  Trash2, 
  X, 
  BarChart3, 
  Layers, 
  Hash,
  TrendingUp,
  Activity,
  Settings
} from 'lucide-react';
import toast from 'react-hot-toast';
import { TreeView, type TreeNode } from '../components/TreeView';
import { TaxonomyModal, type TaxonomyModalData } from '../components/TaxonomyModal';
import { BulkTagModal } from '../components/BulkTagModal';

const predefinedColors = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4',
  '#84CC16', '#F97316', '#EC4899', '#6366F1', '#14B8A6', '#F43F5E',
];

export default function Taxonomy() {
  const { user } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // TreeView state
  const [treeVersion, setTreeVersion] = useState(0);
  const [treeFilter, setTreeFilter] = useState('');
  const bumpTree = () => setTreeVersion(v => v + 1);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<TaxonomyModalData | null>(null);
  
  // Bulk tag modal state
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkModalParent, setBulkModalParent] = useState<{ id: string; name: string; type: 'category' | 'subcategory' } | null>(null);
  const [existingTagsForModal, setExistingTagsForModal] = useState<string[]>([]);

  // Track which categories we've attempted legacy backfill for (per session)
  const [backfilledCategories, setBackfilledCategories] = useState<Set<string>>(new Set());

  // Categories management state
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
  });
  const [categoryStats, setCategoryStats] = useState<Record<string, { resources: number; learning: number }>>({});
  const [totalStats, setTotalStats] = useState({
    categories: 0,
    subcategories: 0,
    tags: 0,
    resources: 0,
    learning: 0
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      await fetchCategories();
      await fetchCategoryStats();
      await fetchTotalStats();
      setLoading(false);
    })();
  }, [user]);

  // Build tree roots from categories
  const treeRoots: TreeNode[] = useMemo(() => {
    return categories.map(c => ({
      id: c.id,
      label: c.name,
      type: 'category',
      hasChildren: true,
      badgeText: undefined,
    }));
  }, [categories]);

  // Async load children for a node with legacy backfill
  const loadTreeChildren = async (node: TreeNode): Promise<TreeNode[]> => {
    if (!user) return [];
    try {
      if (node.type === 'category') {
        // Perform legacy backfill if not done yet
        if (!backfilledCategories.has(node.id)) {
          try {
            const [legacyLearn, legacyRes, legacyPayload] = await Promise.all([
              getLearningTagsByCategory(user.id, node.id),
              getResourceTagsByCategory(user.id, node.id),
              getPayloadTagsByCategory(user.id, categories.find(c => c.id === node.id)?.name || '')
            ]);
            const legacyUnion = Array.from(new Set<string>([
              ...legacyLearn,
              ...legacyRes,
              ...legacyPayload,
            ]));
            if (legacyUnion.length > 0) {
              await upsertCategoryTagsByNames(user.id, node.id, legacyUnion);
            }
            setBackfilledCategories(prev => new Set(prev).add(node.id));
          } catch (e: any) {
            setBackfilledCategories(prev => new Set(prev).add(node.id));
            if (e.code !== '23505' && !e.message?.includes('duplicate key')) {
              console.warn('Legacy tag backfill skipped for category', node.id, e);
            }
          }
        }

        const [subs, catTags] = await Promise.all([
          getSubcategories(user.id, node.id),
          getTagsByCategory(user.id, node.id),
        ]);
        const subNodes: TreeNode[] = subs.map(s => ({
          id: s.id,
          label: s.name,
          type: 'subcategory',
          hasChildren: true,
          color: s.color || undefined,
          description: s.description || undefined,
          badgeText: undefined,
        }));
        const tagNodes: TreeNode[] = catTags.map(t => ({
          id: t.id,
          label: t.name,
          type: 'tag',
          hasChildren: false,
          description: t.description || undefined,
        }));
        return [...subNodes, ...tagNodes];
      }
      if (node.type === 'subcategory') {
        const t = await getTags(user.id, node.id);
        return t.map(x => ({ 
          id: x.id, 
          label: x.name, 
          type: 'tag', 
          hasChildren: false,
          description: x.description || undefined
        }));
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load tree items');
    }
    return [];
  };

  // Modal handlers
  const openModal = (data: TaxonomyModalData) => {
    setModalData(data);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalData(null);
  };

  const handleModalSubmit = async (formData: { name: string; description?: string; color?: string }) => {
    if (!modalData || !user) return;

    try {
      switch (modalData.mode) {
        case 'add-subcategory':
          await createSubcategory({
            user_id: user.id,
            category_id: modalData.parentId,
            name: formData.name,
            description: formData.description,
            color: formData.color || '#8b5cf6'
          });
          toast.success('Subcategory created');
          break;

        case 'add-category-tag':
          await createTag({
            user_id: user.id,
            category_id: modalData.parentId,
            name: formData.name,
            description: formData.description
          });
          toast.success('Category-level tag created');
          break;

        case 'add-subcategory-tag':
          await createTag({
            user_id: user.id,
            subcategory_id: modalData.parentId,
            name: formData.name,
            description: formData.description
          });
          toast.success('Tag created');
          break;

        case 'edit-subcategory':
          if (!modalData.editItem) return;
          await updateSubcategory(modalData.editItem.id, {
            name: formData.name,
            description: formData.description,
            color: formData.color
          });
          toast.success('Subcategory updated');
          break;

        case 'edit-tag':
          if (!modalData.editItem) return;
          await updateTag(modalData.editItem.id, {
            name: formData.name,
            description: formData.description
          });
          toast.success('Tag updated');
          break;
      }
      bumpTree();
    } catch (e) {
      console.error(e);
      toast.error('Operation failed');
      throw e; // Re-throw to prevent modal from closing
    }
  };

  // Copy tag functionality
  const handleCopyTag = async (tag: TreeNode) => {
    try {
      await navigator.clipboard.writeText(tag.label);
      toast.success(`Copied "${tag.label}" to clipboard`);
    } catch (e) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = tag.label;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast.success(`Copied "${tag.label}" to clipboard`);
    }
  };

  // Copy all tags from a subcategory
  const handleCopyAllTags = async (subcategory: TreeNode) => {
    if (!user) return;
    
    try {
      // Get all tags for this subcategory
      const tags = await getTags(user.id, subcategory.id);
      
      if (tags.length === 0) {
        toast.error('No tags found in this subcategory');
        return;
      }
      
      // Create comma-separated string
      const tagNames = tags.map(tag => tag.name).join(', ');
      
      // Copy to clipboard
      await navigator.clipboard.writeText(tagNames);
      toast.success(`Copied ${tags.length} tags from "${subcategory.label}" to clipboard`);
    } catch (e) {
      console.error('Failed to copy all tags:', e);
      toast.error('Failed to copy tags');
    }
  };

  // Bulk tag creation
  const handleBulkAdd = async (parent: TreeNode) => {
    if (!user) return;
    
    try {
      // Get existing tags to show duplicates
      let existingTags: any[] = [];
      if (parent.type === 'category') {
        existingTags = await getTagsByCategory(user.id, parent.id);
      } else {
        existingTags = await getTags(user.id, parent.id);
      }
      
      setExistingTagsForModal(existingTags.map(tag => tag.name));
      setBulkModalParent({
        id: parent.id,
        name: parent.label,
        type: parent.type as 'category' | 'subcategory'
      });
      setBulkModalOpen(true);
    } catch (e) {
      console.error('Failed to load existing tags:', e);
      toast.error('Failed to load existing tags');
    }
  };

  const handleBulkTagSubmit = async (tagNames: string[]) => {
    if (!bulkModalParent || !user) return;

    try {
      // First, check which tags already exist in this location
      let existingTagsHere: any[] = [];
      if (bulkModalParent.type === 'category') {
        existingTagsHere = await getTagsByCategory(user.id, bulkModalParent.id);
      } else {
        existingTagsHere = await getTags(user.id, bulkModalParent.id);
      }

      const existingHereNames = existingTagsHere.map(tag => tag.name.toLowerCase());
      const duplicateInHere = tagNames.filter(name => existingHereNames.includes(name.toLowerCase()));
      const newTagNames = tagNames.filter(name => !existingHereNames.includes(name.toLowerCase()));

      if (newTagNames.length === 0) {
        toast.error(`All ${duplicateInHere.length} tags already exist in this location`);
        bumpTree(); // Still refresh the tree in case of any changes
        return;
      }

      // Create only the new tags
      const results = await Promise.allSettled(
        newTagNames.map(name => {
          if (bulkModalParent.type === 'category') {
            return createTag({
              user_id: user.id,
              category_id: bulkModalParent.id,
              name
            });
          } else {
            return createTag({
              user_id: user.id,
              subcategory_id: bulkModalParent.id,
              name
            });
          }
        })
      );

      const successful = results.filter(result => result.status === 'fulfilled').length;
      // Treat duplicate key errors as benign (race on per-location uniqueness)
      const failedHard = results.filter(r => r.status === 'rejected' && !(r as any).reason?.code === '23505' && !((r as any).reason?.message || '').includes('duplicate key')).length;

      // Provide detailed feedback
      if (successful > 0 && failedHard === 0) {
        const hereCount = duplicateInHere.length;
        const suffix = hereCount > 0 ? `. ${hereCount} already in this location.` : '';
        toast.success(`Created ${successful} new tag${successful !== 1 ? 's' : ''}${suffix}`);
      } else if (successful > 0 && failedHard > 0) {
        toast.error(`Created ${successful} tag${successful !== 1 ? 's' : ''}, but ${failedHard} failed.`);
      } else {
        // Nothing created and remaining were duplicates or hard failures
        if (duplicateInHere.length > 0) {
          toast.error(`No new tags created (${duplicateInHere.length} already in this location).`);
        } else {
          toast.error('Failed to create tags');
        }
      }

      bumpTree();
    } catch (e) {
      console.error('Bulk tag creation error:', e);
      toast.error('Failed to create tags');
      // Keep modal open for correction, don't rethrow
    }
  };

  // Smart add functionality with intuitive hierarchy
  const handleSmartAdd = (node: TreeNode) => {
    if (node.type === 'category') {
      // Categories: directly add subcategory
      openModal({
        mode: 'add-subcategory',
        parentId: node.id,
        parentName: node.label
      });
    } else if (node.type === 'subcategory') {
      // Subcategories: directly add tag
      openModal({
        mode: 'add-subcategory-tag',
        parentId: node.id,
        parentName: node.label
      });
    }
  };

  // Tree node actions
  const actionsByType = {
    category: {
      onAddChild: handleSmartAdd,
      onBulkAdd: handleBulkAdd,
    },
    subcategory: {
      onAddChild: handleSmartAdd,
      onBulkAdd: handleBulkAdd,
      onCopyAllTags: handleCopyAllTags,
      onRename: (node: TreeNode) => {
        openModal({
          mode: 'edit-subcategory',
          parentId: '',
          parentName: '',
          editItem: {
            id: node.id,
            name: node.label,
            description: node.description,
            color: node.color || '#8b5cf6'
          }
        });
      },
      onDelete: async (node: TreeNode) => {
        if (!confirm(`Delete subcategory "${node.label}"? This will also remove tag associations for items that used it.`)) return;
        try {
          await deleteSubcategory(node.id);
          toast.success('Subcategory deleted');
          bumpTree();
        } catch (e) {
          console.error(e);
          toast.error('Failed to delete subcategory');
        }
      },
    },
    tag: {
      onCopyTag: handleCopyTag,
      onRename: (node: TreeNode) => {
        openModal({
          mode: 'edit-tag',
          parentId: '',
          parentName: '',
          editItem: {
            id: node.id,
            name: node.label,
            description: node.description
          }
        });
      },
      onDelete: async (node: TreeNode) => {
        if (!confirm(`Delete tag "${node.label}"?`)) return;
        try {
          await deleteTag(node.id);
          toast.success('Tag deleted');
          bumpTree();
        } catch (e) {
          console.error(e);
          toast.error('Failed to delete tag');
        }
      },
    },
  } as const;

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
    } catch (e) {
      console.error(e);
      toast.error('Failed to load categories');
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

      setCategoryStats(combinedStats);
    } catch (error) {
      console.error('Error fetching category stats:', error);
    }
  };

  const fetchTotalStats = async () => {
    if (!user) return;

    try {
      const [categoriesResult, subcategoriesResult, tagsResult, resourcesResult, learningResult] = await Promise.all([
        supabase.from('categories').select('id').eq('user_id', user.id),
        supabase.from('subcategories').select('id').eq('user_id', user.id),
        supabase.from('tags').select('id').eq('user_id', user.id),
        supabase.from('resources').select('id').eq('user_id', user.id),
        supabase.from('learning').select('id').eq('user_id', user.id),
      ]);

      setTotalStats({
        categories: categoriesResult.data?.length || 0,
        subcategories: subcategoriesResult.data?.length || 0,
        tags: tagsResult.data?.length || 0,
        resources: resourcesResult.data?.length || 0,
        learning: learningResult.data?.length || 0,
      });
    } catch (error) {
      console.error('Error fetching total stats:', error);
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const categoryData = {
        name: categoryFormData.name,
        description: categoryFormData.description,
        color: categoryFormData.color,
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
      setCategoryFormData({
        name: '',
        description: '',
        color: '#3B82F6',
      });
      setShowCategoryForm(false);
      setEditingCategory(null);
      await fetchCategories();
      await fetchCategoryStats();
      await fetchTotalStats();
      bumpTree();
    } catch (error: any) {
      console.error('Error saving category:', error);
      if (error.code === '23505') {
        toast.error('A category with this name already exists');
      } else {
        toast.error('Failed to save category');
      }
    }
  };

  const handleCategoryEdit = (category: Category) => {
    setEditingCategory(category);
    setCategoryFormData({
      name: category.name,
      description: category.description,
      color: category.color,
    });
    setShowCategoryForm(true);
  };

  const handleCategoryDelete = async (id: string) => {
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
      await fetchCategories();
      await fetchCategoryStats();
      await fetchTotalStats();
      bumpTree();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Failed to delete category');
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-50">Taxonomy Management</h1>
          <p className="text-gray-400 mt-2">Professional organization system for categories, subcategories, and tags</p>
        </div>
        <button
          onClick={async () => {
            await fetchCategories();
            await fetchCategoryStats();
            await fetchTotalStats();
            bumpTree();
          }}
          className="px-4 py-2 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <Activity className="w-4 h-4 inline mr-2" />
          Refresh All
        </button>
      </div>

      {/* Statistics Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/10 rounded-xl p-6 border border-blue-700/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-300 text-sm font-medium">Categories</p>
              <p className="text-2xl font-bold text-blue-100">{totalStats.categories}</p>
            </div>
            <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <Layers className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-900/20 to-green-800/10 rounded-xl p-6 border border-green-700/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-300 text-sm font-medium">Subcategories</p>
              <p className="text-2xl font-bold text-green-100">{totalStats.subcategories}</p>
            </div>
            <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center">
              <Folder className="w-6 h-6 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 rounded-xl p-6 border border-purple-700/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-300 text-sm font-medium">Tags</p>
              <p className="text-2xl font-bold text-purple-100">{totalStats.tags}</p>
            </div>
            <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center">
              <Hash className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-900/20 to-orange-800/10 rounded-xl p-6 border border-orange-700/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-300 text-sm font-medium">Resources</p>
              <p className="text-2xl font-bold text-orange-100">{totalStats.resources}</p>
            </div>
            <div className="w-12 h-12 bg-orange-600/20 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-orange-400" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-pink-900/20 to-pink-800/10 rounded-xl p-6 border border-pink-700/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-pink-300 text-sm font-medium">Learning Items</p>
              <p className="text-2xl font-bold text-pink-100">{totalStats.learning}</p>
            </div>
            <div className="w-12 h-12 bg-pink-600/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-pink-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Categories Management Card */}
        <div className="xl:col-span-1">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                  <Layers className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-100">Categories</h2>
                  <p className="text-sm text-gray-400">Manage your main categories</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingCategory(null);
                  setCategoryFormData({
                    name: '',
                    description: '',
                    color: '#3B82F6',
                  });
                  setShowCategoryForm(true);
                }}
                className="px-3 py-2 text-sm bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {categories.map((category) => {
                const categoryStatsData = categoryStats[category.id] || { resources: 0, learning: 0 };
                const totalItems = categoryStatsData.resources + categoryStatsData.learning;

                return (
                  <div key={category.id} className="bg-gray-700/50 rounded-lg p-4 border border-gray-600/30 hover:bg-gray-700/70 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3 flex-1">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: category.color }}
                        >
                          <Tag className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-100 truncate">
                            {category.name}
                          </h3>
                          {category.description && (
                            <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                              {category.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-blue-400">{categoryStatsData.resources} resources</span>
                            <span className="text-xs text-green-400">{categoryStatsData.learning} learning</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
                        <button
                          onClick={() => handleCategoryEdit(category)}
                          className="p-1 text-gray-500 hover:text-blue-400 transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleCategoryDelete(category.id)}
                          className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {categories.length === 0 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Layers className="w-8 h-8 text-gray-500" />
                </div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">No categories yet</h3>
                <p className="text-xs text-gray-500 mb-4">Create your first category to get started</p>
              </div>
            )}
          </div>
        </div>

        {/* Taxonomy Tree Card */}
        <div className="xl:col-span-2">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                  <Folder className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-100">Taxonomy Hierarchy</h2>
                  <p className="text-sm text-gray-400">Complete organizational structure</p>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Click + to add • Hover for actions
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-gray-800/50 to-gray-700/30 rounded-lg p-4 border border-gray-600/30 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Search className="w-4 h-4 text-indigo-400" />
                <label className="text-sm font-medium text-gray-300">Global Search</label>
              </div>
              <input
                value={treeFilter}
                onChange={(e) => setTreeFilter(e.target.value)}
                placeholder="Search across all categories, subcategories, and tags..."
                className="w-full px-4 py-2.5 border border-gray-600 rounded-lg bg-gray-700/80 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
              />
            </div>

            <div className="bg-gray-700/30 rounded-lg p-4 max-h-96 overflow-y-auto">
              <TreeView
                rootNodes={treeRoots}
                loadChildren={loadTreeChildren}
                actionsByType={actionsByType as any}
                version={treeVersion}
                filter={treeFilter}
                className=""
              />
            </div>
          </div>
        </div>
      </div>

      {/* Category Form Modal */}
      {showCategoryForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-xl max-w-md w-full border border-gray-700">
            <div className="p-6 border-b border-gray-700 bg-gray-800/50">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-100">
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </h2>
                <button
                  onClick={() => {
                    setShowCategoryForm(false);
                    setEditingCategory(null);
                  }}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <form onSubmit={handleCategorySubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors bg-gray-700 text-gray-100"
                  placeholder="Enter category name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors bg-gray-700 text-gray-100"
                  placeholder="Optional description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Color
                </label>
                <div className="flex items-center space-x-3 mb-3">
                  <input
                    type="color"
                    value={categoryFormData.color}
                    onChange={(e) => setCategoryFormData(prev => ({ ...prev, color: e.target.value }))}
                    className="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer"
                  />
                  <span className="text-sm text-gray-400">{categoryFormData.color}</span>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {predefinedColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setCategoryFormData(prev => ({ ...prev, color }))}
                      className={`w-8 h-8 rounded-lg border-2 transition-all duration-200 cursor-pointer ${
                        categoryFormData.color === color 
                          ? 'border-gray-300 scale-110' 
                          : 'border-gray-600 hover:border-gray-500'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryForm(false);
                    setEditingCategory(null);
                  }}
                  className="px-4 py-2 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200"
                >
                  {editingCategory ? 'Update' : 'Create'} Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <TaxonomyModal
        isOpen={modalOpen}
        onClose={closeModal}
        data={modalData}
        onSubmit={handleModalSubmit}
      />
      
      <BulkTagModal
        isOpen={bulkModalOpen}
        onClose={() => {
          setBulkModalOpen(false);
          setBulkModalParent(null);
          setExistingTagsForModal([]);
        }}
        parentName={bulkModalParent?.name || ''}
        parentType={bulkModalParent?.type || 'category'}
        existingTags={existingTagsForModal}
        onSubmit={handleBulkTagSubmit}
      />
    </div>
  );
}
