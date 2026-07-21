import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import toast from 'react-hot-toast';

export type TaxonomyModalMode = 'add-subcategory' | 'add-category-tag' | 'add-subcategory-tag' | 'edit-subcategory' | 'edit-tag';

export interface TaxonomyModalData {
  mode: TaxonomyModalMode;
  parentId: string;
  parentName: string;
  editItem?: {
    id: string;
    name: string;
    description?: string;
    color?: string;
  };
}

interface TaxonomyModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: TaxonomyModalData | null;
  onSubmit: (formData: {
    name: string;
    description?: string;
    color?: string;
  }) => Promise<void>;
}

export const TaxonomyModal: React.FC<TaxonomyModalProps> = ({
  isOpen,
  onClose,
  data,
  onSubmit
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#8b5cf6');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (data?.editItem) {
      setName(data.editItem.name);
      setDescription(data.editItem.description || '');
      setColor(data.editItem.color || '#8b5cf6');
    } else {
      setName('');
      setDescription('');
      setColor('#8b5cf6');
    }
  }, [data]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        color: data?.mode === 'add-subcategory' || data?.mode === 'edit-subcategory' ? color : undefined
      });
      onClose();
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTitle = () => {
    if (!data) return '';
    switch (data.mode) {
      case 'add-subcategory':
        return `Add Subcategory to "${data.parentName}"`;
      case 'add-category-tag':
        return `Add Category-Level Tag to "${data.parentName}"`;
      case 'add-subcategory-tag':
        return `Add Tag to "${data.parentName}"`;
      case 'edit-subcategory':
        return `Edit Subcategory`;
      case 'edit-tag':
        return `Edit Tag`;
      default:
        return 'Edit Item';
    }
  };

  const showColorPicker = data?.mode === 'add-subcategory' || data?.mode === 'edit-subcategory';
  const showDescription = data?.mode === 'add-subcategory' || data?.mode === 'edit-subcategory';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={getTitle()} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-group">
          <label className="form-label">
            Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-primary"
            placeholder="Enter name..."
            required
            autoFocus
          />
        </div>

        {showDescription && (
          <div className="form-group">
            <label className="form-label">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-primary"
              placeholder="Enter description (optional)..."
              rows={3}
            />
          </div>
        )}

        {showColorPicker && (
          <div className="form-group">
            <label className="form-label">
              Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                aria-label="Custom color"
                className="h-10 w-16 p-1 bg-card border border-input rounded-lg cursor-pointer"
              />
              <span className="text-sm text-muted-foreground">{color}</span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : data?.editItem ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
