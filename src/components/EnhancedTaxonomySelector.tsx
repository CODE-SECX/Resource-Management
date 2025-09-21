import React, { useState, useEffect } from 'react';
import { Tag, X, Plus, Hash, Folder, ChevronDown, ChevronRight } from 'lucide-react';
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
  selectedTags,
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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Folder className="w-5 h-5 text-indigo-400" />
          <h3 className="text-lg font-medium text-gray-300">Enhanced Taxonomy Selection</h3>
        </div>
        {selectedSubcategories.length > 0 && (
          <button
            onClick={() => setShowTagAssignmentModal(true)}
            className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Smart Tag</span>
          </button>
        )}
      </div>

      {/* Categories and Subcategories */}
      <div className="space-y-4">
        {selectedCategoriesData.map(category => (
          <div key={category.id} className="border border-gray-600 rounded-lg overflow-hidden">
            {/* Category Header */}
            <div 
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-700/50 transition-colors"
              style={{ backgroundColor: `${category.color}20`, borderLeft: `4px solid ${category.color}` }}
              onClick={() => toggleCategoryExpansion(category.id)}
            >
              <div className="flex items-center space-x-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: category.color }}
                ></div>
                <h4 className="font-medium text-gray-200">{category.name}</h4>
                <span className="text-sm text-gray-400">
                  ({subcategoriesByCategory[category.id]?.length || 0} subcategories)
                </span>
              </div>
              {expandedCategories.has(category.id) ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
            </div>

            {/* Subcategories */}
            {expandedCategories.has(category.id) && subcategoriesByCategory[category.id] && (
              <div className="p-4 bg-gray-800/30 space-y-3">
                <h5 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
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
                              ? 'border-emerald-500 bg-emerald-500/10 shadow-md'
                              : 'border-gray-600 hover:border-gray-500 bg-gray-700/50'
                          }`}
                          style={{ 
                            borderLeftColor: subcategory.color || category.color,
                            borderLeftWidth: '4px'
                          }}
                          onClick={() => onSubcategoryToggle(subcategory.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: subcategory.color || category.color }}
                              ></div>
                              <span className="text-sm font-medium text-gray-200">
                                {subcategory.name}
                              </span>
                              {tagsForSubcategory.length > 0 && (
                                <span className="text-xs text-gray-400">
                                  ({tagsForSubcategory.length} tags)
                                </span>
                              )}
                            </div>
                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                                <span className="text-white text-xs">✓</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Tags for this subcategory */}
                        {isSelected && tagsForSubcategory.length > 0 && (
                          <div className="ml-4 pl-4 border-l-2 border-gray-600/30 space-y-2">
                            <div className="flex items-center space-x-2">
                              <Hash className="w-3 h-3 text-gray-500" />
                              <span className="text-xs text-gray-500 uppercase tracking-wide">Tags</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {tagsForSubcategory.map(assignment => (
                                <div
                                  key={`${assignment.subcategoryId}-${assignment.tag}`}
                                  className="flex items-center space-x-1 px-2 py-1 bg-indigo-600/20 text-indigo-300 rounded-md text-xs border border-indigo-500/30"
                                >
                                  <Tag className="w-3 h-3" />
                                  <span>{assignment.tag}</span>
                                  <button
                                    onClick={() => onTagAssignmentRemove(assignment.tag, assignment.subcategoryId)}
                                    className="text-indigo-400 hover:text-indigo-300"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-md w-full border border-gray-700">
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-gray-100">Add Smart Tag</h3>
              <p className="text-sm text-gray-400 mt-1">
                Assign a tag to a specific subcategory
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Tag Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tag Name
                </label>
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  placeholder="Enter tag name..."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              {/* Subcategory Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Assign to Subcategory
                </label>
                <select
                  value={selectedSubcategoryForTag}
                  onChange={(e) => setSelectedSubcategoryForTag(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Or select from existing tags:
                  </label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {availableTags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => setNewTagInput(tag)}
                        className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded border border-gray-600 hover:bg-gray-600 transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-700 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowTagAssignmentModal(false);
                  setNewTagInput('');
                  setSelectedSubcategoryForTag('');
                }}
                className="px-4 py-2 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTagAssignment}
                disabled={!newTagInput.trim() || !selectedSubcategoryForTag}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Tag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {tagAssignments.length > 0 && (
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-300 mb-3">Tag Assignment Summary</h4>
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
              <div key={subcategoryPath} className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                ></div>
                <span className="text-sm text-gray-300">{subcategoryPath}:</span>
                <span className="text-sm text-blue-300">{tags.join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
