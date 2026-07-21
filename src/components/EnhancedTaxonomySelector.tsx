import { useState, useEffect } from 'react';
import { Tag, X, Plus, Hash, Folder, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { type Category, type Subcategory } from '../lib/supabase';

interface SubcategoryWithCategory extends Subcategory {
  category: Category;
}

interface TagAssignment {
  tag: string;
  subcategoryId: string;
  subcategoryName: string;
  categoryName: string;
  categoryColor: string;
}

interface EnhancedTaxonomySelectorProps {
  selectedCategories: string[];
  allCategories: Category[];
  availableSubcategories: SubcategoryWithCategory[];
  selectedSubcategories: string[];
  selectedTags: string[];
  tagAssignments: TagAssignment[];
  onSubcategoryToggle: (subcategoryId: string) => void;
  onTagAssignmentAdd: (assignment: TagAssignment) => void;
  onTagAssignmentRemove: (tag: string, subcategoryId: string) => void;
  availableTags: string[];
}

export function EnhancedTaxonomySelector({
  selectedCategories,
  allCategories,
  availableSubcategories,
  selectedSubcategories,
  tagAssignments,
  onSubcategoryToggle,
  onTagAssignmentAdd,
  onTagAssignmentRemove,
  availableTags
}: EnhancedTaxonomySelectorProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showTagAssignmentModal, setShowTagAssignmentModal] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [selectedSubcategoryForTag, setSelectedSubcategoryForTag] = useState<string>('');

  // Group subcategories by category
  const subcategoriesByCategory = availableSubcategories.reduce((acc, sub) => {
    const categoryId = sub.category_id;
    if (!acc[categoryId]) {
      acc[categoryId] = [];
    }
    acc[categoryId].push(sub);
    return acc;
  }, {} as Record<string, SubcategoryWithCategory[]>);

  // Get selected categories data
  const selectedCategoriesData = allCategories.filter(cat => 
    selectedCategories.includes(cat.id)
  );

  const toggleCategoryExpansion = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const handleAddTagAssignment = () => {
    if (newTagInput.trim() && selectedSubcategoryForTag) {
      const subcategory = availableSubcategories.find(sub => sub.id === selectedSubcategoryForTag);
      if (subcategory) {
        const assignment: TagAssignment = {
          tag: newTagInput.trim(),
          subcategoryId: subcategory.id,
          subcategoryName: subcategory.name,
          categoryName: subcategory.category.name,
          categoryColor: subcategory.category.color
        };
        onTagAssignmentAdd(assignment);
        setNewTagInput('');
        setSelectedSubcategoryForTag('');
        setShowTagAssignmentModal(false);
      }
    }
  };

  const getTagsForSubcategory = (subcategoryId: string) => {
    return tagAssignments.filter(assignment => assignment.subcategoryId === subcategoryId);
  };

  // Auto-expand categories when subcategories are selected
  useEffect(() => {
    const categoriesToExpand = new Set<string>();
    selectedSubcategories.forEach(subId => {
      const subcategory = availableSubcategories.find(sub => sub.id === subId);
      if (subcategory) {
        categoriesToExpand.add(subcategory.category_id);
      }
    });
    setExpandedCategories(categoriesToExpand);
  }, [selectedSubcategories, availableSubcategories]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Folder className="w-5 h-5 text-primary shrink-0" />
          <h3 className="text-lg font-medium text-foreground truncate">Enhanced Taxonomy Selection</h3>
        </div>
        {selectedSubcategories.length > 0 && (
          <button
            onClick={() => setShowTagAssignmentModal(true)}
            className="btn-primary shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Smart Tag</span>
          </button>
        )}
      </div>

      {/* Categories and Subcategories */}
      <div className="space-y-4">
        {selectedCategoriesData.map(category => (
          <div key={category.id} className="border border-border rounded-lg overflow-hidden bg-card">
            {/* Category Header */}
            <div 
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/40 transition-colors duration-150"
              style={{ borderLeft: `4px solid ${category.color}` }}
              onClick={() => toggleCategoryExpansion(category.id)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-4 h-4 shrink-0 rounded-full"
                  style={{ backgroundColor: category.color }}
                ></div>
                <h4 className="font-medium text-foreground truncate">{category.name}</h4>
                <span className="text-sm text-muted-foreground shrink-0">
                  ({subcategoriesByCategory[category.id]?.length || 0} subcategories)
                </span>
              </div>
              {expandedCategories.has(category.id) ? (
                <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
              )}
            </div>

            {/* Subcategories */}
            {expandedCategories.has(category.id) && subcategoriesByCategory[category.id] && (
              <div className="p-4 bg-muted/30 space-y-3">
                <h5 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Subcategories
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {subcategoriesByCategory[category.id].map(subcategory => {
                    const isSelected = selectedSubcategories.includes(subcategory.id);
                    const tagsForSubcategory = getTagsForSubcategory(subcategory.id);
                    
                    return (
                      <div key={subcategory.id} className="space-y-2">
                        {/* Subcategory Item */}
                        <div
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                            isSelected
                              ? 'border-success bg-success/10 shadow-card-hover'
                              : 'border-border hover:border-success/40 bg-card'
                          }`}
                          style={{ 
                            borderLeftColor: subcategory.color || category.color,
                            borderLeftWidth: '4px'
                          }}
                          onClick={() => onSubcategoryToggle(subcategory.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="w-3 h-3 shrink-0 rounded-full"
                                style={{ backgroundColor: subcategory.color || category.color }}
                              ></div>
                              <span className="text-sm font-medium text-foreground truncate">
                                {subcategory.name}
                              </span>
                              {tagsForSubcategory.length > 0 && (
                                <span className="text-xs text-muted-foreground shrink-0">
                                  ({tagsForSubcategory.length} tags)
                                </span>
                              )}
                            </div>
                            {isSelected && (
                              <div className="w-5 h-5 shrink-0 rounded-full bg-success flex items-center justify-center">
                                <Check className="w-3 h-3 text-success-foreground" />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Tags for this subcategory */}
                        {isSelected && tagsForSubcategory.length > 0 && (
                          <div className="ml-4 pl-4 border-l-2 border-border space-y-2">
                            <div className="flex items-center gap-2">
                              <Hash className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground uppercase tracking-wide">Tags</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {tagsForSubcategory.map(assignment => (
                                <div
                                  key={`${assignment.subcategoryId}-${assignment.tag}`}
                                  className="category-tag gap-1 pr-1"
                                >
                                  <Tag className="w-3 h-3" />
                                  <span>{assignment.tag}</span>
                                  <button
                                    onClick={() => onTagAssignmentRemove(assignment.tag, assignment.subcategoryId)}
                                    aria-label={`Remove tag ${assignment.tag}`}
                                    className="ml-0.5 p-1 rounded-full text-primary/70 hover:text-primary hover:bg-primary/20 transition-colors duration-150"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tag Assignment Modal */}
      {showTagAssignmentModal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="smart-tag-modal-title"
        >
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:items-center">
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity animate-fade-in"
              onClick={() => {
                setShowTagAssignmentModal(false);
                setNewTagInput('');
                setSelectedSubcategoryForTag('');
              }}
              aria-hidden="true"
            />
            <div className="animate-scale-in relative transform overflow-hidden rounded-xl bg-card text-left align-middle shadow-modal transition-all my-8 w-full max-w-md flex flex-col border border-border max-h-[90vh]">
              <div className="flex items-start justify-between gap-4 px-5 py-4 sm:px-6 border-b border-border shrink-0">
                <div>
                  <h3 id="smart-tag-modal-title" className="text-lg font-semibold text-foreground">Add Smart Tag</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Assign a tag to a specific subcategory
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowTagAssignmentModal(false);
                    setNewTagInput('');
                    setSelectedSubcategoryForTag('');
                  }}
                  aria-label="Close dialog"
                  className="rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent p-1.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-5 py-5 sm:px-6 space-y-4 overflow-y-auto text-left">
                {/* Tag Input */}
                <div className="form-group">
                  <label className="form-label">
                    Tag Name
                  </label>
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    placeholder="Enter tag name..."
                    className="input-primary"
                    autoFocus
                  />
                </div>

                {/* Subcategory Selection */}
                <div className="form-group">
                  <label className="form-label">
                    Assign to Subcategory
                  </label>
                  <select
                    value={selectedSubcategoryForTag}
                    onChange={(e) => setSelectedSubcategoryForTag(e.target.value)}
                    className="input-primary"
                  >
                    <option value="">Select subcategory...</option>
                    {availableSubcategories
                      .filter(sub => selectedSubcategories.includes(sub.id))
                      .map(subcategory => (
                        <option key={subcategory.id} value={subcategory.id}>
                          {subcategory.category.name} → {subcategory.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Available Tags Suggestions */}
                {availableTags.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">
                      Or select from existing tags:
                    </label>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {availableTags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => setNewTagInput(tag)}
                          className="px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded border border-border hover:bg-secondary/70 transition-colors duration-150"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-5 py-4 sm:px-6 border-t border-border flex justify-end gap-3 shrink-0">
                <button
                  onClick={() => {
                    setShowTagAssignmentModal(false);
                    setNewTagInput('');
                    setSelectedSubcategoryForTag('');
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTagAssignment}
                  disabled={!newTagInput.trim() || !selectedSubcategoryForTag}
                  className="btn-primary"
                >
                  Add Tag
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {tagAssignments.length > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
          <h4 className="text-sm font-medium text-primary mb-3">Tag Assignment Summary</h4>
          <div className="space-y-2">
            {Object.entries(
              tagAssignments.reduce((acc, assignment) => {
                const key = `${assignment.categoryName} → ${assignment.subcategoryName}`;
                if (!acc[key]) {
                  acc[key] = { 
                    color: assignment.categoryColor, 
                    tags: [] 
                  };
                }
                acc[key].tags.push(assignment.tag);
                return acc;
              }, {} as Record<string, { color: string; tags: string[] }>)
            ).map(([subcategoryPath, { color, tags }]) => (
              <div key={subcategoryPath} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                ></div>
                <span className="text-sm text-foreground">{subcategoryPath}:</span>
                <span className="text-sm text-primary">{tags.join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
