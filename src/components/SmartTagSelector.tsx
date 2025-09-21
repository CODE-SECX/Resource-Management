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
        <div className="flex items-center space-x-2">
          <Hash className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-medium text-gray-300">Smart Tags</h3>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="p-1 text-gray-400 hover:text-indigo-400 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Add New Tag Form */}
      {showAddForm && (
        <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
          <div className="space-y-3">
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Enter new tag name..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            
            {selectedSubcategories.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  Associate with subcategory (optional):
                </label>
                <select
                  value={selectedSubcategoryForNewTag}
                  onChange={(e) => setSelectedSubcategoryForNewTag(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleAddTag}
                disabled={!newTagInput.trim()}
                className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="px-3 py-1 bg-gray-600 text-gray-300 rounded-md text-sm hover:bg-gray-500"
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
          <p className="text-xs text-gray-400 mb-2">Available tags:</p>
          <div className="flex flex-wrap gap-2">
            {availableTags.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagToggle(tag)}
                className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm transition-all duration-200 ${
                  selectedTags.includes(tag)
                    ? 'bg-indigo-600 text-white border border-indigo-500'
                    : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
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
          <p className="text-xs text-gray-400 mb-2">Selected tags ({selectedTags.length}):</p>
          <div className="flex flex-wrap gap-2">
            {selectedTags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center px-3 py-1.5 bg-indigo-600/20 text-indigo-300 rounded-lg text-sm border border-indigo-500/30"
              >
                <Tag className="w-3 h-3 mr-1" />
                {tag}
                <button
                  type="button"
                  onClick={() => onTagToggle(tag)}
                  className="ml-2 text-indigo-400 hover:text-indigo-300"
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
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-2">
            <Folder className="w-4 h-4 text-blue-400" />
            <p className="text-xs font-medium text-blue-300">Smart Association</p>
          </div>
          <p className="text-xs text-blue-200">
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
