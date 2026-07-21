import React, { useState } from 'react';
import { Tag, X, Plus, Hash, Folder } from 'lucide-react';

interface SmartTagSelectorProps {
  selectedSubcategories: string[];
  selectedTags: string[];
  availableTags: string[];
  onTagToggle: (tag: string) => void;
  onTagAdd: (tag: string, subcategory?: string) => void;
  subcategoryNames?: { [id: string]: string };
}

export function SmartTagSelector({
  selectedSubcategories,
  selectedTags,
  availableTags,
  onTagToggle,
  onTagAdd,
  subcategoryNames = {}
}: SmartTagSelectorProps) {
  const [newTagInput, setNewTagInput] = useState('');
  const [selectedSubcategoryForNewTag, setSelectedSubcategoryForNewTag] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAddTag = () => {
    if (newTagInput.trim()) {
      onTagAdd(newTagInput.trim(), selectedSubcategoryForNewTag || undefined);
      setNewTagInput('');
      setSelectedSubcategoryForNewTag('');
      setShowAddForm(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === 'Escape') {
      setShowAddForm(false);
      setNewTagInput('');
      setSelectedSubcategoryForNewTag('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Smart Tags</h3>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          aria-label="Add new tag"
          className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-accent transition-colors duration-150"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Add New Tag Form */}
      {showAddForm && (
        <div className="bg-muted/40 rounded-lg p-4 border border-border">
          <div className="space-y-3">
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Enter new tag name..."
              className="input-primary"
              autoFocus
            />
            
            {selectedSubcategories.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">
                  Associate with subcategory (optional):
                </label>
                <select
                  value={selectedSubcategoryForNewTag}
                  onChange={(e) => setSelectedSubcategoryForNewTag(e.target.value)}
                  className="input-primary"
                >
                  <option value="">Category-level tag</option>
                  {selectedSubcategories.map(subId => (
                    <option key={subId} value={subId}>
                      {subcategoryNames[subId] || subId}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddTag}
                disabled={!newTagInput.trim()}
                className="btn-primary px-3 py-1.5 text-sm"
              >
                Add Tag
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewTagInput('');
                  setSelectedSubcategoryForNewTag('');
                }}
                className="btn-secondary px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Available Tags */}
      {availableTags.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Available tags:</p>
          <div className="flex flex-wrap gap-2">
            {availableTags.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagToggle(tag)}
                className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm transition-all duration-200 ${
                  selectedTags.includes(tag)
                    ? 'bg-primary text-primary-foreground border border-primary'
                    : 'bg-card text-foreground border border-border hover:bg-accent'
                }`}
              >
                <Tag className="w-3 h-3 mr-1" />
                {tag}
                {selectedTags.includes(tag) && (
                  <X className="w-3 h-3 ml-1" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Selected tags ({selectedTags.length}):</p>
          <div className="flex flex-wrap gap-2">
            {selectedTags.map(tag => (
              <span
                key={tag}
                className="category-tag gap-1 pr-1"
              >
                <Tag className="w-3 h-3" />
                {tag}
                <button
                  type="button"
                  onClick={() => onTagToggle(tag)}
                  aria-label={`Remove tag ${tag}`}
                  className="ml-1 p-1 rounded-full text-primary/70 hover:text-primary hover:bg-primary/20 transition-colors duration-150"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Smart Suggestions */}
      {selectedSubcategories.length > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Folder className="w-4 h-4 text-primary" />
            <p className="text-xs font-medium text-primary">Smart Association</p>
          </div>
          <p className="text-xs text-foreground">
            New tags will be intelligently associated with your selected subcategories: {' '}
            <span className="font-medium">
              {selectedSubcategories.map(subId => subcategoryNames[subId] || subId).join(', ')}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
