'use client';

import React from 'react';
import { X } from 'lucide-react';
import { useModalAnimation } from '../../hooks/useModalAnimation';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  showCloseButton?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  closeOnBackdropClick?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  icon,
  size = 'md',
  showCloseButton = true,
  children,
  footer,
  className = '',
  bodyClassName = '',
  closeOnBackdropClick = true,
}) => {
  const { isRendered, isVisible, handleClose, handleBackdropMouseDown, handleBackdropClick } = useModalAnimation(isOpen, onClose);

  if (!isRendered) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-5xl',
  }[size];

  return (
    <div
      onMouseDown={handleBackdropMouseDown}
      onClick={(e) => {
        if (closeOnBackdropClick) {
          handleBackdropClick(e);
        }
      }}
      className={`fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto modal-backdrop-transition ${
        isVisible ? 'modal-backdrop-open' : 'modal-backdrop-closed'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl w-full ${sizeClasses} max-h-[92vh] flex flex-col p-4 sm:p-6 shadow-2xl text-slate-800 dark:text-slate-100 relative modal-dialog-transition overflow-hidden ${
          isVisible ? 'modal-dialog-open' : 'modal-dialog-closed'
        } ${className}`}
      >
        {/* Header if title or icon provided */}
        {(title || icon || showCloseButton) && (
          <div className="flex items-start justify-between gap-3 mb-3 sm:mb-4 shrink-0">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {icon && <div className="shrink-0 mt-0.5">{icon}</div>}
              <div className="flex-1 min-w-0">
                {title && (
                  <h3 className="text-sm sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-snug break-words">
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {description}
                  </p>
                )}
              </div>
            </div>

            {showCloseButton && (
              <button
                type="button"
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center transition active:scale-95 shrink-0 -mr-1 -mt-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Modal Body */}
        <div className={`overflow-y-auto flex-1 min-h-0 overscroll-contain ${bodyClassName}`}>{children}</div>

        {/* Modal Footer */}
        {footer && (
          <div className="mt-3 pt-3 sm:mt-5 sm:pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
