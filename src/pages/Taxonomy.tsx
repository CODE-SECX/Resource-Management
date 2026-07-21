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
  Edit2, 
  Trash2, 
  X, 
  BarChart3, 
  Layers, 
  Hash,
  TrendingUp,
  Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import { TreeView, type TreeNode } from '../components/TreeView';
import { TaxonomyModal, type TaxonomyModalData } from '../components/TaxonomyModal';
import { BulkTagModal } from '../components/BulkTagModal';
import { PageHeader } from '../components/ui/PageHeader';
import { Skeleton } from '../components/ui/Skeleton';

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
      <div className="container-wide space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="space-y-2">
            <Skeleton height={32} width={260} />
            <Skeleton height={16} width={360} />
          </div>
          <Skeleton height={40} width={130} rounded="lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card p-6 flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton height={12} width={70} />
                <Skeleton height={24} width={40} />
              </div>
              <Skeleton width={48} height={48} rounded="lg" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="card p-6 space-y-3">
            <Skeleton height={20} width={140} />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={64} />
            ))}
          </div>
          <div className="xl:col-span-2 card p-6 space-y-3">
            <Skeleton height={20} width={180} />
            <Skeleton height={40} />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={44} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-wide space-y-8">
      <PageHeader
        title="Taxonomy Management"
        subtitle="Professional organization system for categories, subcategories, and tags"
        actions={
          <button
            onClick={async () => {
              await fetchCategories();
              await fetchCategoryStats();
              await fetchTotalStats();
              bumpTree();
            }}
            className="btn-primary"
          >
            <Activity className="w-4 h-4" />
            Refresh All
          </button>
        }
      />

      {/* Statistics Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Categories</p>
              <p className="text-2xl font-bold text-foreground">{totalStats.categories}</p>
            </div>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Layers className="w-6 h-6 text-primary" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Subcategories</p>
              <p className="text-2xl font-bold text-foreground">{totalStats.subcategories}</p>
            </div>
            <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
              <Folder className="w-6 h-6 text-success" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Tags</p>
              <p className="text-2xl font-bold text-foreground">{totalStats.tags}</p>
            </div>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Hash className="w-6 h-6 text-primary" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Resources</p>
              <p className="text-2xl font-bold text-foreground">{totalStats.resources}</p>
            </div>
            <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-warning" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Learning Items</p>
              <p className="text-2xl font-bold text-foreground">{totalStats.learning}</p>
            </div>
            <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-destructive" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Categories Management Card */}
        <div className="xl:col-span-1">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 shrink-0 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Layers className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-foreground">Categories</h2>
                  <p className="text-sm text-muted-foreground">Manage your main categories</p>
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
                aria-label="Add category"
                className="btn-primary px-3 py-2 shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {categories.map((category) => {
                const categoryStatsData = categoryStats[category.id] || { resources: 0, learning: 0 };

                return (
                  <div key={category.id} className="bg-muted/40 rounded-lg p-4 border border-border hover:bg-accent/50 transition-colors duration-150">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: category.color }}
                        >
                          <Tag className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-foreground truncate">
                            {category.name}
                          </h3>
                          {category.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {category.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-primary">{categoryStatsData.resources} resources</span>
                            <span className="text-xs text-success">{categoryStatsData.learning} learning</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleCategoryEdit(category)}
                          aria-label={`Edit ${category.name}`}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-accent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCategoryDelete(category.id)}
                          aria-label={`Delete ${category.name}`}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {categories.length === 0 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Layers className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-medium text-foreground mb-2">No categories yet</h3>
                <p className="text-xs text-muted-foreground mb-4">Create your first category to get started</p>
              </div>
            )}
          </div>
        </div>

        {/* Taxonomy Tree Card */}
        <div className="xl:col-span-2">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 shrink-0 bg-success/10 rounded-lg flex items-center justify-center">
                  <Folder className="w-5 h-5 text-success" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-foreground">Taxonomy Hierarchy</h2>
                  <p className="text-sm text-muted-foreground">Complete organizational structure</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground hidden sm:block shrink-0">
                Click + to add • Hover for actions
              </div>
            </div>

            <div className="bg-muted/40 rounded-lg p-4 border border-border mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Search className="w-4 h-4 text-primary" />
                <label className="text-sm font-medium text-foreground">Global Search</label>
              </div>
              <input
                value={treeFilter}
                onChange={(e) => setTreeFilter(e.target.value)}
                placeholder="Search across all categories, subcategories, and tags..."
                className="input-primary"
              />
            </div>

            <div className="bg-muted/20 rounded-lg p-4 max-h-96 overflow-y-auto border border-border/60">
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
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="taxonomy-category-modal-title"
        >
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:items-center">
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity animate-fade-in"
              onClick={() => {
                setShowCategoryForm(false);
                setEditingCategory(null);
              }}
              aria-hidden="true"
            />
            <div className="animate-scale-in relative transform overflow-hidden rounded-xl bg-card text-left align-middle shadow-modal transition-all my-8 w-full max-w-md flex flex-col border border-border max-h-[90vh]">
              <div className="flex items-start justify-between gap-4 px-5 py-4 sm:px-6 border-b border-border shrink-0">
                <h2 id="taxonomy-category-modal-title" className="text-lg sm:text-xl font-semibold text-foreground">
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </h2>
                <button
                  onClick={() => {
                    setShowCategoryForm(false);
                    setEditingCategory(null);
                  }}
                  aria-label="Close dialog"
                  className="rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent p-1.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCategorySubmit} className="px-5 py-5 sm:px-6 space-y-4 overflow-y-auto text-left">
                <div className="form-group">
                  <label className="form-label">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={categoryFormData.name}
                    onChange={(e) => setCategoryFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="input-primary"
                    placeholder="Enter category name"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Description
                  </label>
                  <textarea
                    value={categoryFormData.description}
                    onChange={(e) => setCategoryFormData(prev => ({ ...prev, description: e.target.value }))}
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
                      value={categoryFormData.color}
                      onChange={(e) => setCategoryFormData(prev => ({ ...prev, color: e.target.value }))}
                      aria-label="Custom color"
                      className="w-12 h-10 border border-input rounded-lg cursor-pointer bg-card"
                    />
                    <span className="text-sm text-muted-foreground">{categoryFormData.color}</span>
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {predefinedColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setCategoryFormData(prev => ({ ...prev, color }))}
                        aria-label={`Select color ${color}`}
                        className={`w-8 h-8 rounded-lg border-2 transition-all duration-200 cursor-pointer ${
                          categoryFormData.color === color
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
                      setShowCategoryForm(false);
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
