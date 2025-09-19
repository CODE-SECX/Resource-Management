import { X } from 'lucide-react';
import React, { useEffect } from 'react';
import { ExternalLink } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal = ({ isOpen, onClose, title, children, size = 'md' }: ModalProps) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div
          className={`${sizeClasses[size]} relative transform overflow-hidden rounded-xl bg-gray-800 text-left shadow-2xl transition-all sm:my-8 w-full border border-gray-700`}
        >
          <div className="bg-gray-800 px-6 pb-6 pt-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-semibold leading-6 text-gray-100">{title}</h3>
              <button
                onClick={onClose}
                className="rounded-lg bg-gray-700/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700 p-1.5 transition-all duration-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="animate-fade-in-up">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};