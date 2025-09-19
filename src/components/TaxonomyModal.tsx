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
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Enter name..."
            required
            autoFocus
          />
        </div>

        {showDescription && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter description (optional)..."
              rows={3}
            />
          </div>
        )}

        {showColorPicker && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-16 p-1 bg-gray-700 border border-gray-600 rounded cursor-pointer"
              />
              <span className="text-sm text-gray-400">{color}</span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : data?.editItem ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
