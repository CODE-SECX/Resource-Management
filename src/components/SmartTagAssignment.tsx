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
      <div className="text-center py-8 text-muted-foreground">
        <Hash className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Select subcategories first to assign tags</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Target className="w-5 h-5 text-primary shrink-0" />
          <h3 className="text-lg font-medium text-foreground truncate">Smart Tag Assignment</h3>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="btn-primary shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Tag</span>
        </button>
      </div>

      {/* Add Tag Form */}
      {showAddForm && (
        <div className="bg-muted/40 rounded-lg p-4 border border-border space-y-4">
          <h4 className="text-sm font-medium text-foreground">Add New Tag</h4>
          
          {/* Tag Input */}
          <div className="form-group">
            <label className="form-label">Tag Name</label>
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              placeholder="Enter tag name..."
              className="input-primary"
              autoFocus
            />
          </div>

          {/* Assignment Options */}
          <div className="space-y-3">
            <label className="form-label">Assignment Strategy</label>
            
            {/* Assign to all */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                checked={assignToAllSelected}
                onChange={(e) => {
                  setAssignToAllSelected(e.target.checked);
                  if (e.target.checked) setSelectedSubcategoryForTag('');
                }}
                className="text-primary focus:ring-ring/60"
              />
              <span className="text-sm text-foreground">
                Assign to all selected subcategories ({selectedSubcategories.length + selectedSubcategoryNames.length})
              </span>
            </label>

            {/* Assign to specific */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                checked={!assignToAllSelected}
                onChange={(e) => {
                  setAssignToAllSelected(!e.target.checked);
                }}
                className="text-primary focus:ring-ring/60"
              />
              <span className="text-sm text-foreground">Assign to specific subcategory</span>
            </label>

            {/* Specific subcategory selection */}
            {!assignToAllSelected && (
              <div className="ml-6">
                <select
                  value={selectedSubcategoryForTag}
                  onChange={(e) => setSelectedSubcategoryForTag(e.target.value)}
                  className="input-primary"
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
            <div className="form-group">
              <label className="form-label">Quick Select from Existing Tags</label>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {availableTags.slice(0, 10).map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setNewTagInput(tag)}
                    className="px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded border border-border hover:bg-secondary/70 transition-colors duration-150"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setNewTagInput('');
                setSelectedSubcategoryForTag('');
                setAssignToAllSelected(false);
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddTag}
              disabled={!newTagInput.trim() || (!assignToAllSelected && !selectedSubcategoryForTag)}
              className="btn-primary"
            >
              Add Tag
            </button>
          </div>
        </div>
      )}

      {/* Current Assignments by Subcategory */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Current Tag Assignments
        </h4>
        
        {selectedSubcategoriesData.map(subcategory => {
          const tagsForSubcategory = getTagsForSubcategory(subcategory.id);
          
          return (
            <div key={subcategory.id} className="space-y-2">
              {/* Subcategory Header */}
              <div 
                className="flex items-center gap-3 p-3 rounded-lg border-l-4 bg-muted/40"
                style={{ 
                  borderLeftColor: subcategory.category.color 
                }}
              >
                <div
                  className="w-3 h-3 shrink-0 rounded-full"
                  style={{ backgroundColor: subcategory.category.color }}
                ></div>
                <span className="text-sm font-medium text-foreground truncate">
                  {subcategory.category.name} → {subcategory.name}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  ({tagsForSubcategory.length} tags)
                </span>
              </div>

              {/* Tags for this subcategory */}
              {tagsForSubcategory.length > 0 ? (
                <div className="ml-6 flex flex-wrap gap-2">
                  {tagsForSubcategory.map(assignment => (
                    <div
                      key={`${assignment.subcategoryId}-${assignment.tag}`}
                      className="category-tag gap-2 pr-1"
                    >
                      <Tag className="w-3 h-3" />
                      <span>{assignment.tag}</span>
                      <button
                        type="button"
                        onClick={() => onTagAssignmentRemove(assignment.tag, assignment.subcategoryId)}
                        aria-label={`Remove tag ${assignment.tag}`}
                        className="p-1 rounded-full text-primary/70 hover:text-primary hover:bg-primary/20 transition-colors duration-150"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ml-6 text-sm text-muted-foreground italic">
                  No tags assigned yet
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Assignment Summary */}
      {tagAssignments.length > 0 && (
        <div className="bg-success/10 border border-success/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-success" />
            <h4 className="text-sm font-medium text-success">Assignment Summary</h4>
          </div>
          <div className="text-sm text-foreground">
            <strong>{tagAssignments.length}</strong> tag assignments across{' '}
            <strong>{new Set(tagAssignments.map(a => a.subcategoryId)).size}</strong> subcategories
          </div>
          <div className="mt-2 text-xs text-success">
            Tags will be properly associated with their respective subcategories when the item is saved.
          </div>
        </div>
      )}
    </div>
  );
}
