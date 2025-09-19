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
import { Folder, Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { TreeView, type TreeNode } from '../components/TreeView';
import { TaxonomyModal, type TaxonomyModalData } from '../components/TaxonomyModal';
import { BulkTagModal } from '../components/BulkTagModal';

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

  useEffect(() => {
    if (!user) return;
    (async () => {
      await fetchCategories();
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

  // Smart add functionality with better UX
  const handleSmartAdd = (node: TreeNode) => {
    if (node.type === 'category') {
      // Show a professional choice dialog
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50';
      modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg p-6 max-w-md mx-4 border border-gray-700">
          <h3 class="text-lg font-semibold text-gray-100 mb-4">Add to "${node.label}"</h3>
          <div class="space-y-3">
            <button id="add-subcategory" class="w-full p-3 text-left bg-green-900/20 hover:bg-green-800/30 border border-green-700/30 rounded-lg transition-colors">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                  <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z"></path>
                  </svg>
                </div>
                <div>
                  <div class="text-gray-100 font-medium">Add Subcategory</div>
                  <div class="text-xs text-gray-400">Create a new subcategory under this category</div>
                </div>
              </div>
            </button>
            <button id="add-category-tag" class="w-full p-3 text-left bg-purple-900/20 hover:bg-purple-800/30 border border-purple-700/30 rounded-lg transition-colors">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                  <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"></path>
                  </svg>
                </div>
                <div>
                  <div class="text-gray-100 font-medium">Add Category-Level Tag</div>
                  <div class="text-xs text-gray-400">Create a tag directly under this category</div>
                </div>
              </div>
            </button>
          </div>
          <button id="cancel-choice" class="mt-4 w-full px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors">Cancel</button>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      const cleanup = () => document.body.removeChild(modal);
      
      modal.querySelector('#add-subcategory')?.addEventListener('click', () => {
        cleanup();
        openModal({
          mode: 'add-subcategory',
          parentId: node.id,
          parentName: node.label
        });
      });
      
      modal.querySelector('#add-category-tag')?.addEventListener('click', () => {
        cleanup();
        openModal({
          mode: 'add-category-tag',
          parentId: node.id,
          parentName: node.label
        });
      });
      
      modal.querySelector('#cancel-choice')?.addEventListener('click', cleanup);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) cleanup();
      });
    } else if (node.type === 'subcategory') {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="container-wide space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-50">Taxonomy Management</h1>
          <p className="text-gray-400">Professional hierarchy management for categories, subcategories, and tags</p>
        </div>
        <button
          onClick={fetchCategories}
          className="px-4 py-2 text-sm bg-gray-700 text-gray-200 rounded-lg border border-gray-600 hover:bg-gray-600 transition-colors"
        >
          <Plus className="w-4 h-4 inline mr-2" />
          Refresh
        </button>
      </div>

      {/* Professional Tree View */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-semibold text-gray-100">Taxonomy Hierarchy</h2>
          </div>
          <div className="text-sm text-gray-400">
            Click + to add • Edit/Delete via hover actions
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-gray-800/50 to-gray-700/30 rounded-lg p-4 border border-gray-600/30">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-400" />
                Global Search
              </label>
              <input
                value={treeFilter}
                onChange={(e) => setTreeFilter(e.target.value)}
                placeholder="Search across all categories, subcategories, and tags..."
                className="w-full px-4 py-2.5 border border-gray-600 rounded-lg bg-gray-700/80 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
              />
            </div>
            <div className="flex items-end">
              <div className="text-sm text-gray-400 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span><strong className="text-blue-300">Categories:</strong> Add single/bulk tags</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span><strong className="text-green-300">Subcategories:</strong> Copy all tags, add single/bulk</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <span><strong className="text-purple-300">Tags:</strong> Copy individual, edit, delete</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <TreeView
          rootNodes={treeRoots}
          loadChildren={loadTreeChildren}
          actionsByType={actionsByType as any}
          version={treeVersion}
          filter={treeFilter}
          className="mt-4"
        />
      </div>

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
