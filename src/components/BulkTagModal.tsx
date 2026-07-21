import React, { useState } from 'react';
import { Modal } from './Modal';
import { Plus, X, Tag, Hash } from 'lucide-react';
import toast from 'react-hot-toast';

interface BulkTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentName: string;
  parentType: 'category' | 'subcategory';
  onSubmit: (tags: string[]) => Promise<void>;
  existingTags?: string[]; // Optional list of existing tags to check against
}

export const BulkTagModal: React.FC<BulkTagModalProps> = ({
  isOpen,
  onClose,
  parentName,
  onSubmit,
  existingTags = []
}) => {
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    
    if (tags.includes(trimmed)) {
      toast.error('Tag already added to list');
      return;
    }
    
    if (existingTags.some(existing => existing.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`Tag "${trimmed}" already exists in this location`);
      return;
    }
    
    setTags(prev => [...prev, trimmed]);
    setTagInput('');
  };

  const removeTag = (index: number) => {
    setTags(prev => prev.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const handlePasteAndSplit = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    
    // Enhanced splitting to handle various formats
    const allPastedTags = pastedText
      .split(/[,\n\t;|]/)
      .map(tag => tag.trim())
      .filter(tag => tag);
    
    const newTags = allPastedTags.filter(tag => 
      !tags.includes(tag) && 
      !existingTags.some(existing => existing.toLowerCase() === tag.toLowerCase())
    );
    
    const alreadyInList = allPastedTags.filter(tag => tags.includes(tag));
    const alreadyExists = allPastedTags.filter(tag => 
      existingTags.some(existing => existing.toLowerCase() === tag.toLowerCase())
    );
    
    if (newTags.length > 0) {
      setTags(prev => [...prev, ...newTags]);
      setTagInput('');
      
      let message = `Added ${newTags.length} new tags`;
      if (alreadyInList.length > 0) {
        message += `, ${alreadyInList.length} already in list`;
      }
      if (alreadyExists.length > 0) {
        message += `, ${alreadyExists.length} already exist`;
      }
      toast.success(message);
    } else if (pastedText.trim()) {
      if (alreadyInList.length > 0 || alreadyExists.length > 0) {
        toast.error(`No new tags to add. ${alreadyInList.length} already in list, ${alreadyExists.length} already exist.`);
      }
    }
  };

  // Handle input change to detect comma-separated input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Auto-split if user types comma-separated values
    if (value.includes(',')) {
      const parts = value.split(',').map(part => part.trim()).filter(Boolean);
      if (parts.length > 1) {
        const newTags = parts.filter(tag => 
          !tags.includes(tag) && 
          !existingTags.some(existing => existing.toLowerCase() === tag.toLowerCase())
        );
        if (newTags.length > 0) {
          setTags(prev => [...prev, ...newTags]);
          setTagInput('');
          toast.success(`Added ${newTags.length} tags`);
          return;
        }
      }
    }
    
    setTagInput(value);
  };

  const handleSubmit = async () => {
    if (tags.length === 0) {
      toast.error('Please add at least one tag');
      return;
    }

    // Check if all tags are duplicates
    const newTags = tags.filter(tag => 
      !existingTags.some(existing => existing.toLowerCase() === tag.toLowerCase())
    );
    
    if (newTags.length === 0) {
      toast.error('All tags already exist in this location. Please add new tags or remove duplicates.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(tags);
      setTags([]);
      setTagInput('');
      onClose();
    } catch (error) {
      console.error('Bulk tag creation error:', error);
      // Don't close the modal on error so user can fix issues
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setTags([]);
    setTagInput('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Bulk Add Tags to "${parentName}"`} size="lg">
      <div className="space-y-4">
        {/* Instructions */}
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-primary text-sm font-medium mb-1">
            <Hash className="w-4 h-4" />
            Quick Tips
          </div>
          <div className="text-xs text-foreground/80 space-y-1">
            <div>• Type tag names and press Enter, or use commas to separate multiple</div>
            <div>• Paste comma-separated tags (like from "Copy All Tags") to add multiple at once</div>
            <div>• Supports various separators: commas, newlines, tabs, semicolons</div>
            <div>• Click the X to remove unwanted tags before creating</div>
          </div>
        </div>

        {/* Tag Input */}
        <div className="form-group">
          <label className="form-label">
            Add Tags
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              onPaste={handlePasteAndSplit}
              className="input-primary flex-1"
              placeholder="Enter tag name, use commas to separate multiple..."
              autoFocus
            />
            <button
              type="button"
              onClick={addTag}
              aria-label="Add tag to list"
              className="btn-primary px-4"
              disabled={!tagInput.trim()}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tags Preview */}
        {tags.length > 0 && (
          <div>
            <label className="form-label">
              Tags to Create ({tags.length})
            </label>
            <div className="max-h-48 overflow-auto bg-muted/40 rounded-lg p-3 border border-border">
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => {
                  const isDuplicate = existingTags.some(existing => existing.toLowerCase() === tag.toLowerCase());
                  return (
                    <div
                      key={index}
                      className={`inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-md text-sm border ${
                        isDuplicate 
                          ? 'bg-warning/10 text-warning border-warning/30'
                          : 'bg-primary/10 text-primary border-primary/20'
                      }`}
                    >
                      <Tag className="w-3 h-3" />
                      <span>{tag}</span>
                      {isDuplicate && (
                        <span className="text-xs" title="Already exists" aria-label="Already exists">
                          ⚠
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeTag(index)}
                        aria-label={`Remove ${tag} from list`}
                        className={`p-1 rounded-full transition-colors duration-150 ${
                          isDuplicate 
                            ? 'text-warning hover:bg-warning/20'
                            : 'text-primary hover:bg-primary/20'
                        }`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
              {tags.some(tag => existingTags.some(existing => existing.toLowerCase() === tag.toLowerCase())) && (
                <div className="mt-2 text-xs text-warning">
                  ⚠ Tags marked in amber already exist and will be skipped
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={handleClose}
            className="btn-secondary"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="btn-primary"
            disabled={isSubmitting || tags.length === 0}
          >
            {isSubmitting ? 'Creating...' : (() => {
              const newTags = tags.filter(tag => 
                !existingTags.some(existing => existing.toLowerCase() === tag.toLowerCase())
              );
              const duplicates = tags.length - newTags.length;
              
              if (newTags.length === 0 && duplicates > 0) {
                return `All ${duplicates} Tag${duplicates !== 1 ? 's' : ''} Already Exist`;
              } else if (duplicates > 0) {
                return `Create ${newTags.length} New Tag${newTags.length !== 1 ? 's' : ''} (${duplicates} Duplicate${duplicates !== 1 ? 's' : ''})`;
              } else {
                return `Create ${tags.length} Tag${tags.length !== 1 ? 's' : ''}`;
              }
            })()}
          </button>
        </div>
      </div>
    </Modal>
  );
};
