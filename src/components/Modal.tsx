import { X } from 'lucide-react';
import React, { useEffect } from 'react';

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
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:items-center">
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity animate-fade-in"
          onClick={onClose}
          aria-hidden="true"
        />

        <div
          className={`${sizeClasses[size]} animate-scale-in relative transform overflow-hidden rounded-xl bg-card text-left align-middle shadow-modal transition-all my-8 w-full max-h-[90vh] flex flex-col border border-border`}
        >
          <div className="flex items-start justify-between gap-4 px-5 py-4 sm:px-6 border-b border-border shrink-0">
            <h3 id="modal-title" className="text-lg sm:text-xl font-semibold leading-6 text-foreground">{title}</h3>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent p-1.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-5 py-5 sm:px-6 overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};