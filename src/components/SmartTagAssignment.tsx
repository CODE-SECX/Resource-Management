import { useState } from 'react';
import { Tag, X, Plus, Hash, Target, AlertCircle } from 'lucide-react';
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

interface SmartTagAssignmentProps {
  selectedSubcategories: string[]; // IDs from ColorCodedSelector
  availableSubcategories: SubcategoryWithCategory[];
  tagAssignments: TagAssignment[];
  onTagAssignmentAdd: (assignment: TagAssignment) => void;
  onTagAssignmentRemove: (tag: string, subcategoryId: string) => void;
  availableTags: string[];
  selectedSubcategoryNames?: string[]; // Names from text input
}

export function SmartTagAssignment({
  selectedSubcategories,
  availableSubcategories,
  tagAssignments,
  onTagAssignmentAdd,
  onTagAssignmentRemove,
  availableTags,
  selectedSubcategoryNames = []
}: SmartTagAssignmentProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [selectedSubcategoryForTag, setSelectedSubcategoryForTag] = useState<string>('');
  const [assignToAllSelected, setAssignToAllSelected] = useState(false);

  const selectedSubcategoriesData = availableSubcategories.filter(sub => 
    selectedSubcategories.includes(sub.id)
  );

  const handleAddTag = () => {
    if (!newTagInput.trim()) return;

    if (assignToAllSelected) {
      // Add tag to all selected subcategories
      selectedSubcategoriesData.forEach(subcategory => {
        const assignment: TagAssignment = {
          tag: newTagInput.trim(),
          subcategoryId: subcategory.id,
          subcategoryName: subcategory.name,
          categoryName: subcategory.category.name,
          categoryColor: subcategory.category.color
        };
        onTagAssignmentAdd(assignment);
      });
    } else if (selectedSubcategoryForTag) {
      // Add tag to specific subcategory
      const subcategory = selectedSubcategoriesData.find(sub => sub.id === selectedSubcategoryForTag);
      if (subcategory) {
        const assignment: TagAssignment = {
          tag: newTagInput.trim(),
          subcategoryId: subcategory.id,
          subcategoryName: subcategory.name,
          categoryName: subcategory.category.name,
          categoryColor: subcategory.category.color
        };
        onTagAssignmentAdd(assignment);
      }
    }

    // Reset form
    setNewTagInput('');
    setSelectedSubcategoryForTag('');
    setAssignToAllSelected(false);
    setShowAddForm(false);
  };

  const getTagsForSubcategory = (subcategoryId: string) => {
    return tagAssignments.filter(assignment => assignment.subcategoryId === subcategoryId);
  };

  if (selectedSubcategories.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Hash className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Select subcategories first to assign tags</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Target className="w-5 h-5 text-indigo-400" />
          <h3 className="text-lg font-medium text-gray-300">Smart Tag Assignment</h3>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Tag</span>
        </button>
      </div>

      {/* Add Tag Form */}
      {showAddForm && (
        <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600 space-y-4">
          <h4 className="text-sm font-medium text-gray-300">Add New Tag</h4>
          
          {/* Tag Input */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Tag Name</label>
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              placeholder="Enter tag name..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>

          {/* Assignment Options */}
          <div className="space-y-3">
            <label className="block text-sm text-gray-400">Assignment Strategy</label>
            
            {/* Assign to all */}
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                checked={assignToAllSelected}
                onChange={(e) => {
                  setAssignToAllSelected(e.target.checked);
                  if (e.target.checked) setSelectedSubcategoryForTag('');
                }}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-300">
                Assign to all selected subcategories ({selectedSubcategories.length + selectedSubcategoryNames.length})
              </span>
            </label>

            {/* Assign to specific */}
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                checked={!assignToAllSelected}
                onChange={(e) => {
                  setAssignToAllSelected(!e.target.checked);
                }}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-300">Assign to specific subcategory</span>
            </label>

            {/* Specific subcategory selection */}
            {!assignToAllSelected && (
              <div className="ml-6">
                <select
                  value={selectedSubcategoryForTag}
                  onChange={(e) => setSelectedSubcategoryForTag(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select subcategory...</option>
                  {selectedSubcategoriesData.map(subcategory => (
                    <option key={subcategory.id} value={subcategory.id}>
                      {subcategory.category.name} → {subcategory.name}
                    </option>
                  ))}
                  {selectedSubcategoryNames.map(name => (
                    <option key={`name-${name}`} value={`name-${name}`}>
                      {name} (new)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Available Tags */}
          {availableTags.length > 0 && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">Quick Select from Existing Tags</label>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {availableTags.slice(0, 10).map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setNewTagInput(tag)}
                    className="px-2 py-1 text-xs bg-gray-600 text-gray-300 rounded border border-gray-500 hover:bg-gray-500 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setNewTagInput('');
                setSelectedSubcategoryForTag('');
                setAssignToAllSelected(false);
              }}
              className="px-4 py-2 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddTag}
              disabled={!newTagInput.trim() || (!assignToAllSelected && !selectedSubcategoryForTag)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add Tag
            </button>
          </div>
        </div>
      )}

      {/* Current Assignments by Subcategory */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
          Current Tag Assignments
        </h4>
        
        {selectedSubcategoriesData.map(subcategory => {
          const tagsForSubcategory = getTagsForSubcategory(subcategory.id);
          
          return (
            <div key={subcategory.id} className="space-y-2">
              {/* Subcategory Header */}
              <div 
                className="flex items-center space-x-3 p-3 rounded-lg border-l-4"
                style={{ 
                  backgroundColor: `${subcategory.category.color}15`,
                  borderLeftColor: subcategory.category.color 
                }}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: subcategory.category.color }}
                ></div>
                <span className="text-sm font-medium text-gray-200">
                  {subcategory.category.name} → {subcategory.name}
                </span>
                <span className="text-xs text-gray-400">
                  ({tagsForSubcategory.length} tags)
                </span>
              </div>

              {/* Tags for this subcategory */}
              {tagsForSubcategory.length > 0 ? (
                <div className="ml-6 flex flex-wrap gap-2">
                  {tagsForSubcategory.map(assignment => (
                    <div
                      key={`${assignment.subcategoryId}-${assignment.tag}`}
                      className="flex items-center space-x-2 px-3 py-1.5 bg-indigo-600/20 text-indigo-300 rounded-lg text-sm border border-indigo-500/30"
                    >
                      <Tag className="w-3 h-3" />
                      <span>{assignment.tag}</span>
                      <button
                        type="button"
                        onClick={() => onTagAssignmentRemove(assignment.tag, assignment.subcategoryId)}
                        className="text-indigo-400 hover:text-indigo-300 ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ml-6 text-sm text-gray-500 italic">
                  No tags assigned yet
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Assignment Summary */}
      {tagAssignments.length > 0 && (
        <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <AlertCircle className="w-4 h-4 text-green-400" />
            <h4 className="text-sm font-medium text-green-300">Assignment Summary</h4>
          </div>
          <div className="text-sm text-green-200">
            <strong>{tagAssignments.length}</strong> tag assignments across{' '}
            <strong>{new Set(tagAssignments.map(a => a.subcategoryId)).size}</strong> subcategories
          </div>
          <div className="mt-2 text-xs text-green-300">
            Tags will be properly associated with their respective subcategories when the item is saved.
          </div>
        </div>
      )}
    </div>
  );
}
