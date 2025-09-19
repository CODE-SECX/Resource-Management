import React from 'react';

interface CategoryCardProps {
  title: string;
  totalItems: number;
  learningItems: number;
  resources: number;
  icon?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function CategoryCard({
  title,
  totalItems,
  learningItems,
  resources,
  icon = title[0],
  onEdit,
  onDelete
}: CategoryCardProps) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" 
               style={{ backgroundColor: 'var(--accent)' }}>
            <span className="text-white text-xl">{icon}</span>
          </div>
          <div className="ml-4">
            <h3 style={{ color: 'var(--text-primary)' }} className="text-lg font-semibold">
              {title}
            </h3>
            <div className="mt-1 flex items-center space-x-4">
              <span style={{ color: 'var(--text-secondary)' }}>
                Total Items: {totalItems}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                Learning: {learningItems}
              </span>
            </div>
          </div>
        </div>
        <div className="flex space-x-2">
          {onEdit && (
            <button onClick={onEdit}
                    className="p-2 rounded-md hover:bg-opacity-80 transition-colors"
                    style={{ backgroundColor: 'var(--dark-surface-2)' }}>
              <span className="sr-only">Edit</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete}
                    className="p-2 rounded-md hover:bg-opacity-80 transition-colors"
                    style={{ backgroundColor: 'var(--dark-surface-2)' }}>
              <span className="sr-only">Delete</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="mt-4">
        <div className="flex items-center space-x-2">
          <span className="px-2 py-1 text-sm rounded-md" 
                style={{ 
                  backgroundColor: 'var(--dark-surface-2)',
                  color: 'var(--text-secondary)'
                }}>
            Resources: {resources}
          </span>
        </div>
      </div>
    </div>
  );
}