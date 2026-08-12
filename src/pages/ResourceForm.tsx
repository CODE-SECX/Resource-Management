import React, { useState, useEffect, useRef } from 'react';
import {
  supabase,
  type Category,
  type Tag,
  getSubcategories,
  getTagsByCategories,
  getTagsForSubcategories,
  getTags,
  setResourceSubcategories,
  setResourceTags,
} from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Tag as TagIcon, X, ArrowLeft, Save, FileText, Folder, Lightbulb, Search, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { RichTextEditor } from '../components/RichTextEditor';
import { ColorCodedSubcategorySelector } from '../components/ColorCodedSubcategorySelector';
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

  // Taxonomy-scoped tag suggestions (names for display, full objects for ID lookup on save)
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [suggestedTagObjects, setSuggestedTagObjects] = useState<Tag[]>([]);
  // All tags in the user's taxonomy (restricts free-typing to existing tags only)
  const [allUserTagObjects, setAllUserTagObjects] = useState<Tag[]>([]);

  useEffect(() => {
    if (user) {
      fetchAllCategoriesForForm();
      if (isEditing && id) {
        fetchResourceItem(id);
      }
      fetchAllUserTags();
    }
  }, [user, id, isEditing]);

  // Fetch the complete set of existing taxonomy tags for this user.
  // Used for: (1) the search pool so the picker never creates new tags,
  // (2) ID resolution on save.
  const fetchAllUserTags = async () => {
    if (!user) return;
    try {
      const tags = await getTags(user.id);
      setAllUserTagObjects(tags);
      console.log('[ResourceForm] All user taxonomy tags loaded:', tags.map(t => t.name));
    } catch (error) {
      console.error('[ResourceForm] Error fetching all user tags:', error);
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
        const subcategoriesWithCategory = allSubcats
          .map(sub => {
            const cat = allCategories.find(c => c.id === sub.category_id);
            return cat ? { ...sub, category: cat } : null;
          })
          .filter((s): s is any => s !== null);
        setAvailableSubcategoriesWithCategory(subcategoriesWithCategory);
      } catch (error) {
        console.error('Error fetching enhanced subcategories:', error);
      }
    })();
  }, [user, formData.categoryIds, allCategories]);

  // ── Tag suggestion loading ──────────────────────────────────────────────
  // Runs whenever selected categories OR subcategories change.
  // Stores full Tag objects (for ID resolution on save) and names (for display).
  useEffect(() => {
    const loadTagSuggestions = async () => {
      if (!user) return;

      console.log('[TagSuggestions/ResourceForm] Effect fired — categoryIds:', formData.categoryIds, '| selectedFormSubcategories (IDs):', selectedFormSubcategories);

      if (formData.categoryIds.length === 0) {
        console.log('[TagSuggestions/ResourceForm] No categories selected, clearing scoped suggestions');
        setSuggestedTags([]);
        setSuggestedTagObjects([]);
        return;
      }

      try {
        // 1. Category-level tags (subcategory_id IS NULL)
        console.log('[TagSuggestions/ResourceForm] Fetching category-level tags for categoryIds:', formData.categoryIds);
        const catTags = await getTagsByCategories(user.id, formData.categoryIds);
        console.log('[TagSuggestions/ResourceForm] Category-level tags returned:', catTags.map(t => t.name));

        // 2. Subcategory-level tags — selectedFormSubcategories holds UUIDs
        let subcatTags: Tag[] = [];
        if (selectedFormSubcategories.length > 0) {
          console.log('[TagSuggestions/ResourceForm] Fetching subcategory-level tags for subcategoryIds:', selectedFormSubcategories);
          subcatTags = await getTagsForSubcategories(user.id, selectedFormSubcategories);
          console.log('[TagSuggestions/ResourceForm] Subcategory-level tags returned:', subcatTags.map(t => t.name));
        } else {
          console.log('[TagSuggestions/ResourceForm] No subcategories selected, skipping subcategory tag fetch');
        }

        // 3. Merge & deduplicate by id, sort by name
        const seenIds = new Set<string>();
        const merged: Tag[] = [];
        for (const tag of [...catTags, ...subcatTags]) {
          if (!seenIds.has(tag.id)) {
            seenIds.add(tag.id);
            merged.push(tag);
          }
        }
        merged.sort((a, b) => a.name.localeCompare(b.name));

        console.log('[TagSuggestions/ResourceForm] Final merged suggestedTags:', merged.map(t => t.name));
        setSuggestedTagObjects(merged);
        setSuggestedTags(merged.map(t => t.name));
      } catch (e) {
        console.error('[TagSuggestions/ResourceForm] Error fetching tag suggestions:', e);
      }
    };

    loadTagSuggestions();
  }, [user, formData.categoryIds, selectedFormSubcategories]);

  // All known tag names: scoped suggestions + full user taxonomy (for search pool)
  const allKnownTagNames = Array.from(
    new Set([...suggestedTags, ...allUserTagObjects.map(t => t.name)])
  ).sort();

  const handleTagInputChange = (value: string) => {
    setTagInputValue(value);
    if (value.trim()) {
      const filtered = allKnownTagNames
        .filter(name => name.toLowerCase().includes(value.toLowerCase()) && !selectedFormTags.includes(name))
        .slice(0, 8);
      setFilteredTagSuggestions(filtered);
      setShowTagSuggestions(filtered.length > 0);
    } else {
      setFilteredTagSuggestions([]);
      setShowTagSuggestions(false);
    }
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const typed = tagInputValue.trim();
      if (!typed) return;
      const exactMatch = allKnownTagNames.find(name => name.toLowerCase() === typed.toLowerCase());
      if (exactMatch && !selectedFormTags.includes(exactMatch)) {
        setSelectedFormTags(prev => [...prev, exactMatch]);
        setTagInputValue('');
        setFilteredTagSuggestions([]);
        setShowTagSuggestions(false);
      }
      // No exact match → do nothing (hint shown in UI)
    } else if (e.key === 'Escape') {
      setShowTagSuggestions(false);
    }
  };

  const addTagFromSuggestion = (tag: string) => {
    if (!selectedFormTags.includes(tag)) {
      setSelectedFormTags(prev => [...prev, tag]);
    }
    setTagInputValue('');
    setFilteredTagSuggestions([]);
    setShowTagSuggestions(false);
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

  // Resolve tag names → existing tag IDs without creating new tags.
  const resolveTagIds = (tagNames: string[]): string[] => {
    const pool = [...suggestedTagObjects, ...allUserTagObjects];
    const seenIds = new Set<string>();
    const ids: string[] = [];
    for (const name of tagNames) {
      const found = pool.find(t => t.name.toLowerCase() === name.toLowerCase());
      if (found && !seenIds.has(found.id)) {
        seenIds.add(found.id);
        ids.push(found.id);
      }
    }
    return ids;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const finalTags = selectedFormTags;
      const resourceData = {
        title: formData.title,
        description: formData.description,
        url: formData.url,
        html_content: formData.html_content || null,
        tags: finalTags,
        subcategories: selectedFormSubcategories,
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

      // Handle subcategories — stored as UUIDs
      if (selectedFormSubcategories.length > 0) {
        const existingSubcats = selectedFormSubcategories.map(id => {
          const subcategory = availableSubcategoriesWithCategory.find(sub => sub.id === id);
          return subcategory ? { id: subcategory.id, name: subcategory.name } : null;
        }).filter(Boolean) as { id: string; name: string }[];

        if (existingSubcats.length > 0) {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          const validSubcategoryIds = Array.from(new Set(existingSubcats.map(s => s.id)))
            .filter(id => uuidRegex.test(id));
          if (validSubcategoryIds.length > 0) {
            await setResourceSubcategories(resourceId, validSubcategoryIds);
          }
        }
      }

      // Link tags by resolving their existing IDs — no upsert / no new tag creation
      if (finalTags.length > 0) {
        const tagIds = resolveTagIds(finalTags);
        console.log('[ResourceForm] Resolved tag IDs for save:', tagIds, '(from names:', finalTags, ')');
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

  const typedNoMatch =
    tagInputValue.trim().length > 0 &&
    filteredTagSuggestions.length === 0 &&
    !allKnownTagNames.some(n => n.toLowerCase() === tagInputValue.trim().toLowerCase());

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

              {/* HTML Content - spans full width */}
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

              {/* Tags - spans full width */}
              <div className="sm:col-span-2 lg:col-span-4 form-group">
                <label className="form-label flex items-center gap-2">
                  <TagIcon className="w-4 h-4 text-primary" />
                  Tags
                </label>

                {/* Selected tag chips */}
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

                {/* Search input */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Search className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={tagInputValue}
                    onChange={(e) => handleTagInputChange(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    className="input-primary pl-9"
                    placeholder="Search existing tags…"
                  />
                  {showTagSuggestions && filteredTagSuggestions.length > 0 && (
                    <div className="absolute z-20 w-full mt-2 bg-popover border border-border rounded-lg shadow-dropdown max-h-48 overflow-y-auto">
                      {filteredTagSuggestions.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => addTagFromSuggestion(tag)}
                          className="w-full px-4 py-2 text-left text-sm text-popover-foreground hover:bg-accent transition-colors duration-150 flex items-center gap-2"
                        >
                          <TagIcon className="w-3 h-3 text-muted-foreground shrink-0" />
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* "Tag not found" hint */}
                {typedNoMatch && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    Tag not found — create it from the <strong>Taxonomy</strong> screen first.
                  </p>
                )}

                {/* Relevant tags for selected categories/subcategories */}
                {suggestedTags.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-2">
                      Relevant tags for selected {selectedFormSubcategories.length > 0 ? 'categories & subcategories' : 'categories'}:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedTags
                        .filter(t => !selectedFormTags.includes(t))
                        .map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => addTagFromSuggestion(tag)}
                            className="px-2.5 py-1 text-xs rounded-full border border-border bg-secondary/60 text-secondary-foreground hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors duration-150"
                          >
                            {tag}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                <p className="form-hint mt-2">
                  Search and select from existing taxonomy tags. To create new tags, use the <strong>Taxonomy</strong> screen.
                </p>
              </div>

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
